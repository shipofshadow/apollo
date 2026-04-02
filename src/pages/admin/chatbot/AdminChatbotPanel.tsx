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

type FlowNodeSummary = {
  id: string
  message?: string
  input_type?: string
  next?: string | null
  options?: Array<{ label?: string; value?: string; next?: string | null }>
}

type FlowTemplateKind = 'text' | 'quick_reply' | 'http_request'
type FlowModalKind =
  | 'delete-flow'
  | 'delete-node'
  | 'starter-flow'
  | 'success'
  | 'unsaved-changes'
  | 'reset-activate'
  | null

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
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [flowModal, setFlowModal] = useState<FlowModalKind>(null)
  const [successModalMsg, setSuccessModalMsg] = useState('')
  const [pendingSelectFlow, setPendingSelectFlow] = useState<Flow | null>(null)
  const savedFlowJsonRef = useRef('')
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

  const parsedFlowJson = useMemo(() => {
    if (!flowJson.trim()) {
      return { valid: true as const, data: null as Record<string, unknown> | null }
    }
    try {
      return { valid: true as const, data: JSON.parse(flowJson) as Record<string, unknown> }
    } catch {
      return { valid: false as const, data: null }
    }
  }, [flowJson])

  const parsedNodes = useMemo(() => {
    if (!parsedFlowJson.valid || !parsedFlowJson.data) return [] as FlowNodeSummary[]
    const nodes = parsedFlowJson.data.nodes
    if (!Array.isArray(nodes)) return [] as FlowNodeSummary[]
    return nodes
      .filter((item): item is FlowNodeSummary => typeof item === 'object' && item !== null && 'id' in item)
      .map((item) => ({
        id: String(item.id),
        message: typeof item.message === 'string' ? item.message : '',
        input_type: typeof item.input_type === 'string' ? item.input_type : 'none',
        next: typeof item.next === 'string' ? item.next : null,
        options: Array.isArray(item.options)
          ? item.options
              .filter((opt): opt is Record<string, unknown> => typeof opt === 'object' && opt !== null)
              .map((opt) => ({
                label: typeof opt.label === 'string' ? opt.label : '',
                value: typeof opt.value === 'string' ? opt.value : '',
                next: typeof opt.next === 'string' ? opt.next : null,
              }))
          : [],
      }))
  }, [parsedFlowJson])

  const selectedNode = useMemo(() => {
    return parsedNodes.find((node) => node.id === selectedNodeId) || null
  }, [parsedNodes, selectedNodeId])

  const transitionCount = useMemo(() => {
    return parsedNodes.reduce((count, node) => {
      const optionTransitions = (node.options || []).filter((opt) => typeof opt?.next === 'string').length
      return count + (node.next ? 1 : 0) + optionTransitions
    }, 0)
  }, [parsedNodes])

  const flowGraphHealth = useMemo(() => {
    if (!parsedFlowJson.valid || !parsedFlowJson.data) {
      return {
        issues: [] as string[],
        reachableCount: 0,
        unreachableCount: 0,
      }
    }

    const issues: string[] = []
    const nodeIds = parsedNodes.map((node) => node.id)
    const uniqueNodeIds = new Set(nodeIds)

    if (uniqueNodeIds.size !== nodeIds.length) {
      issues.push('Duplicate node IDs detected.')
    }

    if (!uniqueNodeIds.has('start')) {
      issues.push('Missing required entry node: start')
    }

    const missingTargets = new Set<string>()
    parsedNodes.forEach((node) => {
      if (node.next && node.next !== 'handoff' && !uniqueNodeIds.has(node.next)) {
        missingTargets.add(node.next)
      }
      ;(node.options || []).forEach((opt) => {
        if (opt.next && opt.next !== 'handoff' && !uniqueNodeIds.has(opt.next)) {
          missingTargets.add(opt.next)
        }
      })
    })

    if (missingTargets.size > 0) {
      issues.push(`Broken transitions: ${Array.from(missingTargets).join(', ')}`)
    }

    const reachableIds = new Set<string>()
    const queue: string[] = uniqueNodeIds.has('start') ? ['start'] : []

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || reachableIds.has(current)) continue
      reachableIds.add(current)

      const currentNode = parsedNodes.find((node) => node.id === current)
      if (!currentNode) continue

      const targets = [
        currentNode.next,
        ...(currentNode.options || []).map((opt) => opt.next || null),
      ]

      targets.forEach((target) => {
        if (target && target !== 'handoff' && uniqueNodeIds.has(target) && !reachableIds.has(target)) {
          queue.push(target)
        }
      })
    }

    const unreachableCount = parsedNodes.length - reachableIds.size
    if (parsedNodes.length > 0 && unreachableCount > 0) {
      issues.push(`${unreachableCount} node(s) are unreachable from start.`)
    }

    return {
      issues,
      reachableCount: reachableIds.size,
      unreachableCount,
    }
  }, [parsedFlowJson, parsedNodes])

  const triggerKeywordCount = useMemo(() => {
    if (!parsedFlowJson.valid || !parsedFlowJson.data) return 0
    const raw = parsedFlowJson.data.trigger_keywords
    return Array.isArray(raw) ? raw.length : 0
  }, [parsedFlowJson])

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

  const applySelectFlow = useCallback((flow: Flow) => {
    setSelectedFlowId(String(flow.id))
    setFlowName(flow.name || '')
    setFlowDescription(flow.description || '')
    setFlowIsActive(Boolean(flow.is_active))
    let formatted = flow.flow_json || ''
    try {
      formatted = JSON.stringify(JSON.parse(flow.flow_json || '{}'), null, 2)
    } catch { /* keep raw */ }
    setFlowJson(formatted)
    savedFlowJsonRef.current = formatted
    setFlowError('')
    setFlowMsg('')
    setSelectedNodeId('')
  }, [])

  const handleSelectFlow = useCallback((flow: Flow) => {
    const hasUnsaved = flowJson.trim() !== '' && flowJson !== savedFlowJsonRef.current
    if (hasUnsaved && selectedFlowId && String(flow.id) !== String(selectedFlowId)) {
      setPendingSelectFlow(flow)
      setFlowModal('unsaved-changes')
      return
    }
    applySelectFlow(flow)
  }, [applySelectFlow, flowJson, selectedFlowId])

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
        savedFlowJsonRef.current = flowJson
        setSuccessModalMsg('Flow updated successfully.')
        setFlowModal('success')
      } else {
        const created = await chatbotApi.createFlow(payload)
        if (created?.id) setSelectedFlowId(String(created.id))
        if (created?.is_active !== undefined) setFlowIsActive(Boolean(created.is_active))
        savedFlowJsonRef.current = flowJson
        setSuccessModalMsg('Flow created successfully.')
        setFlowModal('success')
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
      setSuccessModalMsg(`Flow "${flowName || selectedFlowId}" is now active.`)
      setFlowModal('success')
      await fetchFlows()
    } catch (e) {
      setFlowError('Failed to activate flow: ' + getErrorMessage(e))
    }
  }, [selectedFlowId, flowName, fetchFlows])

  const handleResetActivate = useCallback(async () => {
    setFlowModal('reset-activate')
  }, [])

  const confirmResetActivate = useCallback(async () => {
    setFlowModal(null)
    setFlowError('')
    setFlowMsg('')
    const starterFlow = {
      id: 'new_flow',
      name: flowName.trim() || 'New Flow',
      trigger_keywords: ['hello', 'hi', 'start'],
      nodes: [
        {
          id: 'start',
          message: 'Hi! How can we help you today?',
          input_type: 'quick_reply',
          options: [
            { label: 'Book Appointment', value: 'book', next: 'collect_name' },
            { label: 'Talk to Human', value: 'human', next: 'handoff' },
          ],
          next: null,
        },
        {
          id: 'collect_name',
          message: 'Sure, may I have your name?',
          input_type: 'text',
          validation: null,
          next: 'handoff',
        },
      ],
    }
    const formatted = JSON.stringify(starterFlow, null, 2)
    const payload = {
      name: flowName.trim() || 'New Flow',
      description: flowDescription.trim() || null,
      flow_json: JSON.stringify(starterFlow),
      is_active: true,
    }
    try {
      if (selectedFlowId) {
        await chatbotApi.updateFlow(selectedFlowId, payload)
        await chatbotApi.activateFlow(selectedFlowId)
      } else {
        const created = await chatbotApi.createFlow(payload)
        if (created?.id) {
          setSelectedFlowId(String(created.id))
          await chatbotApi.activateFlow(String(created.id))
        }
      }
      setFlowJson(formatted)
      savedFlowJsonRef.current = formatted
      setFlowIsActive(true)
      setSelectedNodeId('start')
      await fetchFlows()
      setSuccessModalMsg('Flow reset to starter template and activated.')
      setFlowModal('success')
    } catch (e) {
      setFlowError('Reset + activate failed: ' + getErrorMessage(e))
    }
  }, [selectedFlowId, flowName, flowDescription, fetchFlows])

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
    setSelectedNodeId('')
    savedFlowJsonRef.current = ''
  }, [])

  const handleDeleteFlow = useCallback(async () => {
    if (!selectedFlowId) {
      setFlowError('Select a flow to delete.')
      return
    }
    setFlowModal('delete-flow')
  }, [selectedFlowId])

  const confirmDeleteFlow = useCallback(async () => {
    if (!selectedFlowId) return
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
      setSelectedNodeId('')
      setFlowModal(null)
      await fetchFlows()
    } catch (e) {
      setFlowError('Failed to delete flow: ' + getErrorMessage(e))
    }
  }, [selectedFlowId, fetchFlows])

  const mutateFlowJson = useCallback((mutator: (flow: Record<string, unknown>) => string | void, successMsg?: string) => {
    setFlowError('')
    setFlowMsg('')

    let parsed: Record<string, unknown>
    try {
      parsed = flowJson.trim() ? JSON.parse(flowJson) : {}
    } catch {
      setFlowError('Fix invalid JSON before using visual editor tools.')
      return
    }

    if (!Array.isArray(parsed.nodes)) {
      parsed.nodes = []
    }

    const err = mutator(parsed)
    if (err) {
      setFlowError(err)
      return
    }

    setFlowJson(JSON.stringify(parsed, null, 2))
    if (successMsg) setFlowMsg(successMsg)
  }, [flowJson])

  const updateSelectedNode = useCallback((mutator: (node: Record<string, unknown>) => string | void) => {
    if (!selectedNodeId) {
      setFlowError('Select a node first.')
      return
    }

    mutateFlowJson((flow) => {
      const nodes = Array.isArray(flow.nodes) ? flow.nodes : []
      const idx = nodes.findIndex((node) => typeof node === 'object' && node !== null && String((node as Record<string, unknown>).id || '') === selectedNodeId)
      if (idx < 0) {
        return 'Selected node not found in JSON.'
      }

      const originalNode = nodes[idx]
      const nextNode: Record<string, unknown> = typeof originalNode === 'object' && originalNode !== null ? { ...(originalNode as Record<string, unknown>) } : { id: selectedNodeId }

      const err = mutator(nextNode)
      if (err) return err

      nodes[idx] = nextNode
      flow.nodes = nodes
      return undefined
    })
  }, [mutateFlowJson, selectedNodeId])

  const handleFormatFlowJson = useCallback(() => {
    setFlowError('')
    setFlowMsg('')
    try {
      const formatted = JSON.stringify(JSON.parse(flowJson), null, 2)
      setFlowJson(formatted)
      setFlowMsg('JSON formatted.')
    } catch {
      setFlowError('Cannot format invalid JSON')
    }
  }, [flowJson])

  const handleMinifyFlowJson = useCallback(() => {
    setFlowError('')
    setFlowMsg('')
    try {
      const minified = JSON.stringify(JSON.parse(flowJson))
      setFlowJson(minified)
      setFlowMsg('JSON minified.')
    } catch {
      setFlowError('Cannot minify invalid JSON')
    }
  }, [flowJson])

  const handleInsertNodeTemplate = useCallback((kind: FlowTemplateKind) => {
    setFlowError('')
    setFlowMsg('')

    let parsed: Record<string, unknown>
    try {
      parsed = flowJson.trim() ? JSON.parse(flowJson) : {}
    } catch {
      setFlowError('Fix invalid JSON before inserting templates.')
      return
    }

    const existingNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
    const usedIds = new Set(
      existingNodes
        .filter((node): node is Record<string, unknown> => typeof node === 'object' && node !== null)
        .map((node) => String(node.id || ''))
        .filter(Boolean)
    )

    let idSeed = existingNodes.length + 1
    let newNodeId = `node_${idSeed}`
    while (usedIds.has(newNodeId)) {
      idSeed += 1
      newNodeId = `node_${idSeed}`
    }

    let template: Record<string, unknown>
    if (kind === 'quick_reply') {
      template = {
        id: newNodeId,
        message: 'Choose an option:',
        input_type: 'quick_reply',
        options: [
          { label: 'Option A', value: 'a', next: null },
          { label: 'Option B', value: 'b', next: null },
        ],
        next: null,
      }
    } else if (kind === 'http_request') {
      template = {
        id: newNodeId,
        message: 'Fetching data...',
        input_type: 'none',
        http_request: {
          method: 'GET',
          url: 'http://localhost:8080/api/manychat/menu',
          response_variable: 'result',
        },
        next: null,
      }
    } else {
      template = {
        id: newNodeId,
        message: 'New text node',
        input_type: 'text',
        validation: null,
        next: null,
      }
    }

    const nextFlow = {
      ...parsed,
      nodes: [...existingNodes, template],
    }

    setFlowJson(JSON.stringify(nextFlow, null, 2))
    setFlowMsg(`${kind.replace('_', ' ')} template inserted: ${newNodeId}`)
    setSelectedNodeId(newNodeId)
  }, [flowJson])

  const applyStarterFlow = useCallback(() => {
    setFlowError('')
    setFlowMsg('')
    const starterFlow = {
      id: 'new_flow',
      name: flowName.trim() || 'New Flow',
      trigger_keywords: ['hello', 'hi', 'start'],
      nodes: [
        {
          id: 'start',
          message: 'Hi! How can we help you today?',
          input_type: 'quick_reply',
          options: [
            { label: 'Book Appointment', value: 'book', next: 'collect_name' },
            { label: 'Talk to Human', value: 'human', next: 'handoff' },
          ],
          next: null,
        },
        {
          id: 'collect_name',
          message: 'Sure, may I have your name?',
          input_type: 'text',
          validation: null,
          next: 'handoff',
        },
      ],
    }
    setFlowJson(JSON.stringify(starterFlow, null, 2))
    setFlowMsg('Starter flow template inserted.')
    setSelectedNodeId('start')
    setFlowModal(null)
  }, [flowName])

  const handleInsertStarterFlow = useCallback(() => {
    if (parsedNodes.length > 0) {
      setFlowModal('starter-flow')
      return
    }
    applyStarterFlow()
  }, [applyStarterFlow, parsedNodes.length])

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) {
      setFlowError('Select a node to delete.')
      return
    }
    setFlowModal('delete-node')
  }, [selectedNodeId])

  const confirmDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return
    mutateFlowJson((flow) => {
      const nodes = Array.isArray(flow.nodes) ? flow.nodes : []
      flow.nodes = nodes.filter(
        (node) => !(typeof node === 'object' && node !== null && String((node as Record<string, unknown>).id || '') === selectedNodeId)
      )
      return undefined
    }, `Deleted node: ${selectedNodeId}`)

    setSelectedNodeId('')
    setFlowModal(null)
  }, [mutateFlowJson, selectedNodeId])

  const handleAddOptionToSelected = useCallback(() => {
    updateSelectedNode((node) => {
      const options = Array.isArray(node.options) ? [...node.options] : []
      options.push({ label: 'Option', value: 'option', next: null })
      node.options = options
      if (node.input_type !== 'quick_reply') {
        node.input_type = 'quick_reply'
      }
      return undefined
    })
  }, [updateSelectedNode])

  const handleUpdateSelectedOption = useCallback((index: number, key: 'label' | 'value' | 'next', value: string) => {
    updateSelectedNode((node) => {
      const options = Array.isArray(node.options) ? [...node.options] : []
      if (!options[index] || typeof options[index] !== 'object' || options[index] === null) {
        return 'Option not found.'
      }
      const nextOpt = { ...(options[index] as Record<string, unknown>) }
      if (key === 'next') {
        nextOpt.next = value.trim() || null
      } else {
        nextOpt[key] = value
      }
      options[index] = nextOpt
      node.options = options
      return undefined
    })
  }, [updateSelectedNode])

  const handleRemoveSelectedOption = useCallback((index: number) => {
    updateSelectedNode((node) => {
      const options = Array.isArray(node.options) ? [...node.options] : []
      node.options = options.filter((_, idx) => idx !== index)
      return undefined
    })
  }, [updateSelectedNode])

  useEffect(() => {
    if (parsedNodes.length === 0) {
      if (selectedNodeId) setSelectedNodeId('')
      return
    }

    if (!selectedNodeId || !parsedNodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(parsedNodes[0].id)
    }
  }, [parsedNodes, selectedNodeId])

  useEffect(() => {
    if (!flowModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && flowModal !== 'unsaved-changes') {
        setFlowModal(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [flowModal])

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

      <div className="flex flex-col rounded-sm border border-gray-800 bg-brand-dark xl:flex-row">
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
          <div className="flex-1 overflow-visible">
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
          <div className="flex-1 overflow-visible">
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

      <div className="min-h-[380px] bg-brand-dark">
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
          <div className="flex flex-col p-3 sm:p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white sm:text-xl">
                {selectedFlow ? `Edit: ${selectedFlow.name || selectedFlowId}` : 'New Flow'}
              </h2>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                {selectedFlowId && (
                  <button
                    onClick={handleActivateFlow}
                    className="rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-emerald-500"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={handleResetActivate}
                  className="rounded-sm border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-orange transition hover:bg-brand-orange/20"
                >
                  Reset + Activate
                </button>
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

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-gray-800 bg-brand-darker/70 px-3 py-2">
              <button
                type="button"
                onClick={handleFormatFlowJson}
                className="rounded-sm border border-gray-700 bg-brand-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange hover:text-white"
              >
                Format JSON
              </button>
              <button
                type="button"
                onClick={handleMinifyFlowJson}
                className="rounded-sm border border-gray-700 bg-brand-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange hover:text-white"
              >
                Minify JSON
              </button>
              <button
                type="button"
                onClick={handleInsertStarterFlow}
                className="rounded-sm border border-gray-700 bg-brand-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange hover:text-white"
              >
                Starter Flow
              </button>
              <button
                type="button"
                onClick={() => handleInsertNodeTemplate('text')}
                className="rounded-sm border border-gray-700 bg-brand-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange hover:text-white"
              >
                + Text Node
              </button>
              <button
                type="button"
                onClick={() => handleInsertNodeTemplate('quick_reply')}
                className="rounded-sm border border-gray-700 bg-brand-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange hover:text-white"
              >
                + Quick Reply
              </button>
              <button
                type="button"
                onClick={() => handleInsertNodeTemplate('http_request')}
                className="rounded-sm border border-gray-700 bg-brand-dark px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange hover:text-white"
              >
                + HTTP Node
              </button>
              <span
                className={`inline-flex w-full items-center justify-center rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-widest sm:ml-auto sm:w-auto ${
                  parsedFlowJson.valid
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                }`}
              >
                {parsedFlowJson.valid ? 'JSON Valid' : 'JSON Invalid'}
              </span>
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

            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
              <textarea
                value={flowJson}
                onChange={(e) => setFlowJson(e.target.value)}
                spellCheck={false}
                className="order-2 min-h-[320px] w-full resize-y rounded-sm border border-gray-700 bg-brand-darker p-3 font-mono text-xs leading-relaxed text-gray-100 outline-none transition focus:border-brand-orange sm:p-4 sm:text-sm lg:order-1"
                placeholder="Enter flow JSON..."
              />

              <aside className="order-1 flex min-h-[280px] flex-col rounded-sm border border-gray-800 bg-brand-darker/60 lg:order-2">
                <div className="grid grid-cols-3 gap-2 border-b border-gray-800 p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Nodes</p>
                    <p className="text-base font-bold text-white">{parsedNodes.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Links</p>
                    <p className="text-base font-bold text-white">{transitionCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Triggers</p>
                    <p className="text-base font-bold text-white">{triggerKeywordCount}</p>
                  </div>
                </div>

                <div className="border-b border-gray-800 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Validation</p>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        flowGraphHealth.issues.length === 0
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {flowGraphHealth.issues.length === 0 ? 'Healthy' : `${flowGraphHealth.issues.length} issue(s)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Reachable: {flowGraphHealth.reachableCount} | Unreachable: {flowGraphHealth.unreachableCount}
                  </p>
                  {flowGraphHealth.issues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {flowGraphHealth.issues.map((issue) => (
                        <p key={issue} className="text-[11px] text-amber-200">- {issue}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-b border-gray-800 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Visual Node Editor</p>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedNode}
                      className="rounded-sm border border-red-600/40 bg-red-600/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-600/20"
                    >
                      Delete Node
                    </button>
                  </div>

                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Node</label>
                  <select
                    value={selectedNodeId}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    className="mb-2 w-full rounded-sm border border-gray-700 bg-brand-dark px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
                  >
                    {parsedNodes.map((node) => (
                      <option key={node.id} value={node.id}>{node.id}</option>
                    ))}
                  </select>

                  {selectedNode && (
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Node ID</label>
                        <input
                          value={selectedNode.id}
                          onChange={(e) => {
                            const nextId = e.target.value.trim()
                            if (!nextId) return
                            updateSelectedNode((node) => {
                              const currentId = String(node.id || '')
                              if (currentId === nextId) return undefined
                              if (parsedNodes.some((item) => item.id === nextId)) {
                                return `Node ID already exists: ${nextId}`
                              }
                              node.id = nextId
                              setSelectedNodeId(nextId)
                              return undefined
                            })
                          }}
                          className="w-full rounded-sm border border-gray-700 bg-brand-dark px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Message</label>
                        <textarea
                          value={selectedNode.message || ''}
                          onChange={(e) => updateSelectedNode((node) => {
                            node.message = e.target.value
                            return undefined
                          })}
                          className="h-16 w-full resize-none rounded-sm border border-gray-700 bg-brand-dark px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Input Type</label>
                          <select
                            value={selectedNode.input_type || 'none'}
                            onChange={(e) => updateSelectedNode((node) => {
                              node.input_type = e.target.value
                              return undefined
                            })}
                            className="w-full rounded-sm border border-gray-700 bg-brand-dark px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
                          >
                            <option value="text">text</option>
                            <option value="quick_reply">quick_reply</option>
                            <option value="none">none</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Next Node</label>
                          <input
                            value={selectedNode.next || ''}
                            placeholder="handoff or node id"
                            onChange={(e) => updateSelectedNode((node) => {
                              node.next = e.target.value.trim() || null
                              return undefined
                            })}
                            className="w-full rounded-sm border border-gray-700 bg-brand-dark px-2 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand-orange"
                          />
                        </div>
                      </div>

                      {(selectedNode.input_type === 'quick_reply' || (selectedNode.options || []).length > 0) && (
                        <div className="rounded-sm border border-gray-800 bg-brand-dark/80 p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Quick Reply Options</p>
                            <button
                              type="button"
                              onClick={handleAddOptionToSelected}
                              className="rounded-sm border border-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-200 transition hover:border-brand-orange"
                            >
                              + Option
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(selectedNode.options || []).map((opt, idx) => (
                              <div key={`${selectedNode.id}-opt-${idx}`} className="rounded-sm border border-gray-800 p-2">
                                <div className="grid grid-cols-1 gap-1.5">
                                  <input
                                    value={opt.label || ''}
                                    placeholder="Label"
                                    onChange={(e) => handleUpdateSelectedOption(idx, 'label', e.target.value)}
                                    className="w-full rounded-sm border border-gray-700 bg-brand-darker px-2 py-1 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand-orange"
                                  />
                                  <input
                                    value={opt.value || ''}
                                    placeholder="Value"
                                    onChange={(e) => handleUpdateSelectedOption(idx, 'value', e.target.value)}
                                    className="w-full rounded-sm border border-gray-700 bg-brand-darker px-2 py-1 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand-orange"
                                  />
                                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                    <input
                                      value={opt.next || ''}
                                      placeholder="Next"
                                      onChange={(e) => handleUpdateSelectedOption(idx, 'next', e.target.value)}
                                      className="w-full rounded-sm border border-gray-700 bg-brand-darker px-2 py-1 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand-orange"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSelectedOption(idx)}
                                      className="rounded-sm border border-red-600/40 bg-red-600/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-600/20"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedNode && (
                    <p className="text-[11px] text-gray-500">No node selected yet.</p>
                  )}
                </div>

                <div className="p-3">
                  {parsedNodes.length === 0 && (
                    <p className="text-xs text-gray-500">No nodes detected. Add nodes in JSON to preview flow structure.</p>
                  )}
                  <div className="space-y-2">
                    {parsedNodes.map((node) => {
                      const optionCount = (node.options || []).length
                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`cursor-pointer rounded-sm border px-3 py-2 transition ${
                            selectedNodeId === node.id
                              ? 'border-brand-orange bg-brand-orange/10'
                              : 'border-gray-800 bg-brand-dark hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-bold uppercase tracking-wider text-brand-orange">{node.id}</p>
                            <span className="rounded-sm bg-gray-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-300">
                              {node.input_type || 'none'}
                            </span>
                          </div>
                          {node.message && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-300">{node.message}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400">
                            <span>next: {node.next || '-'}</span>
                            <span>options: {optionCount}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>

      {flowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-sm border border-gray-700 bg-brand-darker p-4 shadow-2xl sm:p-5">

            {/* ── Success ── */}
            {flowModal === 'success' && (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xl">✓</span>
                  <h3 className="text-base font-bold text-white">Done</h3>
                </div>
                <p className="text-sm text-gray-300">{successModalMsg}</p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFlowModal(null)}
                    className="rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-emerald-500"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {/* ── Unsaved changes ── */}
            {flowModal === 'unsaved-changes' && (
              <>
                <h3 className="text-base font-bold text-white">Unsaved changes</h3>
                <p className="mt-2 text-sm text-gray-300">You have unsaved changes in the current flow. Switching will discard them.</p>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => { setFlowModal(null); setPendingSelectFlow(null) }}
                    className="rounded-sm border border-gray-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-200 transition hover:bg-gray-800"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingSelectFlow) applySelectFlow(pendingSelectFlow)
                      setPendingSelectFlow(null)
                      setFlowModal(null)
                    }}
                    className="rounded-sm bg-red-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-500"
                  >
                    Discard & switch
                  </button>
                </div>
              </>
            )}

            {/* ── Reset + Activate ── */}
            {flowModal === 'reset-activate' && (
              <>
                <h3 className="text-base font-bold text-white">Reset flow and activate?</h3>
                <p className="mt-2 text-sm text-gray-300">This will replace the current flow JSON with the starter template, save it, and make it the active flow.</p>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setFlowModal(null)}
                    className="rounded-sm border border-gray-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-200 transition hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { void confirmResetActivate() }}
                    className="rounded-sm bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-600"
                  >
                    Reset + Activate
                  </button>
                </div>
              </>
            )}

            {/* ── Delete / replace confirmation ── */}
            {(flowModal === 'delete-flow' || flowModal === 'delete-node' || flowModal === 'starter-flow') && (
              <>
                <h3 className="text-base font-bold text-white">
                  {flowModal === 'delete-flow' && 'Delete flow?'}
                  {flowModal === 'delete-node' && 'Delete node?'}
                  {flowModal === 'starter-flow' && 'Replace current flow?'}
                </h3>
                <p className="mt-2 text-sm text-gray-300">
                  {flowModal === 'delete-flow' && 'This action removes the selected flow permanently.'}
                  {flowModal === 'delete-node' && 'This action removes the selected node from the current flow JSON.'}
                  {flowModal === 'starter-flow' && 'This will replace current JSON with the starter flow template.'}
                </p>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setFlowModal(null)}
                    className="rounded-sm border border-gray-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-200 transition hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (flowModal === 'delete-flow') { void confirmDeleteFlow(); return }
                      if (flowModal === 'delete-node') { confirmDeleteSelectedNode(); return }
                      applyStarterFlow()
                    }}
                    className={`rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition ${
                      flowModal === 'starter-flow' ? 'bg-brand-orange hover:bg-orange-600' : 'bg-red-600 hover:bg-red-500'
                    }`}
                  >
                    {flowModal === 'starter-flow' ? 'Replace' : 'Delete'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
      </div>
    </section>
  )
}