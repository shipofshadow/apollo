import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { chatbotApi } from '../../../services/chatbotApi'
import ConversationList from './ConversationList'
import ChatView from './ChatView'

type Flow = {
  id: string
  name?: string
  description?: string | null
  is_active?: boolean
  flow_json?: string
}

type ConversationSummary = {
  session_id: string
  status?: string
  updated_at?: string
  last_message?: string
  message_count?: number
  customer_name?: string
  customerName?: string
  name?: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export default function AdminChatbotPanel() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'conversations' | 'flows'>('conversations')
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [flowIsActive, setFlowIsActive] = useState(false)
  const [flowJson, setFlowJson] = useState('')
  const [flowError, setFlowError] = useState('')
  const [flowMsg, setFlowMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'human' | 'bot' | 'closed'>('all')
  const customerNameCacheRef = useRef<Record<string, string>>({})
  const pendingNameLoadsRef = useRef<Set<string>>(new Set())
  const statusBySessionRef = useRef<Record<string, string>>({})
  const notifiedHumanSessionsRef = useRef<Set<string>>(new Set())
  const hasHydratedInitialConversationsRef = useRef(false)

  const showHumanRequestNotification = useCallback((sessionId: string) => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission !== 'granted') {
      return
    }

    const name = customerNameCacheRef.current[sessionId] || 'A customer'
    const notification = new Notification('Human agent requested', {
      body: `${name} needs a live agent in chat.`,
      tag: `human-request-${sessionId}`,
    })

    notification.onclick = () => {
      window.focus()
      setSelectedSessionId(sessionId)
    }
  }, [])

  const mergeCachedNames = useCallback((items: ConversationSummary[]) => {
    return items.map((item) => {
      const cachedName = customerNameCacheRef.current[item.session_id]
      if (!cachedName) return item
      return { ...item, customer_name: cachedName }
    })
  }, [])

  const hydrateMissingCustomerNames = useCallback((items: ConversationSummary[]) => {
    items.forEach((item) => {
      const sid = item.session_id
      if (!sid) return
      if (item.customer_name || item.customerName || item.name) return
      if (customerNameCacheRef.current[sid]) return
      if (pendingNameLoadsRef.current.has(sid)) return

      pendingNameLoadsRef.current.add(sid)
      chatbotApi.getCustomerProfile(sid)
        .then((profile) => {
          const resolvedName = String(
            profile?.name || profile?.customer_name || profile?.customerName || ''
          ).trim()
          if (!resolvedName) return

          customerNameCacheRef.current[sid] = resolvedName
          setConversations((prev) =>
            prev.map((conv) =>
              conv.session_id === sid
                ? { ...conv, customer_name: resolvedName }
                : conv
            )
          )
        })
        .catch(() => undefined)
        .finally(() => {
          pendingNameLoadsRef.current.delete(sid)
        })
    })
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      const data = await chatbotApi.getConversations()
      const list = Array.isArray(data) ? data : data.conversations || []

      if (!hasHydratedInitialConversationsRef.current) {
        list.forEach((item: ConversationSummary) => {
          statusBySessionRef.current[item.session_id] = item.status || ''
        })
        hasHydratedInitialConversationsRef.current = true
      } else {
        list.forEach((item: ConversationSummary) => {
          const sid = item.session_id
          const nextStatus = item.status || ''
          const prevStatus = statusBySessionRef.current[sid] || ''

          if (nextStatus === 'human' && prevStatus !== 'human' && !notifiedHumanSessionsRef.current.has(sid)) {
            showHumanRequestNotification(sid)
            notifiedHumanSessionsRef.current.add(sid)
          }

          if (nextStatus !== 'human') {
            notifiedHumanSessionsRef.current.delete(sid)
          }

          statusBySessionRef.current[sid] = nextStatus
        })
      }

      const withCache = mergeCachedNames(list)
      setConversations(withCache)
      hydrateMissingCustomerNames(withCache)
    } catch {
    }
  }, [hydrateMissingCustomerNames, mergeCachedNames, showHumanRequestNotification])

  const fetchFlows = useCallback(async () => {
    try {
      const data = await chatbotApi.getFlows()
      setFlows(Array.isArray(data) ? data : data.flows || [])
    } catch {
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchConversations()
    }, 0)
    const interval = setInterval(fetchConversations, 5000)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchConversations])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'flows') {
      const timeout = setTimeout(() => {
        void fetchFlows()
      }, 0)
      return () => clearTimeout(timeout)
    }
  }, [activeTab, fetchFlows])

  const selectedFlow = flows.find((f) => String(f.id) === String(selectedFlowId))
  const humanQueueCount = conversations.filter((c) => c.status === 'human').length
  const activeFlowCount = flows.filter((f) => Boolean(f.is_active)).length

  const visibleConversations = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    return [...conversations]
      .sort((a, b) => {
        const aHuman = a.status === 'human' ? 1 : 0
        const bHuman = b.status === 'human' ? 1 : 0
        if (aHuman !== bHuman) {
          return bHuman - aHuman
        }

        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return bTime - aTime
      })
      .filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) {
          return false
        }

        if (!needle) {
          return true
        }

        const customerName = String(item.customer_name || item.customerName || item.name || '').toLowerCase()
        const sessionId = String(item.session_id || '').toLowerCase()
        const lastMessage = String(item.last_message || '').toLowerCase()
        return customerName.includes(needle) || sessionId.includes(needle) || lastMessage.includes(needle)
      })
  }, [conversations, searchQuery, statusFilter])

  const handleSelectFlow = useCallback((flow: Flow) => {
    setSelectedFlowId(String(flow.id))
    setFlowName(flow.name || '')
    setFlowDescription(flow.description || '')
    setFlowIsActive(Boolean(flow.is_active))
    try {
      setFlowJson(JSON.stringify(JSON.parse(flow.flow_json || '{}'), null, 2))
    } catch {
      setFlowJson(flow.flow_json || '')
    }
    setFlowError('')
    setFlowMsg('')
  }, [])

  const handleSaveFlow = useCallback(async () => {
    setFlowError('')
    setFlowMsg('')
    let parsed
    try {
      parsed = JSON.parse(flowJson)
    } catch {
      setFlowError('Invalid JSON')
      return
    }

    if (!flowName.trim()) {
      setFlowError('Flow name is required')
      return
    }

    const payload = {
      name: flowName.trim(),
      description: flowDescription.trim() || null,
      flow_json: JSON.stringify(parsed),
      is_active: flowIsActive,
    }

    try {
      if (selectedFlowId) {
        const updated = await chatbotApi.updateFlow(selectedFlowId, payload)
        if (updated?.is_active !== undefined) setFlowIsActive(Boolean(updated.is_active))
        setFlowMsg('Flow updated successfully.')
      } else {
        const created = await chatbotApi.createFlow(payload)
        if (created?.id) setSelectedFlowId(String(created.id))
        if (created?.is_active !== undefined) setFlowIsActive(Boolean(created.is_active))
        setFlowMsg('Flow created successfully.')
      }
      await fetchFlows()
    } catch (e) {
      setFlowError('Failed to save flow: ' + getErrorMessage(e))
    }
  }, [flowJson, flowName, flowDescription, flowIsActive, selectedFlowId, fetchFlows])

  const handleActivateFlow = useCallback(async () => {
    if (!selectedFlowId) return
    setFlowError('')
    setFlowMsg('')
    try {
      await chatbotApi.activateFlow(selectedFlowId)
      setFlowIsActive(true)
      setFlowMsg('Flow activated.')
      await fetchFlows()
    } catch (e) {
      setFlowError('Failed to activate flow: ' + getErrorMessage(e))
    }
  }, [selectedFlowId, fetchFlows])

  const handleNewFlow = useCallback(() => {
    setSelectedFlowId(null)
    setFlowName('New Flow')
    setFlowDescription('')
    setFlowIsActive(false)
    setFlowJson(
      JSON.stringify(
        {
          id: 'new_flow',
          name: 'New Flow',
          trigger_keywords: [],
          nodes: [],
        },
        null,
        2
      )
    )
    setFlowError('')
    setFlowMsg('')
  }, [])

  const handleDeleteFlow = useCallback(async () => {
    if (!selectedFlowId) return
    const ok = window.confirm('Delete this flow? This cannot be undone.')
    if (!ok) return
    setFlowError('')
    setFlowMsg('')
    try {
      await chatbotApi.deleteFlow(selectedFlowId)
      setSelectedFlowId(null)
      setFlowName('')
      setFlowDescription('')
      setFlowIsActive(false)
      setFlowJson('')
      setFlowMsg('Flow deleted.')
      await fetchFlows()
    } catch (e) {
      setFlowError('Failed to delete flow: ' + getErrorMessage(e))
    }
  }, [selectedFlowId, fetchFlows])

  return (
    <section className="space-y-4">
      <div className="bg-brand-dark border border-gray-800 rounded-sm px-4 py-3">
        <h2 className="text-xl font-display font-bold uppercase tracking-wide text-white">Chatbot Console</h2>
        <p className="text-xs text-gray-500 mt-1">Live support queue, human handoff, and flow management.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Conversations</p>
          <p className="mt-1 text-2xl font-display font-bold text-white">{conversations.length}</p>
        </div>
        <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Need Agent</p>
          <p className="mt-1 text-2xl font-display font-bold text-brand-orange">{humanQueueCount}</p>
        </div>
        <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Active Flows</p>
          <p className="mt-1 text-2xl font-display font-bold text-emerald-400">{activeFlowCount}</p>
        </div>
      </div>

      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-sm border border-gray-800 bg-brand-dark xl:h-[calc(100vh-285px)] xl:flex-row">
        <div className="flex w-full flex-col border-b border-gray-800 bg-brand-darker xl:h-full xl:w-80 xl:shrink-0 xl:border-b-0 xl:border-r xl:border-gray-800">
          <div className="flex gap-2 border-b border-gray-800 p-3">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
              activeTab === 'conversations'
                ? 'bg-brand-orange text-white'
                : 'text-gray-300 hover:bg-gray-800/70'
            }`}
          >
            Conversations ({conversations.length})
          </button>
          <button
            onClick={() => setActiveTab('flows')}
            className={`flex-1 rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
              activeTab === 'flows' ? 'bg-brand-orange text-white' : 'text-gray-300 hover:bg-gray-800/70'
            }`}
          >
            Flow Editor ({flows.length})
          </button>
        </div>

        {activeTab === 'conversations' && (
          <div className="min-h-0 max-h-[42vh] flex-1 overflow-y-auto xl:max-h-none">
            <div className="border-b border-gray-800 px-4 py-3">
              <p className="mb-2 text-[11px] text-gray-500">Select a conversation to view profile, actions, and live messages.</p>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, session, or message"
                className="w-full rounded-sm border border-gray-700 bg-brand-dark px-2.5 py-2 text-xs text-gray-100 outline-none focus:border-brand-orange"
              />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(['all', 'human', 'bot', 'closed'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatusFilter(item)}
                    className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                      statusFilter === item
                        ? 'bg-brand-orange text-white'
                        : 'bg-brand-dark text-gray-300 hover:bg-gray-800/70'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <ConversationList
              conversations={visibleConversations}
              selectedId={selectedSessionId}
              onSelect={setSelectedSessionId}
            />
          </div>
        )}

        {activeTab === 'flows' && (
          <div className="min-h-0 max-h-[42vh] flex-1 overflow-y-auto xl:max-h-none">
            <div className="border-b border-gray-800 p-3">
              <p className="mb-2 text-[11px] text-gray-500">Create and activate conversation flows.</p>
              <button
                onClick={handleNewFlow}
                className="w-full rounded-sm bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-orange-600"
              >
                + New Flow
              </button>
            </div>
            {flows.map((flow) => (
              <div
                key={flow.id}
                onClick={() => handleSelectFlow(flow)}
                className={`cursor-pointer border-b border-gray-800 px-4 py-3 text-sm transition ${
                  String(selectedFlowId) === String(flow.id)
                    ? 'border-l-4 border-l-brand-orange bg-brand-orange/10'
                    : 'border-l-4 border-l-transparent bg-transparent hover:bg-brand-dark'
                }`}
              >
                <div className="font-semibold text-gray-100">{flow.name || flow.id}</div>
                {flow.is_active && (
                  <span className="text-xs font-semibold text-emerald-400">● Active</span>
                )}
              </div>
            ))}
            {flows.length === 0 && (
              <div className="p-5 text-center text-sm text-gray-500">
                No flows yet
              </div>
            )}
          </div>
        )}
      </div>

      <div className="min-h-[380px] flex-1 overflow-hidden bg-brand-dark">
        {activeTab === 'conversations' && (
          <ChatView
            sessionId={selectedSessionId}
            onDeleteConversation={async (sessionId) => {
              setSelectedSessionId(null)
              setConversations((prev) => prev.filter((c) => c.session_id !== sessionId))
              await fetchConversations()
            }}
          />
        )}

        {activeTab === 'flows' && (
          <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white sm:text-xl">
                {selectedFlow ? `Edit: ${selectedFlow.name || selectedFlowId}` : 'New Flow'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {selectedFlowId && (
                  <button
                    onClick={handleActivateFlow}
                    className="rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-emerald-500"
                  >
                    Activate
                  </button>
                )}
                {selectedFlowId && (
                  <button
                    onClick={handleDeleteFlow}
                    className="rounded-sm bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-red-500"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSaveFlow}
                  className="rounded-sm bg-brand-orange px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-orange-600"
                >
                  {selectedFlowId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>

            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="Flow name"
                className="rounded-sm border border-gray-700 bg-brand-darker px-3 py-2 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-brand-orange"
              />
              <input
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder="Description (optional)"
                className="rounded-sm border border-gray-700 bg-brand-darker px-3 py-2 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-brand-orange"
              />
              <label className="inline-flex select-none items-center gap-2 rounded-sm border border-gray-700 bg-brand-darker px-3 py-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={flowIsActive}
                  onChange={(e) => setFlowIsActive(e.target.checked)}
                  className="h-4 w-4 accent-brand-orange"
                />
                Active
              </label>
            </div>

            {flowError && (
              <div className="mb-3 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {flowError}
              </div>
            )}
            {flowMsg && (
              <div className="mb-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {flowMsg}
              </div>
            )}

            <textarea
              value={flowJson}
              onChange={(e) => setFlowJson(e.target.value)}
              spellCheck={false}
              className="h-full min-h-[280px] w-full flex-1 resize-none rounded-sm border border-gray-700 bg-brand-darker p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none transition focus:border-brand-orange"
              placeholder="Enter flow JSON..."
            />
          </div>
        )}
      </div>
      </div>
    </section>
  )
}