import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  MarkerType,
  Panel,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Plus, Save, Trash2, Play, ChevronDown, ChevronUp, Zap, MessageSquare,
  GitBranch, PhoneCall, CheckCircle, X, Loader2, AlertCircle,
  List, Settings, ArrowLeft, RefreshCw,
} from 'lucide-react'
import { chatbotApi, toApiErrorMessage } from '../../services/chatbotApi'

// ─── Types ─────────────────────────────────────────────────────────────────

type FlowNodeData = {
  label: string
  [key: string]: unknown
}

type FlowRecord = {
  id: string
  name?: string
  description?: string | null
  is_active?: boolean
  flow_json?: string
}

// ─── Node Data Types ────────────────────────────────────────────────────────

type TriggerNodeData = FlowNodeData & {
  triggerType: 'greeting' | 'keyword' | 'any'
  keywords?: string
}

type MessageNodeData = FlowNodeData & {
  message: string
  delay?: number
}

type ConditionNodeData = FlowNodeData & {
  conditionVar: string
  operator: 'equals' | 'contains' | 'exists' | 'not_exists'
  value: string
}

type QuickReplyNodeData = FlowNodeData & {
  message: string
  replies: string
}

type ActionNodeData = FlowNodeData & {
  actionType: 'handoff' | 'tag' | 'set_variable' | 'end_flow'
  actionValue?: string
}

// ─── Custom Node Components ─────────────────────────────────────────────────

function nodeWrapper(color: string, icon: React.ReactNode, title: string, children: React.ReactNode, selected: boolean) {
  return (
    <div
      className="bg-[#1a1a2e] border rounded-lg shadow-xl min-w-[200px] max-w-[240px] transition-all"
      style={{
        borderColor: selected ? color : '#374151',
        boxShadow: selected ? `0 0 20px ${color}40` : undefined,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: `${color}22`, borderBottom: `1px solid ${color}44` }}
      >
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-white">{title}</span>
      </div>
      <div className="px-3 py-2.5 text-xs text-gray-300 space-y-1">{children}</div>
    </div>
  )
}

function TriggerNode({ data, selected }: { data: TriggerNodeData; selected: boolean }) {
  return (
    <>
      {nodeWrapper('#22c55e', <Zap className="w-3.5 h-3.5" />, 'Trigger', (
        <>
          <div className="text-gray-400">Type: <span className="text-white capitalize">{data.triggerType || 'greeting'}</span></div>
          {data.keywords && <div className="text-gray-400 truncate">Keywords: <span className="text-white">{data.keywords}</span></div>}
        </>
      ), selected)}
      <Handle type="source" position={Position.Bottom} style={{ background: '#22c55e', border: '2px solid #16a34a' }} />
    </>
  )
}

function MessageNode({ data, selected }: { data: MessageNodeData; selected: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#3b82f6', border: '2px solid #2563eb' }} />
      {nodeWrapper('#3b82f6', <MessageSquare className="w-3.5 h-3.5" />, 'Send Message', (
        <>
          <div className="text-gray-100 text-[11px] leading-snug line-clamp-3 whitespace-pre-wrap break-words">
            {data.message || <span className="text-gray-500 italic">No message set</span>}
          </div>
          {data.delay ? <div className="text-gray-500 text-[10px]">Delay: {data.delay}s</div> : null}
        </>
      ), selected)}
      <Handle type="source" position={Position.Bottom} style={{ background: '#3b82f6', border: '2px solid #2563eb' }} />
    </>
  )
}

function ConditionNode({ data, selected }: { data: ConditionNodeData; selected: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b', border: '2px solid #d97706' }} />
      {nodeWrapper('#f59e0b', <GitBranch className="w-3.5 h-3.5" />, 'Condition', (
        <>
          <div className="text-gray-400">If <span className="text-white font-mono">{data.conditionVar || '…'}</span></div>
          <div className="text-gray-400"><span className="text-amber-300">{data.operator || 'equals'}</span> <span className="text-white">"{data.value || '…'}"</span></div>
        </>
      ), selected)}
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%', background: '#22c55e', border: '2px solid #16a34a' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%', background: '#ef4444', border: '2px solid #dc2626' }} />
      <div style={{ position: 'absolute', bottom: -18, left: '14%', fontSize: 9, color: '#22c55e', fontWeight: 700 }}>YES</div>
      <div style={{ position: 'absolute', bottom: -18, left: '58%', fontSize: 9, color: '#ef4444', fontWeight: 700 }}>NO</div>
    </>
  )
}

