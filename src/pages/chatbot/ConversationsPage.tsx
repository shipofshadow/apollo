import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, Filter, RefreshCw, MessageSquare, Bot, User, X, Settings2 } from 'lucide-react'
import { chatbotApi } from '../../services/chatbotApi'
import ConversationList from '../admin/chatbot/ConversationList'
import ChatView from '../admin/chatbot/ChatView'
import { useSettings } from '../../hooks/useSettings'
import SettingsModal from '../../components/admin/chatbot/SettingsModal'

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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'human' | 'bot' | 'closed'>('all')
  const [loading, setLoading] = useState(true)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { settings, updateSettings, isSyncing } = useSettings()

  const customerNameCacheRef = useRef<Record<string, string>>({})
  const pendingNameLoadsRef = useRef<Set<string>>(new Set())
  const statusBySessionRef = useRef<Record<string, string>>({})
  const notifiedHumanSessionsRef = useRef<Set<string>>(new Set())
  const hasHydratedRef = useRef(false)

  const showHumanRequestNotification = useCallback((sessionId: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
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

  const mergeCachedNames = useCallback((items: ConversationSummary[]) =>
    items.map((item) => {
      const cached = customerNameCacheRef.current[item.session_id]
      return cached ? { ...item, customer_name: cached } : item
    }), [])

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const hydrateMissingCustomerNames = useCallback((items: ConversationSummary[]) => {
    items.forEach((item) => {
      const sid = item.session_id
      if (!sid || item.customer_name || item.customerName || item.name) return
      if (customerNameCacheRef.current[sid] || pendingNameLoadsRef.current.has(sid)) return
      pendingNameLoadsRef.current.add(sid)
      chatbotApi.getCustomerProfile(sid)
        .then((profile) => {
          const name = String(profile?.name || profile?.customer_name || '').trim()
          if (!name || !mountedRef.current) return
          customerNameCacheRef.current[sid] = name
          setConversations((prev) => prev.map((c) => c.session_id === sid ? { ...c, customer_name: name } : c))
        })
        .catch((error) => {
          console.error('Failed to hydrate customer profile for session', sid, error)
        })
        .finally(() => pendingNameLoadsRef.current.delete(sid))
    })
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      const data = await chatbotApi.getConversations()
      const list: ConversationSummary[] = Array.isArray(data) ? data : (data.conversations ?? [])

      if (!hasHydratedRef.current) {
        list.forEach((item) => { statusBySessionRef.current[item.session_id] = item.status ?? '' })
        hasHydratedRef.current = true
      } else {
        list.forEach((item) => {
          const sid = item.session_id
          const next = item.status ?? ''
          const prev = statusBySessionRef.current[sid] ?? ''
          if (next === 'human' && prev !== 'human' && !notifiedHumanSessionsRef.current.has(sid)) {
            showHumanRequestNotification(sid)
            notifiedHumanSessionsRef.current.add(sid)
          }
          if (next !== 'human') notifiedHumanSessionsRef.current.delete(sid)
          statusBySessionRef.current[sid] = next
        })
      }

      const withCache = mergeCachedNames(list)
      setConversations(withCache)
      hydrateMissingCustomerNames(withCache)
    } catch (error) {
      console.error('Failed to fetch conversations', error)
    } finally {
      setLoading(false)
    }
  }, [hydrateMissingCustomerNames, mergeCachedNames, showHumanRequestNotification])

  useEffect(() => {
    void fetchConversations()
    const interval = setInterval(() => {
      if (!document.hidden) {
        void fetchConversations()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch((error) => {
        console.error('Failed to request notification permission', error)
      })
    }
  }, [])

  const visibleConversations = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    return [...conversations]
      .sort((a, b) => {
        const aH = a.status === 'human' ? 1 : 0
        const bH = b.status === 'human' ? 1 : 0
        if (aH !== bH) return bH - aH
        return (b.updated_at ? new Date(b.updated_at).getTime() : 0) -
               (a.updated_at ? new Date(a.updated_at).getTime() : 0)
      })
      .filter((item) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        if (!needle) return true
        const name = String(item.customer_name || item.customerName || item.name || '').toLowerCase()
        const sid = String(item.session_id || '').toLowerCase()
        const msg = String(item.last_message || '').toLowerCase()
        return name.includes(needle) || sid.includes(needle) || msg.includes(needle)
      })
  }, [conversations, searchQuery, statusFilter])

  const humanCount = conversations.filter((c) => c.status === 'human').length
  const botCount = conversations.filter((c) => c.status === 'bot').length
  const closedCount = conversations.filter((c) => c.status === 'closed').length

  const FILTER_TABS: { key: 'all' | 'human' | 'bot' | 'closed'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: conversations.length },
    { key: 'human', label: 'Human', count: humanCount },
    { key: 'bot', label: 'Bot', count: botCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ]

  return (
    <div className="h-screen w-full overflow-hidden bg-gray-900 text-gray-200 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900/90 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <div className="ml-2 hidden sm:block text-xs text-gray-500">{conversations.length} conversations</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-sm transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </button>
          <button
            onClick={() => void fetchConversations()}
            className="flex items-center gap-2 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — conversation list */}
        <aside
          className={`
            ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
            fixed md:relative inset-y-0 left-0 z-40 md:z-10
            flex-none w-[88vw] max-w-xs md:max-w-none md:w-80
            bg-gray-900 border-r border-gray-800
            flex flex-col
            overflow-hidden transition-transform duration-300 ease-in-out
          `}
        >
          {/* Mobile close */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Conversations</span>
            <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sidebar header */}
          <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 grid place-items-center text-brand-orange shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-semibold text-gray-100 truncate">Messenger</p>
              <p className="text-[11px] text-gray-500 truncate">{humanCount} waiting for human</p>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white text-xs pl-8 pr-3 py-2 rounded-sm focus:outline-none focus:border-brand-orange transition-colors placeholder-gray-600"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800 overflow-x-auto">
            <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0 mr-1" />
            {FILTER_TABS.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  statusFilter === key
                    ? 'bg-brand-orange text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {label} {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
            ) : (
              <ConversationList
                conversations={visibleConversations}
                selectedId={selectedSessionId}
                onSelect={(sid) => {
                  setSelectedSessionId(sid)
                  setShowSidebar(false)
                }}
              />
            )}
          </div>

          {/* Status legend */}
          <div className="px-4 py-3 border-t border-gray-800 hidden md:flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><Bot className="w-3 h-3 text-blue-400" /> Bot</span>
            <span className="flex items-center gap-1.5"><User className="w-3 h-3 text-brand-orange" /> Human</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-600 inline-block" /> Closed</span>
          </div>
        </aside>

        {/* Mobile overlay */}
        {showSidebar && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Main area — chat view */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-gray-900 border-l border-gray-800">
          {/* Mobile toolbar */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
            <button
              onClick={() => setShowSidebar(true)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-sm transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {selectedSessionId ? 'Switch' : 'Select'} Conversation
            </button>
            {selectedSessionId && (
              <span className="text-xs text-gray-500 truncate font-mono">{selectedSessionId.substring(0, 12)}…</span>
            )}
          </div>

          {selectedSessionId ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatView
                sessionId={selectedSessionId}
                onDeleteConversation={async (sid) => {
                  await chatbotApi.deleteConversation(sid)
                  setConversations((prev) => prev.filter((c) => c.session_id !== sid))
                  setSelectedSessionId(null)
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-brand-orange/60" />
              </div>
              <div>
                <p className="text-white font-bold">Select a conversation</p>
                <p className="text-gray-500 text-sm mt-1">Choose from the list on the left to start chatting</p>
              </div>
              <button
                onClick={() => setShowSidebar(true)}
                className="md:hidden bg-brand-orange hover:bg-orange-600 text-white text-sm font-bold px-5 py-2 rounded-sm transition-colors"
              >
                View Conversations
              </button>
            </div>
          )}
        </main>
      </div>

      <SettingsModal
        open={showSettings}
        settings={settings}
        isSaving={isSyncing}
        onClose={() => setShowSettings(false)}
        onSave={(next) => {
          void updateSettings(next)
        }}
      />
    </div>
  )
}
