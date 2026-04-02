import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Plus, Save, Trash2, Play, ChevronDown, ChevronUp, MessageSquare,
  CheckCircle, X, Loader2, AlertCircle, List, RefreshCw,
  Globe, ArrowRight, ArrowUp, ArrowDown,
} from 'lucide-react'
import { chatbotApi, toApiErrorMessage } from '../../services/chatbotApi'

// ── Types ─────────────────────────────────────────────────────────────────────

type ValidationConfig = {
  type: 'required' | 'email' | 'regex' | 'number' | 'date' | 'year_range' | 'in_list_variable'
  error_message?: string
  pattern?: string
  min?: number
  max?: number
  list_variable?: string
}

type QuickReplyOption = {
  label: string
  value: string
  next: string
}

type FlowNode = {
  id: string
  message: string
  input_type: 'text' | 'quick_reply' | 'none'
  variable?: string
  validation?: ValidationConfig | null
  options?: QuickReplyOption[]
  next?: string | null
  http_request?: Record<string, unknown> | null
  normalize_skip?: boolean
  payload_assign?: Record<string, unknown> | null
}

type FlowDef = {
  id: string
  name: string
  trigger_keywords: string[]
  nodes: FlowNode[]
}

type FlowRecord = {
  id: string | number
  name?: string
  description?: string | null
  is_active?: boolean
  flow_json?: string
}

// ── Shared style constants ────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-[#0a0a15] border border-gray-700 text-white text-xs px-3 py-2 rounded ' +
  'focus:outline-none focus:border-brand-orange transition-colors placeholder-gray-600'
const SELECT_CLS = INPUT_CLS + ' appearance-none'
const LABEL_CLS = 'block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1'