function QuickReplyNode({ data, selected }: { data: QuickReplyNodeData; selected: boolean }) {
  const replies = (data.replies || '').split(',').map((r) => r.trim()).filter(Boolean)
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#8b5cf6', border: '2px solid #7c3aed' }} />
      {nodeWrapper('#8b5cf6', <List className="w-3.5 h-3.5" />, 'Quick Replies', (
        <>
          <div className="text-gray-100 text-[11px] leading-snug mb-1.5">
            {data.message || <span className="text-gray-500 italic">No message set</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {replies.length > 0 ? replies.map((r, i) => (
              <span key={i} className="bg-purple-900/50 border border-purple-700 text-purple-200 text-[10px] px-1.5 py-0.5 rounded-full">{r}</span>
            )) : <span className="text-gray-500 italic text-[10px]">No replies set</span>}
          </div>
        </>
      ), selected)}
      <Handle type="source" position={Position.Bottom} style={{ background: '#8b5cf6', border: '2px solid #7c3aed' }} />
    </>
  )
}

function ActionNode({ data, selected }: { data: ActionNodeData; selected: boolean }) {
  const ACTION_LABELS: Record<string, string> = {
    handoff: '🤝 Handoff to Human',
    tag: '🏷️ Tag Customer',
    set_variable: '📝 Set Variable',
    end_flow: '🔚 End Flow',
  }
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#ec4899', border: '2px solid #db2777' }} />
      {nodeWrapper('#ec4899', <Settings className="w-3.5 h-3.5" />, 'Action', (
        <>
          <div className="text-white text-[11px] font-medium">{ACTION_LABELS[data.actionType] || data.actionType}</div>
          {data.actionValue && <div className="text-gray-400 text-[10px] truncate">Value: <span className="text-white">{data.actionValue}</span></div>}
        </>
      ), selected)}
      {data.actionType !== 'end_flow' && (
        <Handle type="source" position={Position.Bottom} style={{ background: '#ec4899', border: '2px solid #db2777' }} />
      )}
    </>
  )
}

function PhoneNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#14b8a6', border: '2px solid #0d9488' }} />
      {nodeWrapper('#14b8a6', <PhoneCall className="w-3.5 h-3.5" />, 'Call to Action', (
        <>
          <div className="text-gray-100 text-[11px]">{data.label || 'CTA'}</div>
        </>
      ), selected)}
      <Handle type="source" position={Position.Bottom} style={{ background: '#14b8a6', border: '2px solid #0d9488' }} />
    </>
  )
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode as unknown as NodeTypes[string],
  message: MessageNode as unknown as NodeTypes[string],
  condition: ConditionNode as unknown as NodeTypes[string],
  quickReply: QuickReplyNode as unknown as NodeTypes[string],
  action: ActionNode as unknown as NodeTypes[string],
  cta: PhoneNode as unknown as NodeTypes[string],
}

// ─── Node Palette ────────────────────────────────────────────────────────────

const NODE_PALETTE = [
  { type: 'trigger',    label: 'Trigger',       icon: <Zap className="w-3.5 h-3.5" />,          color: '#22c55e', desc: 'Start of flow' },
  { type: 'message',   label: 'Message',        icon: <MessageSquare className="w-3.5 h-3.5" />, color: '#3b82f6', desc: 'Send a message' },
  { type: 'condition', label: 'Condition',      icon: <GitBranch className="w-3.5 h-3.5" />,     color: '#f59e0b', desc: 'If/else branch' },
  { type: 'quickReply',label: 'Quick Replies',  icon: <List className="w-3.5 h-3.5" />,          color: '#8b5cf6', desc: 'Buttons for user' },
  { type: 'action',    label: 'Action',         icon: <Settings className="w-3.5 h-3.5" />,      color: '#ec4899', desc: 'Perform an action' },
  { type: 'cta',       label: 'Call to Action', icon: <PhoneCall className="w-3.5 h-3.5" />,     color: '#14b8a6', desc: 'CTA button' },
]

function defaultNodeData(type: string): FlowNodeData {
  switch (type) {
    case 'trigger':    return { label: 'New Trigger', triggerType: 'greeting', keywords: '' } as TriggerNodeData
    case 'message':    return { label: 'Send Message', message: '', delay: 0 } as MessageNodeData
    case 'condition':  return { label: 'Check Condition', conditionVar: '', operator: 'equals', value: '' } as ConditionNodeData
    case 'quickReply': return { label: 'Quick Replies', message: '', replies: '' } as QuickReplyNodeData
    case 'action':     return { label: 'Action', actionType: 'handoff', actionValue: '' } as ActionNodeData
    case 'cta':        return { label: 'Book Now' }
    default:           return { label: 'Node' }
  }
}

// ─── Properties Panel ────────────────────────────────────────────────────────

function PropertiesPanel({
  node,
  onUpdate,
  onDelete,
}: {
  node: Node<FlowNodeData>
  onUpdate: (id: string, data: FlowNodeData) => void
  onDelete: (id: string) => void
}) {
  const d = node.data

  function field(label: string, el: React.ReactNode) {
    return (
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
        {el}
      </div>
    )
  }

  const inputCls = 'w-full bg-[#0d0d1a] border border-gray-700 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-brand-orange transition-colors'
  const selectCls = `${inputCls} appearance-none`

  function set(key: string, value: unknown) {
    onUpdate(node.id, { ...d, [key]: value })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">Properties</span>
        <button onClick={() => onDelete(node.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete node">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {field('Label', (
          <input className={inputCls} value={String(d.label || '')} onChange={(e) => set('label', e.target.value)} />
        ))}

        {node.type === 'trigger' && (() => {
          const td = d as TriggerNodeData
          return (
            <>
              {field('Trigger Type', (
                <select className={selectCls} value={td.triggerType || 'greeting'} onChange={(e) => set('triggerType', e.target.value)}>
                  <option value="greeting">Greeting / First message</option>
                  <option value="keyword">Keyword match</option>
                  <option value="any">Any message</option>
                </select>
              ))}
              {td.triggerType === 'keyword' && field('Keywords (comma separated)', (
                <input className={inputCls} placeholder="hello, hi, hey" value={td.keywords || ''} onChange={(e) => set('keywords', e.target.value)} />
              ))}
            </>
          )
        })()}

        {node.type === 'message' && (() => {
          const md = d as MessageNodeData
          return (
            <>
              {field('Message Text', (
                <textarea rows={4} className={inputCls} placeholder="Type your message…" value={md.message || ''} onChange={(e) => set('message', e.target.value)} />
              ))}
              {field('Delay (seconds)', (
                <input type="number" min={0} max={10} className={inputCls} value={md.delay ?? 0} onChange={(e) => set('delay', Number(e.target.value))} />
              ))}
            </>
          )
        })()}

        {node.type === 'condition' && (() => {
          const cd = d as ConditionNodeData
          return (
            <>
              {field('Variable Name', (
                <input className={inputCls} placeholder="e.g. user_intent" value={cd.conditionVar || ''} onChange={(e) => set('conditionVar', e.target.value)} />
              ))}
              {field('Operator', (
                <select className={selectCls} value={cd.operator || 'equals'} onChange={(e) => set('operator', e.target.value)}>
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                  <option value="exists">exists</option>
                  <option value="not_exists">does not exist</option>
                </select>
              ))}
              {(cd.operator === 'equals' || cd.operator === 'contains') && field('Value', (
                <input className={inputCls} placeholder="e.g. booking" value={cd.value || ''} onChange={(e) => set('value', e.target.value)} />
              ))}
              <div className="bg-amber-900/20 border border-amber-700/30 rounded p-2 text-[10px] text-amber-300">
                <strong>YES</strong> path → left handle · <strong>NO</strong> path → right handle
              </div>
            </>
          )
        })()}

        {node.type === 'quickReply' && (() => {
          const qd = d as QuickReplyNodeData
          return (
            <>
              {field('Message', (
                <textarea rows={3} className={inputCls} placeholder="What would you like to do?" value={qd.message || ''} onChange={(e) => set('message', e.target.value)} />
              ))}
              {field('Quick Replies (comma separated)', (
                <input className={inputCls} placeholder="Book a service, Get a quote, Talk to us" value={qd.replies || ''} onChange={(e) => set('replies', e.target.value)} />
              ))}
            </>
          )
        })()}

        {node.type === 'action' && (() => {
          const ad = d as ActionNodeData
          return (
            <>
              {field('Action Type', (
                <select className={selectCls} value={ad.actionType || 'handoff'} onChange={(e) => set('actionType', e.target.value)}>
                  <option value="handoff">Handoff to Human Agent</option>
                  <option value="tag">Tag Customer</option>
                  <option value="set_variable">Set Variable</option>
                  <option value="end_flow">End Flow</option>
                </select>
              ))}
              {(ad.actionType === 'tag' || ad.actionType === 'set_variable') && field('Value', (
                <input className={inputCls} placeholder={ad.actionType === 'tag' ? 'Tag name' : 'variable=value'} value={ad.actionValue || ''} onChange={(e) => set('actionValue', e.target.value)} />
              ))}
            </>
          )
        })()}

        {node.type === 'cta' && field('Button Label', (
          <input className={inputCls} value={String(d.label || '')} onChange={(e) => set('label', e.target.value)} />
        ))}
      </div>
    </div>
  )
}