const NODE_TYPE_CFG = {
  none:        { color: '#3b82f6', label: 'Message' },
  text:        { color: '#f59e0b', label: 'Text Input' },
  quick_reply: { color: '#8b5cf6', label: 'Quick Reply' },
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUniqueId(nodes: FlowNode[]): string {
  const ids = new Set(nodes.map((n) => n.id))
  let i = 1
  while (ids.has(`node_${i}`)) i++
  return `node_${i}`
}

function makeFlowTemplate(name: string): FlowDef {
  const slug =
    name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'new_flow'
  return {
    id: slug,
    name,
    trigger_keywords: [],
    nodes: [
      {
        id: 'node_1',
        message: 'Hello! How can I help you today?',
        input_type: 'quick_reply',
        options: [
          { label: 'Get Help',      value: 'help',  next: 'node_help' },
          { label: 'Talk to Human', value: 'human', next: 'handoff'   },
        ],
        next: null,
      },
      {
        id: 'node_help',
        message: "Great! I'll connect you with a team member shortly.",
        input_type: 'none',
        next: 'handoff',
      },
    ],
  }
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({
  node, index, selected,
  onSelect, onDelete, onMoveUp, onMoveDown,
  isFirst, isLast,
}: {
  node: FlowNode
  index: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const cfg = NODE_TYPE_CFG[node.input_type] ?? NODE_TYPE_CFG.none

  return (
    <div
      onClick={onSelect}
      className={`group relative bg-[#1a1a2e] border rounded-lg cursor-pointer transition-all ${
        selected
          ? 'border-brand-orange shadow-lg shadow-brand-orange/10'
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: `${cfg.color}12`, borderBottom: `1px solid ${cfg.color}30` }}
      >
        <span className="text-[10px] font-bold text-gray-600 w-4 text-center shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 font-mono text-[11px] font-semibold text-white truncate">
          {node.id}
        </span>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0"
          style={{ color: cfg.color, borderColor: `${cfg.color}50` }}
        >
          {cfg.label}
        </span>
        {node.http_request && (
          <Globe className="w-3 h-3 text-teal-400 shrink-0" aria-label="Has HTTP request" />
        )}
        {/* Controls visible on hover */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp() }}
            disabled={isFirst}
            className="text-gray-600 hover:text-white disabled:opacity-20 p-0.5 transition-colors"
            title="Move up"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown() }}
            disabled={isLast}
            className="text-gray-600 hover:text-white disabled:opacity-20 p-0.5 transition-colors"
            title="Move down"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-gray-600 hover:text-red-400 p-0.5 ml-0.5 transition-colors"
            title="Delete node"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-xs text-gray-300 leading-snug line-clamp-2 whitespace-pre-wrap">
          {node.message || <span className="text-gray-600 italic">No message set</span>}
        </p>
        {node.variable && (
          <p className="text-[10px] text-gray-500">
            Saves to: <span className="font-mono text-amber-400">{node.variable}</span>
          </p>
        )}
        {node.options && node.options.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {node.options.map((opt, i) => (
              <span
                key={i}
                className="flex items-center gap-1 bg-purple-900/25 border border-purple-700/30
                           text-purple-200 text-[10px] px-1.5 py-0.5 rounded-full"
              >
                {opt.label || '(empty)'}
                <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                <span className="font-mono text-purple-300">{opt.next || '?'}</span>
              </span>
            ))}
          </div>
        )}
        {node.next && (
          <p className="flex items-center gap-1 text-[10px]">
            <ArrowRight className="w-3 h-3 text-brand-orange shrink-0" />
            <span className="font-mono text-brand-orange/80">{node.next}</span>
          </p>
        )}
      </div>
    </div>
  )
}

// ── NodeEditPanel ─────────────────────────────────────────────────────────────

function NodeEditPanel({
  node,
  allNodeIds,
  onUpdate,
  onClose,
}: {
  node: FlowNode
  allNodeIds: string[]
  onUpdate: (updated: FlowNode) => void
  onClose: () => void
}) {
  const [local, setLocal]           = useState<FlowNode>(node)
  const [idDraft, setIdDraft]       = useState(node.id)
  const [httpRaw, setHttpRaw]       = useState(
    node.http_request ? JSON.stringify(node.http_request, null, 2) : ''
  )
  const [httpErr, setHttpErr]         = useState('')
  const [payloadRaw, setPayloadRaw] = useState(
    node.payload_assign ? JSON.stringify(node.payload_assign, null, 2) : ''
  )
  const [payloadErr, setPayloadErr]   = useState('')
  const [showHttp, setShowHttp]       = useState(!!node.http_request)
  const [showPayload, setShowPayload] = useState(!!node.payload_assign)

  // Keep a live ref to onUpdate so the effect never uses a stale closure
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate })

  // Propagate every local change to the parent (skip the initial mount)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    onUpdateRef.current(local)
  }, [local])

  function set<K extends keyof FlowNode>(key: K, value: FlowNode[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }

  function setInputType(type: FlowNode['input_type']) {
    setLocal((prev) => ({
      ...prev,
      input_type: type,
      ...(type !== 'text'        ? { variable: undefined, validation: null, normalize_skip: undefined } : {}),
      ...(type !== 'quick_reply' ? { options: [] }                                                       : {}),
    }))
  }

  function setValidationType(vtype: string) {
    if (!vtype) { set('validation', null); return }
    setLocal((prev) => ({
      ...prev,
      validation: {
        type: vtype as ValidationConfig['type'],
        error_message: prev.validation?.error_message,
      },
    }))
  }

  function setValidationField<K extends keyof ValidationConfig>(key: K, value: ValidationConfig[K]) {
    setLocal((prev) => ({
      ...prev,
      validation: { ...(prev.validation as ValidationConfig), [key]: value },
    }))
  }

  function addOption() {
    setLocal((prev) => ({
      ...prev,
      options: [...(prev.options ?? []), { label: '', value: '', next: '' }],
    }))
  }

  function updateOption(i: number, key: keyof QuickReplyOption, value: string) {
    setLocal((prev) => {
      const opts = [...(prev.options ?? [])]
      opts[i] = { ...opts[i], [key]: value }
      if (key === 'label' && !opts[i].value) {
        const generated = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        opts[i].value = generated || `opt_${i + 1}`
      }
      return { ...prev, options: opts }
    })
  }

  function removeOption(i: number) {
    setLocal((prev) => ({
      ...prev,
      options: (prev.options ?? []).filter((_, idx) => idx !== i),
    }))
  }

  function handleHttpChange(raw: string) {
    setHttpRaw(raw)
    if (!raw.trim()) { setHttpErr(''); set('http_request', null); return }
    try   { set('http_request', JSON.parse(raw) as Record<string, unknown>); setHttpErr('') }
    catch (e) { setHttpErr((e as Error).message) }
  }

  function handlePayloadChange(raw: string) {
    setPayloadRaw(raw)
    if (!raw.trim()) { setPayloadErr(''); set('payload_assign', null); return }
    try   { set('payload_assign', JSON.parse(raw) as Record<string, unknown>); setPayloadErr('') }
    catch (e) { setPayloadErr((e as Error).message) }
  }

  const v          = local.validation
  const datalistId = `nl-${local.id}`

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">
          Edit Node
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <datalist id={datalistId}>
        {allNodeIds.map((id) => <option key={id} value={id} />)}
        <option value="handoff" />
      </datalist>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Node ID */}
        <div>
          <label className={LABEL_CLS}>Node ID</label>
          <input
            className={INPUT_CLS + ' font-mono'}
            value={idDraft}
            onChange={(e) => setIdDraft(e.target.value)}
            onBlur={() => {
              const t = idDraft.trim()
              if (t && t !== local.id) set('id', t)
              else setIdDraft(local.id)
            }}
            placeholder="e.g. node_welcome"
          />
          <p className="text-[10px] text-gray-600 mt-1">
            Other nodes reference this ID. Rename with care.
          </p>
        </div>

        {/* Message */}
        <div>
          <label className={LABEL_CLS}>Message</label>
          <textarea
            rows={3}
            className={INPUT_CLS}
            value={local.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="Type the message to send to the user..."
          />
        </div>

        {/* Input Type */}
        <div>
          <label className={LABEL_CLS}>Input Type</label>
          <select
            className={SELECT_CLS}
            value={local.input_type}
            onChange={(e) => setInputType(e.target.value as FlowNode['input_type'])}
          >
            <option value="none">None – send message only</option>
            <option value="text">Text – collect user input</option>
            <option value="quick_reply">Quick Reply – show buttons</option>
          </select>
        </div>

        {/* Text input fields */}
        {local.input_type === 'text' && (
          <>
            <div>
              <label className={LABEL_CLS}>Store Response In (variable)</label>
              <input
                className={INPUT_CLS + ' font-mono'}
                value={local.variable ?? ''}
                onChange={(e) => set('variable', e.target.value || undefined)}
                placeholder="e.g. user_name"
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Validation</label>
              <select
                className={SELECT_CLS + ' mb-2'}
                value={v?.type ?? ''}
                onChange={(e) => setValidationType(e.target.value)}
              >
                <option value="">None</option>
                <option value="required">Required</option>
                <option value="email">Email</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="regex">Regex Pattern</option>
                <option value="year_range">Year Range</option>
                <option value="in_list_variable">In List Variable</option>
              </select>

              {v && (
                <div className="space-y-2 pl-2 border-l-2 border-gray-700">
                  {v.type === 'regex' && (
                    <input
                      className={INPUT_CLS + ' font-mono'}
                      placeholder="Pattern e.g. ^\d+$"
                      value={v.pattern ?? ''}
                      onChange={(e) => setValidationField('pattern', e.target.value)}
                    />
                  )}
                  {v.type === 'year_range' && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className={INPUT_CLS}
                        placeholder="Min year"
                        value={v.min ?? ''}
                        onChange={(e) => setValidationField('min', Number(e.target.value))}
                      />
                      <input
                        type="number"
                        className={INPUT_CLS}
                        placeholder="Max year"
                        value={v.max ?? ''}
                        onChange={(e) => setValidationField('max', Number(e.target.value))}
                      />
                    </div>
                  )}
                  {v.type === 'in_list_variable' && (
                    <input
                      className={INPUT_CLS + ' font-mono'}
                      placeholder="List variable name"
                      value={v.list_variable ?? ''}
                      onChange={(e) => setValidationField('list_variable', e.target.value)}
                    />
                  )}
                  <input
                    className={INPUT_CLS}
                    placeholder="Error message (optional)"
                    value={v.error_message ?? ''}
                    onChange={(e) =>
                      setValidationField('error_message', e.target.value || undefined)
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => set('normalize_skip', !local.normalize_skip)}
                className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
                  local.normalize_skip ? 'bg-brand-orange' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    local.normalize_skip ? 'left-[1.125rem]' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="text-xs text-gray-400">Accept "skip" as no input</span>
            </div>
          </>
        )}

        {/* Quick-reply options */}
        {local.input_type === 'quick_reply' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={LABEL_CLS + ' mb-0'}>Options</label>
              <button
                onClick={addOption}
                className="flex items-center gap-1 text-[11px] text-brand-orange
                           hover:text-orange-400 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {(local.options ?? []).length === 0 && (
                <p className="text-[11px] text-gray-600 italic">No options yet – click Add.</p>
              )}
              {(local.options ?? []).map((opt, i) => (
                <div
                  key={i}
                  className="bg-[#0d0d1a] border border-gray-700 rounded p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1">
                    <input
                      className={INPUT_CLS + ' flex-1'}
                      placeholder="Label (shown to user)"
                      value={opt.label}
                      onChange={(e) => updateOption(i, 'label', e.target.value)}
                    />
                    <button
                      onClick={() => removeOption(i)}
                      className="text-gray-600 hover:text-red-400 p-1 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className={INPUT_CLS + ' font-mono'}
                    placeholder="Value (internal key)"
                    value={opt.value}
                    onChange={(e) => updateOption(i, 'value', e.target.value)}
                  />
                  <input
                    list={datalistId}
                    className={INPUT_CLS + ' font-mono'}
                    placeholder="Next node ID or handoff"
                    value={opt.next}
                    onChange={(e) => updateOption(i, 'next', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next node */}
        <div>
          <label className={LABEL_CLS}>Next Node</label>
          <input
            list={datalistId}
            className={INPUT_CLS + ' font-mono'}
            value={local.next ?? ''}
            onChange={(e) => set('next', e.target.value || null)}
            placeholder='Node ID, "handoff", or leave blank'
          />
          <p className="text-[10px] text-gray-600 mt-1">
            Use <code className="text-gray-400">handoff</code> to transfer to a human agent.
          </p>
        </div>

        {/* HTTP Request (collapsible) */}
        <div>
          <button
            onClick={() => setShowHttp((prev) => !prev)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white
                       transition-colors w-full"
          >
            <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="font-bold uppercase tracking-widest text-[11px]">HTTP Request</span>
            {showHttp
              ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
              : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showHttp && (
            <div className="mt-2 space-y-1">
              <textarea
                rows={8}
                className={INPUT_CLS + ' font-mono text-[11px] leading-relaxed'}
                value={httpRaw}
                onChange={(e) => handleHttpChange(e.target.value)}
                placeholder={'{\n  "method": "GET",\n  "url": "https://api.example.com/data",\n  "response_variable": "result"\n}'}
                spellCheck={false}
              />
              {httpErr && (
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {httpErr}
                </p>
              )}
              {httpRaw && !httpErr && (
                <button
                  onClick={() => { setHttpRaw(''); set('http_request', null) }}
                  className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Payload Assign (collapsible) */}
        <div>
          <button
            onClick={() => setShowPayload((prev) => !prev)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white
                       transition-colors w-full"
          >
            <span className="font-bold uppercase tracking-widest text-[11px]">Payload Assign</span>
            {showPayload
              ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
              : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showPayload && (
            <div className="mt-2 space-y-1">
              <textarea
                rows={5}
                className={INPUT_CLS + ' font-mono text-[11px] leading-relaxed'}
                value={payloadRaw}
                onChange={(e) => handlePayloadChange(e.target.value)}
                placeholder={'{\n  "service_id": ["service_id", "serviceId"]\n}'}
                spellCheck={false}
              />
              {payloadErr && (
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {payloadErr}
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── FlowEditorPage ────────────────────────────────────────────────────────────

export default function FlowEditorPage() {
  const [flows, setFlows]               = useState<FlowRecord[]>([])
  const [loadingFlows, setLoadingFlows] = useState(true)
  const [showFlowList, setShowFlowList] = useState(false)

  const [selectedFlowId, setSelectedFlowId]   = useState<string | null>(null)
  const [flowName, setFlowName]               = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [flowIsActive, setFlowIsActive]       = useState(false)
  const [flowDef, setFlowDef]                 = useState<FlowDef>(makeFlowTemplate('New Flow'))

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Ref keeps the selected id current inside updateNode without adding it to deps
  const selectedNodeIdRef = useRef<string | null>(null)
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId }, [selectedNodeId])

  const [saving, setSaving]         = useState(false)
  const [activating, setActivating] = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const [saveError, setSaveError]   = useState('')

  const [showNewFlowModal, setShowNewFlowModal] = useState(false)
  const [newFlowName, setNewFlowName]           = useState('')
  const [newFlowDesc, setNewFlowDesc]           = useState('')

  const selectedNode = flowDef.nodes.find((n) => n.id === selectedNodeId) ?? null
  const allNodeIds   = flowDef.nodes.map((n) => n.id)

  // ── Fetch flow list ────────────────────────────────────────────────────────
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

  // ── Load a flow into the editor ────────────────────────────────────────────
  const loadFlow = useCallback((flow: FlowRecord) => {
    setSelectedFlowId(String(flow.id))
    setFlowName(flow.name ?? '')
    setFlowDescription(flow.description ?? '')
    setFlowIsActive(Boolean(flow.is_active))
    setSelectedNodeId(null)
    setSaveMsg('')
    setSaveError('')
    setShowFlowList(false)
    try {
      const parsed = JSON.parse(flow.flow_json ?? '{}') as Partial<FlowDef>
      setFlowDef({
        id:               parsed.id               ?? 'flow',
        name:             parsed.name             ?? flow.name ?? '',
        trigger_keywords: Array.isArray(parsed.trigger_keywords) ? parsed.trigger_keywords : [],
        nodes:            Array.isArray(parsed.nodes)            ? parsed.nodes            : [],
      })
    } catch {
      setFlowDef(makeFlowTemplate(flow.name ?? 'Flow'))
    }
  }, [])

  // ── Node CRUD ──────────────────────────────────────────────────────────────
  const addNode = useCallback(() => {
    let newId = ''
    setFlowDef((prev) => {
      newId = makeUniqueId(prev.nodes)
      const node: FlowNode = { id: newId, message: '', input_type: 'none', next: null }
      return { ...prev, nodes: [...prev.nodes, node] }
    })
    // Select the new node after state settles
    setTimeout(() => setSelectedNodeId(newId), 0)
  }, [])

  const updateNode = useCallback((updated: FlowNode) => {
    setFlowDef((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === selectedNodeIdRef.current ? updated : n
      ),
    }))
    if (updated.id !== selectedNodeIdRef.current) {
      setSelectedNodeId(updated.id)
    }
  }, [])

  const deleteNode = useCallback((id: string) => {
    if (!window.confirm('Delete this node?')) return
    setFlowDef((prev) => ({ ...prev, nodes: prev.nodes.filter((n) => n.id !== id) }))
    setSelectedNodeId((prev) => (prev === id ? null : prev))
  }, [])

  const moveNode = useCallback((id: string, dir: 'up' | 'down') => {
    setFlowDef((prev) => {
      const nodes = [...prev.nodes]
      const idx   = nodes.findIndex((n) => n.id === id)
      if (idx < 0) return prev
      const swap  = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= nodes.length) return prev
      ;[nodes[idx], nodes[swap]] = [nodes[swap], nodes[idx]]
      return { ...prev, nodes }
    })
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!flowName.trim()) { setSaveError('Flow name is required'); return }
    setSaving(true)
    setSaveMsg('')
    setSaveError('')
    try {
      const def: FlowDef = { ...flowDef, name: flowName.trim() }
      const payload = {
        name:        flowName.trim(),
        description: flowDescription.trim() || null,
        flow_json:   JSON.stringify(def),
        is_active:   flowIsActive,
      }
      if (selectedFlowId) {
        const updated = await chatbotApi.updateFlow(selectedFlowId, payload)
        if (updated?.is_active !== undefined) setFlowIsActive(Boolean(updated.is_active))
      } else {
        const created = await chatbotApi.createFlow(payload)
        if (created?.id) setSelectedFlowId(String(created.id))
        if (created?.is_active !== undefined) setFlowIsActive(Boolean(created.is_active))
      }
      setSaveMsg('Saved!')
      await fetchFlows()
    } catch (err) {
      type ErrResp = { response?: { data?: { detail?: { errors?: string[] } | string } } }
      const detail = (err as ErrResp)?.response?.data?.detail
      const errors = detail && typeof detail === 'object'
        ? (detail as { errors?: string[] }).errors
        : undefined
      if (Array.isArray(errors)) {
        setSaveError(`Validation: ${errors.join(' · ')}`)
      } else {
        setSaveError(toApiErrorMessage(err))
      }
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }, [fetchFlows, flowDef, flowDescription, flowIsActive, flowName, selectedFlowId])

  // ── Activate ───────────────────────────────────────────────────────────────
  const handleActivate = useCallback(async () => {
    if (!selectedFlowId) return
    setActivating(true)
    try {
      await chatbotApi.activateFlow(selectedFlowId)
      setFlowIsActive(true)
      setFlows((prev) => prev.map((f) => ({ ...f, is_active: String(f.id) === selectedFlowId })))
      setSaveMsg('Activated!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveError(toApiErrorMessage(err))
      setTimeout(() => setSaveError(''), 3000)
    } finally {
      setActivating(false)
    }
  }, [selectedFlowId])

  // ── Delete flow ────────────────────────────────────────────────────────────
  const handleDeleteFlow = useCallback(async () => {
    if (!selectedFlowId || !window.confirm('Delete this flow? This cannot be undone.')) return
    try {
      await chatbotApi.deleteFlow(selectedFlowId)
      setSelectedFlowId(null)
      setFlowName('')
      setFlowDescription('')
      setFlowIsActive(false)
      setFlowDef(makeFlowTemplate('New Flow'))
      setSelectedNodeId(null)
      setSaveMsg('')
      setSaveError('')
      await fetchFlows()
    } catch (err) {
      setSaveError(toApiErrorMessage(err))
    }
  }, [fetchFlows, selectedFlowId])

  // ── New flow ───────────────────────────────────────────────────────────────
  const handleNewFlow = useCallback(() => {
    if (!newFlowName.trim()) return
    setSelectedFlowId(null)
    setFlowName(newFlowName.trim())
    setFlowDescription(newFlowDesc.trim())
    setFlowIsActive(false)
    setFlowDef(makeFlowTemplate(newFlowName.trim()))
    setSelectedNodeId(null)
    setSaveMsg('')
    setSaveError('')
    setShowNewFlowModal(false)
    setNewFlowName('')
    setNewFlowDesc('')
  }, [newFlowDesc, newFlowName])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0d0d1a] text-white overflow-hidden">

      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#111120] shrink-0 flex-wrap">
        <button
          onClick={() => setShowFlowList((v) => !v)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700
                     px-3 py-1.5 rounded text-sm transition-colors min-w-0"
        >
          <List className="w-4 h-4 text-brand-orange shrink-0" />
          <span className="truncate max-w-[140px]">{flowName || 'Select Flow'}</span>
          {showFlowList
            ? <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        <input
          className="bg-transparent border border-gray-700 hover:border-gray-500
                     focus:border-brand-orange text-white text-sm px-3 py-1.5 rounded
                     focus:outline-none transition-colors w-40 md:w-56"
          placeholder="Flow name..."
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
        />

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {flowIsActive && (
            <span className="flex items-center gap-1.5 bg-green-900/30 border border-green-700/40
                             text-green-400 text-xs font-bold px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Active
            </span>
          )}

          {saveMsg && (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> {saveMsg}
            </span>
          )}
          {saveError && (
            <span
              className="flex items-center gap-1.5 text-red-400 text-xs font-medium max-w-xs truncate"
              title={saveError}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {saveError}
            </span>
          )}

          {selectedFlowId && !flowIsActive && (
            <button
              onClick={() => void handleActivate()}
              disabled={activating}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50
                         text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
            >
              {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Activate
            </button>
          )}

          <button
            onClick={() => setShowNewFlowModal(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white
                       text-xs font-bold px-3 py-1.5 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>

          {selectedFlowId && (
            <button
              onClick={() => void handleDeleteFlow()}
              className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 border border-red-800
                         text-red-400 hover:text-red-300 text-xs font-bold px-3 py-1.5 rounded
                         transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-500
                       disabled:opacity-60 text-white text-xs font-bold px-4 py-1.5 rounded
                       transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* Trigger keywords strip */}
      <div className="shrink-0 border-b border-gray-800 bg-[#111120] px-4 py-2 flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600 shrink-0">
          Triggers
        </span>
        <input
          className="flex-1 bg-transparent border-none text-xs text-gray-300 focus:outline-none
                     placeholder-gray-700"
          placeholder="Comma-separated trigger keywords (e.g. hello, hi, start)"
          value={flowDef.trigger_keywords.join(', ')}
          onChange={(e) => {
            const kws = e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
            setFlowDef((prev) => ({ ...prev, trigger_keywords: kws }))
          }}
        />
        <button
          onClick={() => void fetchFlows()}
          className="text-gray-600 hover:text-white transition-colors shrink-0"
          title="Refresh flow list"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Flow list dropdown overlay */}
        {showFlowList && (
          <div className="absolute top-0 left-0 z-30 bg-[#111120] border border-gray-700
                          rounded-b shadow-2xl w-72 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Your Flows
              </span>
              <button onClick={() => setShowFlowList(false)} className="text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {loadingFlows ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : flows.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No flows yet</div>
            ) : (
              flows.map((f) => (
                <button
                  key={f.id}
                  onClick={() => loadFlow(f)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800
                              hover:bg-gray-800 transition-colors ${
                    String(f.id) === selectedFlowId
                      ? 'bg-brand-orange/10 border-l-2 border-l-brand-orange'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white font-medium truncate">
                      {f.name || 'Unnamed'}
                    </span>
                    {f.is_active && <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                  </div>
                  {f.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{f.description}</p>
                  )}
                </button>
              ))
            )}
            <button
              onClick={() => { setShowFlowList(false); setShowNewFlowModal(true) }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-brand-orange
                         hover:bg-brand-orange/10 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Flow
            </button>
          </div>
        )}

        {/* Node cards */}
        <div className="flex-1 overflow-y-auto p-4">
          {flowDef.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <MessageSquare className="w-12 h-12 text-gray-700 mb-4" />
              <p className="text-gray-400 font-medium mb-1">No nodes yet</p>
              <p className="text-gray-600 text-sm mb-6">
                Add your first node to start building the flow.
              </p>
              <button
                onClick={addNode}
                className="flex items-center gap-2 bg-brand-orange hover:bg-orange-500
                           text-white font-bold px-5 py-2.5 rounded transition-colors"
              >
                <Plus className="w-4 h-4" /> Add First Node
              </button>
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-3">
              {flowDef.nodes.map((node, index) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  index={index}
                  selected={selectedNodeId === node.id}
                  onSelect={() =>
                    setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
                  }
                  onDelete={() => deleteNode(node.id)}
                  onMoveUp={() => moveNode(node.id, 'up')}
                  onMoveDown={() => moveNode(node.id, 'down')}
                  isFirst={index === 0}
                  isLast={index === flowDef.nodes.length - 1}
                />
              ))}

              <button
                onClick={addNode}
                className="w-full flex items-center justify-center gap-2 border border-dashed
                           border-gray-700 hover:border-brand-orange/50 hover:bg-brand-orange/5
                           text-gray-500 hover:text-brand-orange text-sm py-3 rounded-lg
                           transition-all"
              >
                <Plus className="w-4 h-4" /> Add Node
              </button>
            </div>
          )}
        </div>

        {/* Node edit panel */}
        {selectedNode && (
          <aside
            className="absolute md:static right-0 top-0 bottom-0 z-20
                       w-[90vw] max-w-[22rem] md:w-80 shrink-0
                       bg-[#111120] border-l border-gray-800 flex flex-col
                       overflow-hidden shadow-2xl md:shadow-none"
          >
            <NodeEditPanel
              key={selectedNodeId ?? undefined}
              node={selectedNode}
              allNodeIds={allNodeIds}
              onUpdate={updateNode}
              onClose={() => setSelectedNodeId(null)}
            />
          </aside>
        )}
      </div>

      {/* Description bar */}
      <div className="shrink-0 border-t border-gray-800 bg-[#111120] px-4 py-2 flex items-center gap-3">
        <input
          className="flex-1 bg-transparent border-none text-xs text-gray-400 focus:outline-none
                     placeholder-gray-700"
          placeholder="Flow description (optional)..."
          value={flowDescription}
          onChange={(e) => setFlowDescription(e.target.value)}
        />
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="text-[11px] text-gray-500 uppercase tracking-widest">Active</span>
          <button
            onClick={() => setFlowIsActive((v) => !v)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              flowIsActive ? 'bg-green-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                flowIsActive ? 'left-[1.125rem]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* New Flow modal */}
      {showNewFlowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                        bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111120] border border-gray-700 rounded-lg shadow-2xl
                          w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Create New Flow</h2>
              <button
                onClick={() => setShowNewFlowModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest
                                   text-gray-400 mb-1.5">
                  Flow Name *
                </label>
                <input
                  autoFocus
                  className="w-full bg-[#0d0d1a] border border-gray-700 focus:border-brand-orange
                             text-white text-sm px-3 py-2.5 rounded focus:outline-none
                             transition-colors"
                  placeholder="e.g. Booking Flow"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNewFlow() }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest
                                   text-gray-400 mb-1.5">
                  Description
                </label>
                <input
                  className="w-full bg-[#0d0d1a] border border-gray-700 focus:border-brand-orange
                             text-white text-sm px-3 py-2.5 rounded focus:outline-none
                             transition-colors"
                  placeholder="Optional description"
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewFlowModal(false)}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNewFlow}
                disabled={!newFlowName.trim()}
                className="bg-brand-orange hover:bg-orange-500 disabled:opacity-50
                           text-white text-sm font-bold px-5 py-2 rounded transition-colors"
              >
                Create Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