// ─── Flow Editor Page ────────────────────────────────────────────────────────

const DEFAULT_NODES: Node<FlowNodeData>[] = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { label: 'Start', triggerType: 'greeting', keywords: '' } as TriggerNodeData,
  },
]

const DEFAULT_EDGES: Edge[] = []

export default function FlowEditorPage() {
  const [flows, setFlows] = useState<FlowRecord[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [flowIsActive, setFlowIsActive] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(DEFAULT_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(DEFAULT_EDGES)

  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null)
  const [showPalette, setShowPalette] = useState(true)
  const [showFlowList, setShowFlowList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingFlows, setLoadingFlows] = useState(true)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [activating, setActivating] = useState(false)
  const [showNewFlowModal, setShowNewFlowModal] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowDesc, setNewFlowDesc] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const nodeIdCounter = useRef(100)

  const savedFlowRef = useRef({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES })

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const apply = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      if (mobile) setShowPalette(false)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  // ── Fetch flows ──────────────────────────────────────────────────────────
  const fetchFlows = useCallback(async () => {
    try {
      const data = await chatbotApi.getFlows()
      const list: FlowRecord[] = Array.isArray(data) ? data : (data.flows ?? [])
      setFlows(list)
      return list
    } catch {
      return []
    } finally {
      setLoadingFlows(false)
    }
  }, [])

  useEffect(() => { void fetchFlows() }, [fetchFlows])

  // ── Load flow into editor ─────────────────────────────────────────────────
  const loadFlow = useCallback((flow: FlowRecord) => {
    setSelectedFlowId(String(flow.id))
    setFlowName(flow.name ?? '')
    setFlowDescription(flow.description ?? '')
    setFlowIsActive(Boolean(flow.is_active))

    try {
      const parsed = JSON.parse(flow.flow_json ?? '{}') as { nodes?: Node<FlowNodeData>[]; edges?: Edge[] }
      const loadedNodes = (parsed.nodes ?? DEFAULT_NODES).map((n, i) => ({
        ...n,
        position: (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number')
          ? n.position
          : { x: 250, y: 50 + i * 120 },
      }))
      const loadedEdges = parsed.edges ?? DEFAULT_EDGES
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      savedFlowRef.current = { nodes: loadedNodes, edges: loadedEdges }
    } catch {
      setNodes(DEFAULT_NODES)
      setEdges(DEFAULT_EDGES)
      savedFlowRef.current = { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES }
    }
    setSelectedNode(null)
    setSaveMsg('')
    setSaveError('')
    setShowFlowList(false)
  }, [setEdges, setNodes])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#F36F21' },
      style: { stroke: '#F36F21', strokeWidth: 2 },
      animated: true,
    }, eds))
  }, [setEdges])

  // ── Add node from palette ────────────────────────────────────────────────
  const addNode = useCallback((type: string) => {
    nodeIdCounter.current += 1
    const newNode: Node<FlowNodeData> = {
      id: String(nodeIdCounter.current),
      type,
      position: { x: 150 + Math.random() * 200, y: 200 + Math.random() * 150 },
      data: defaultNodeData(type),
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  // ── Node selection ────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<FlowNodeData>) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleUpdateNodeData = useCallback((id: string, data: FlowNodeData) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data } : n))
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data } : prev)
  }, [setNodes])

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }, [setEdges, setNodes])

  // ── Save flow ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!flowName.trim()) { setSaveError('Flow name is required'); return }
    setSaving(true)
    setSaveMsg('')
    setSaveError('')
    try {
      const flowJson = JSON.stringify({ nodes, edges })
      const payload = {
        name: flowName.trim(),
        description: flowDescription.trim() || null,
        flow_json: flowJson,
        is_active: flowIsActive,
      }
      if (selectedFlowId) {
        const updated = await chatbotApi.updateFlow(selectedFlowId, payload)
        if (updated?.is_active !== undefined) setFlowIsActive(Boolean(updated.is_active))
      } else {
        const created = await chatbotApi.createFlow(payload)
        if (created?.id) setSelectedFlowId(String(created.id))
        if (created?.is_active !== undefined) setFlowIsActive(Boolean(created.is_active))
      }
      savedFlowRef.current = { nodes, edges }
      setSaveMsg('Flow saved successfully.')
      await fetchFlows()
    } catch (err) {
      setSaveError(toApiErrorMessage(err))
    } finally {
      setSaving(false)
      setTimeout(() => { setSaveMsg(''); setSaveError('') }, 3000)
    }
  }, [edges, fetchFlows, flowDescription, flowIsActive, flowName, nodes, selectedFlowId])

  // ── Activate flow ─────────────────────────────────────────────────────────
  const handleActivate = useCallback(async () => {
    if (!selectedFlowId) return
    setActivating(true)
    try {
      await chatbotApi.activateFlow(selectedFlowId)
      setFlowIsActive(true)
      setFlows((prev) => prev.map((f) => ({ ...f, is_active: String(f.id) === selectedFlowId })))
      setSaveMsg('Flow activated!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveError(toApiErrorMessage(err))
      setTimeout(() => setSaveError(''), 3000)
    } finally {
      setActivating(false)
    }
  }, [selectedFlowId])

  // ── Delete flow ───────────────────────────────────────────────────────────
  const handleDeleteFlow = useCallback(async () => {
    if (!selectedFlowId || !window.confirm('Delete this flow?')) return
    try {
      await chatbotApi.deleteFlow(selectedFlowId)
      setSelectedFlowId(null)
      setFlowName('')
      setFlowDescription('')
      setFlowIsActive(false)
      setNodes(DEFAULT_NODES)
      setEdges(DEFAULT_EDGES)
      await fetchFlows()
    } catch (err) {
      setSaveError(toApiErrorMessage(err))
    }
  }, [fetchFlows, selectedFlowId, setEdges, setNodes])

  // ── New flow ──────────────────────────────────────────────────────────────
  const handleNewFlow = useCallback(() => {
    if (!newFlowName.trim()) return
    setSelectedFlowId(null)
    setFlowName(newFlowName.trim())
    setFlowDescription(newFlowDesc.trim())
    setFlowIsActive(false)
    setNodes(DEFAULT_NODES)
    setEdges(DEFAULT_EDGES)
    savedFlowRef.current = { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES }
    setSelectedNode(null)
    setShowNewFlowModal(false)
    setNewFlowName('')
    setNewFlowDesc('')
  }, [newFlowDesc, newFlowName, setEdges, setNodes])

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0d0d1a] text-white overflow-hidden">
      {/* ── Top Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#111120] shrink-0 flex-wrap">
        {/* Flow selector */}
        <button
          onClick={() => setShowFlowList((v) => !v)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded text-sm transition-colors min-w-0"
        >
          <List className="w-4 h-4 text-brand-orange shrink-0" />
          <span className="truncate max-w-[140px]">{flowName || 'Select Flow'}</span>
          {showFlowList ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {/* Flow name edit */}
        <input
          className="bg-transparent border border-gray-700 hover:border-gray-500 focus:border-brand-orange text-white text-sm px-3 py-1.5 rounded focus:outline-none transition-colors w-40 md:w-56"
          placeholder="Flow name…"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
        />

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Active badge */}
          {flowIsActive && (
            <span className="flex items-center gap-1.5 bg-green-900/30 border border-green-700/40 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Active
            </span>
          )}

          {/* Save feedback */}
          {saveMsg && (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> {saveMsg}
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> {saveError}
            </span>
          )}

          {/* Activate */}
          {selectedFlowId && !flowIsActive && (
            <button
              onClick={() => void handleActivate()}
              disabled={activating}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
            >
              {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Activate
            </button>
          )}

          {/* New flow */}
          <button
            onClick={() => setShowNewFlowModal(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Flow
          </button>

          {/* Delete flow */}
          {selectedFlowId && (
            <button
              onClick={() => void handleDeleteFlow()}
              className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 border border-red-800 text-red-400 hover:text-red-300 text-xs font-bold px-3 py-1.5 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          {/* Save */}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Flow list dropdown overlay ──────────────────────────────── */}
        {showFlowList && (
          <div className="absolute top-0 left-0 z-30 bg-[#111120] border border-gray-700 rounded-b shadow-2xl w-72 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Flows</span>
              <button onClick={() => setShowFlowList(false)} className="text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {loadingFlows ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading…</div>
            ) : flows.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No flows yet</div>
            ) : (
              flows.map((f) => (
                <button
                  key={f.id}
                  onClick={() => loadFlow(f)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                    String(f.id) === selectedFlowId ? 'bg-brand-orange/10 border-l-2 border-l-brand-orange' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white font-medium truncate">{f.name || 'Unnamed'}</span>
                    {f.is_active && <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                  </div>
                  {f.description && <p className="text-xs text-gray-500 truncate mt-0.5">{f.description}</p>}
                </button>
              ))
            )}
            <button
              onClick={() => { setShowFlowList(false); setShowNewFlowModal(true) }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-brand-orange hover:bg-brand-orange/10 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Flow
            </button>
          </div>
        )}

        {/* ── Left Palette ────────────────────────────────────────────── */}
        <aside
          id="node-palette"
          className={`${showPalette ? 'w-48 md:w-52' : 'w-0'} shrink-0 bg-[#111120] border-r border-gray-800 flex flex-col overflow-hidden transition-all duration-200`}
        >
          <div className="px-3 py-2.5 border-b border-gray-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Node Types</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {NODE_PALETTE.map((p) => (
              <button
                key={p.type}
                onClick={() => addNode(p.type)}
                title={`Add ${p.label} node`}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded border border-gray-700 bg-gray-800/50 hover:bg-gray-700 hover:border-gray-600 transition-colors text-left group"
              >
                <span style={{ color: p.color }}>{p.icon}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-white leading-none mb-0.5">{p.label}</div>
                  <div className="text-[10px] text-gray-500 leading-none">{p.desc}</div>
                </div>
                <Plus className="w-3 h-3 text-gray-500 group-hover:text-white ml-auto shrink-0 transition-colors" />
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-800 text-[10px] text-gray-600 text-center">
            Click to add · drag to move
          </div>
        </aside>

        {/* Toggle palette */}
        <button
          onClick={() => setShowPalette((v) => !v)}
          title="Toggle palette"
          className={`absolute bottom-12 z-10 bg-gray-800 hover:bg-gray-700 border border-gray-700 border-l-0 text-gray-400 hover:text-white px-1 py-2 rounded-r transition-[left] duration-200 ${
            showPalette ? 'left-48 md:left-52' : 'left-0'
          }`}
        >
          {showPalette ? <ArrowLeft className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3 rotate-180" />}
        </button>

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#F36F21' },
              style: { stroke: '#F36F21', strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#222240" />
            <Controls className="!bg-[#111120] !border-gray-700 !rounded [&>button]:!bg-[#111120] [&>button]:!border-gray-700 [&>button:hover]:!bg-gray-700 [&>button]:!text-gray-300" />
            <MiniMap
              style={{ background: '#111120', border: '1px solid #374151' }}
              nodeColor={(n) => {
                const colors: Record<string, string> = { trigger: '#22c55e', message: '#3b82f6', condition: '#f59e0b', quickReply: '#8b5cf6', action: '#ec4899', cta: '#14b8a6' }
                return colors[n.type ?? ''] ?? '#6b7280'
              }}
            />
            <Panel position="top-right" className="text-[10px] text-gray-600">
              {nodes.length} nodes · {edges.length} connections
            </Panel>
          </ReactFlow>
        </div>

        {/* ── Right Properties Panel ───────────────────────────────── */}
        {selectedNode && (
          <aside className="absolute md:static right-0 top-0 bottom-0 z-20 w-[88vw] max-w-[20rem] md:w-64 shrink-0 bg-[#111120] border-l border-gray-800 flex flex-col overflow-hidden shadow-2xl md:shadow-none">
            <PropertiesPanel
              node={selectedNode}
              onUpdate={handleUpdateNodeData}
              onDelete={handleDeleteNode}
            />
          </aside>
        )}
      </div>

      {/* ── Description bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-800 bg-[#111120] px-4 py-2 flex items-center gap-3">
        <input
          className="flex-1 bg-transparent border-none text-xs text-gray-400 focus:outline-none placeholder-gray-700"
          placeholder="Flow description (optional)…"
          value={flowDescription}
          onChange={(e) => setFlowDescription(e.target.value)}
        />
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-gray-500 uppercase tracking-widest">Active</span>
            <button
              onClick={() => setFlowIsActive((v) => !v)}
              className={`relative w-8 h-4 rounded-full transition-colors ${flowIsActive ? 'bg-green-500' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${flowIsActive ? 'left-[1.125rem]' : 'left-0.5'}`} />
            </button>
          </label>
          <button
            onClick={() => void fetchFlows()}
            className="text-gray-500 hover:text-white transition-colors"
            title="Refresh flows"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── New Flow Modal ────────────────────────────────────────────── */}
      {showNewFlowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111120] border border-gray-700 rounded-lg shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Create New Flow</h2>
              <button onClick={() => setShowNewFlowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Flow Name *</label>
                <input
                  autoFocus
                  className="w-full bg-[#0d0d1a] border border-gray-700 focus:border-brand-orange text-white text-sm px-3 py-2.5 rounded focus:outline-none transition-colors"
                  placeholder="e.g. Welcome Flow"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNewFlow() }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Description</label>
                <input
                  className="w-full bg-[#0d0d1a] border border-gray-700 focus:border-brand-orange text-white text-sm px-3 py-2.5 rounded focus:outline-none transition-colors"
                  placeholder="Optional description"
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowNewFlowModal(false)} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleNewFlow}
                disabled={!newFlowName.trim()}
                className="bg-brand-orange hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded transition-colors"
              >
                Create Flow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Help hint when empty ─────────────────────────────────────── */}
      {nodes.length <= 1 && edges.length === 0 && !selectedFlowId && !isMobile && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 z-20 bg-[#111120] border border-gray-700 rounded-lg px-5 py-3 text-center max-w-sm shadow-xl">
          <p className="text-white font-bold text-sm mb-1">Build your first flow</p>
          <p className="text-gray-400 text-xs">Click node types on the left to add them, then drag handles to connect. Save when done.</p>
        </div>
      )}
    </div>
  )
}
