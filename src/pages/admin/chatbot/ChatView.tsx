import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { chatbotApi, toApiErrorMessage } from '../../../services/chatbotApi'
import { useAuth } from '../../../context/AuthContext'
import { useSettings } from '../../../hooks/useSettings'

const STATUS_COLORS = {
  bot: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  human: 'bg-brand-orange/20 text-orange-200 border border-brand-orange/30',
  closed: 'bg-gray-700/60 text-gray-300 border border-gray-600',
}

type ChatViewProps = {
  sessionId: string | null
  onDeleteConversation?: (sessionId: string) => Promise<void> | void
}

type ConversationMessage = {
  id?: string
  sender?: string
  content?: string
  text?: string
  metadata_json?: string
  metadata?: { agent_name?: string }
  created_at?: string
}

type ConversationDetail = {
  status?: keyof typeof STATUS_COLORS | string
  messages?: ConversationMessage[]
  variables?: Record<string, string | number | boolean | null>
}

type PresenceState = {
  customer_typing: boolean
  agent_typing: boolean
  customer_last_read_at?: string
  agent_last_read_at?: string
}

type ProfileForm = {
  name: string
  email: string
  phone: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: string
}

type AppointmentAction = {
  id: number
  action: 'reschedule' | 'cancel'
  requested_date?: string | null
  requested_time?: string | null
  reason?: string | null
  status: string
  created_at: string
}

function getAgentName(msg: ConversationMessage): string | null {
  if (msg.metadata?.agent_name) return msg.metadata.agent_name
  if (!msg.metadata_json) return null
  try {
    const parsed = JSON.parse(msg.metadata_json) as { agent_name?: string }
    return parsed.agent_name || null
  } catch {
    return null
  }
}

export default function ChatView({ sessionId, onDeleteConversation }: ChatViewProps) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [appointmentActions, setAppointmentActions] = useState<AppointmentAction[]>([])
  const [actionsLoading, setActionsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [presence, setPresence] = useState<PresenceState | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
    email: '',
    phone: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
  })
  const [showProfile, setShowProfile] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const prevMessageCountRef = useRef(0)

  const formatMessageTime = useCallback((value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  const fetchConversation = useCallback(async (isInitial = false) => {
    if (!sessionId) return
    if (isInitial) setLoading(true)
    try {
      const data = await chatbotApi.getConversation(sessionId)
      setConversation(data)
      if (isInitial) setErrorMessage(null)
    } catch (error) {
      console.error('Failed to fetch conversation', error)
      if (isInitial) setErrorMessage('Failed to load conversation.')
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [sessionId])

  const fetchAppointmentActions = useCallback(async () => {
    if (!sessionId) return
    setActionsLoading(true)
    try {
      const data = await chatbotApi.getAppointmentActions(sessionId, 10)
      setAppointmentActions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch appointment actions', error)
      setAppointmentActions([])
    } finally {
      setActionsLoading(false)
    }
  }, [sessionId])

  const syncPresenceAndProfile = useCallback(async () => {
    if (!sessionId) return

    const [presenceResult, profileResult] = await Promise.allSettled([
      chatbotApi.getPresence(sessionId),
      chatbotApi.getCustomerProfile(sessionId),
    ])

    if (presenceResult.status === 'fulfilled' && presenceResult.value) {
      setPresence(presenceResult.value)
    } else if (presenceResult.status === 'rejected') {
      console.error('Failed to fetch chat presence', presenceResult.reason)
    }

    if (profileResult.status === 'fulfilled' && profileResult.value) {
      const profileData = profileResult.value
      setProfileForm({
        name: String(profileData.name || ''),
        email: String(profileData.email || ''),
        phone: String(profileData.phone || ''),
        vehicle_make: String(profileData.vehicle_make || ''),
        vehicle_model: String(profileData.vehicle_model || ''),
        vehicle_year: String(profileData.vehicle_year || ''),
      })
    } else if (profileResult.status === 'rejected') {
      console.error('Failed to fetch customer profile', profileResult.reason)
    }

    chatbotApi.markRead(sessionId, 'agent').catch((error) => {
      console.error('Failed to mark messages as read', error)
    })
  }, [sessionId])

  useEffect(() => {
    setConversation(null)
    setInputValue('')
    setErrorMessage(null)
    setPresence(null)
    if (!sessionId) return

    void fetchConversation(true)
    void fetchAppointmentActions()
    void syncPresenceAndProfile()

    const interval = setInterval(() => {
      if (document.hidden) return
      void Promise.all([
        fetchConversation(false),
        syncPresenceAndProfile(),
      ])
    }, settings.pollingInterval)

    return () => clearInterval(interval)
  }, [sessionId, fetchConversation, fetchAppointmentActions, settings.pollingInterval, syncPresenceAndProfile])

  const effectiveAgentName = user?.role === 'admin' ? user.name : null

  useEffect(() => {
    return () => {
      if (!sessionId) return
      chatbotApi.setPresence(sessionId, 'agent', false).catch((error) => {
        console.error('Failed to clear agent presence', error)
      })
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || conversation?.status !== 'human') return

    const isTypingNow = inputValue.trim().length > 0
    const timer = setTimeout(() => {
      chatbotApi.setPresence(sessionId, 'agent', isTypingNow).catch((error) => {
        console.error('Failed to update typing presence', error)
      })
    }, 250)

    return () => clearTimeout(timer)
  }, [inputValue, sessionId, conversation?.status])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [conversation?.messages])

  useEffect(() => {
    if (!sessionId) return
    setShowProfile(false)
    setShowActions(false)
  }, [sessionId])

  const handleTakeover = useCallback(async () => {
    if (!sessionId) return
    try {
      await chatbotApi.takeover(sessionId)
      setErrorMessage(null)
      fetchConversation(false)
    } catch (e) {
      setErrorMessage(toApiErrorMessage(e))
    }
  }, [sessionId, fetchConversation])

  const handleRelease = useCallback(async () => {
    if (!sessionId) return
    try {
      await chatbotApi.release(sessionId)
      setErrorMessage(null)
      fetchConversation(false)
    } catch (e) {
      setErrorMessage(toApiErrorMessage(e))
    }
  }, [sessionId, fetchConversation])

  const handleSend = useCallback(async () => {
    if (!sessionId) return
    const text = inputValue.trim()
    if (!text || !effectiveAgentName || isSending) return
    setIsSending(true)
    try {
      await chatbotApi.adminReply(sessionId, text, null, effectiveAgentName)
      setInputValue('')
      chatbotApi.setPresence(sessionId, 'agent', false).catch((error) => {
        console.error('Failed to clear typing presence', error)
      })
      chatbotApi.markRead(sessionId, 'agent').catch((error) => {
        console.error('Failed to mark reply as read', error)
      })
      setErrorMessage(null)
      fetchConversation(false)
    } catch (e) {
      setErrorMessage(toApiErrorMessage(e))
    } finally {
      setIsSending(false)
    }
  }, [inputValue, effectiveAgentName, isSending, sessionId, fetchConversation])

  const handleSaveProfile = useCallback(async () => {
    if (!sessionId || isSavingProfile) return
    setIsSavingProfile(true)
    try {
      await chatbotApi.upsertCustomerProfile(sessionId, profileForm)
      setErrorMessage(null)
    } catch (e) {
      setErrorMessage(toApiErrorMessage(e))
    } finally {
      setIsSavingProfile(false)
    }
  }, [sessionId, isSavingProfile, profileForm])

  const handleDeleteConversation = useCallback(async () => {
    if (!sessionId || isDeleting) return
    const ok = window.confirm('Delete this conversation? This cannot be undone.')
    if (!ok) return

    setIsDeleting(true)
    try {
      await chatbotApi.deleteConversation(sessionId)
      setErrorMessage(null)
      await onDeleteConversation?.(sessionId)
    } catch (e) {
      setErrorMessage(toApiErrorMessage(e))
    } finally {
      setIsDeleting(false)
    }
  }, [sessionId, isDeleting, onDeleteConversation])

  const handleCloseConversation = useCallback(async () => {
    if (!sessionId || isClosing) return
    setIsClosing(true)
    try {
      await chatbotApi.closeConversation(sessionId)
      setErrorMessage(null)
      await fetchConversation(false)
    } catch (e) {
      setErrorMessage(toApiErrorMessage(e))
    } finally {
      setIsClosing(false)
    }
  }, [sessionId, isClosing, fetchConversation])

  const resizeComposer = useCallback(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  useEffect(() => {
    resizeComposer()
  }, [inputValue, resizeComposer])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (settings.sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, settings.sendOnEnter]
  )

  const playNotificationTone = useCallback(() => {
    if (!settings.soundEnabled) return

    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return

      const ctx = new Ctx()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)

      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.18)

      oscillator.onended = () => {
        void ctx.close()
      }
    } catch (error) {
      console.error('Failed to play message tone', error)
    }
  }, [settings.soundEnabled])

  useEffect(() => {
    const messages = conversation?.messages || []
    const count = messages.length
    if (prevMessageCountRef.current === 0) {
      prevMessageCountRef.current = count
      return
    }

    if (count > prevMessageCountRef.current) {
      const newMessages = messages.slice(prevMessageCountRef.current)
      const shouldPlaySound = newMessages.some((msg) => msg.sender === 'bot' || msg.sender === 'human')
      if (shouldPlaySound) {
        playNotificationTone()
      }
    }

    prevMessageCountRef.current = count
  }, [conversation?.messages, playNotificationTone])

  if (!sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500">
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#CBD5E1" className="mx-auto mb-3">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
          <p className="text-sm">Select a conversation</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500">
        <p className="text-sm">Loading...</p>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-red-500">
        <p className="text-sm font-medium">Failed to load conversation.</p>
      </div>
    )
  }

  const status = (conversation.status || 'bot') as keyof typeof STATUS_COLORS
  const statusColors = STATUS_COLORS[status] || STATUS_COLORS.closed
  const messages = conversation.messages || []
  const variables = conversation.variables || {}
  const variableKeys = Object.keys(variables)
  const canSend = status === 'human'
  const canReplyAsAgent = canSend && !!effectiveAgentName

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-b from-brand-dark to-brand-darker">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-800 bg-brand-darker/95 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs font-semibold text-gray-100 sm:text-sm">
            {sessionId}
          </div>
          {variableKeys.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {variableKeys.map((key) => (
                <span
                  key={key}
                  className="rounded-sm bg-gray-800 px-2 py-0.5 text-[11px] text-gray-200"
                >
                  {key}: {String(variables[key])}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors}`}>
          {status}
        </span>
        {presence?.customer_typing && (
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
            Customer typing...
          </span>
        )}
        {status === 'bot' && (
          <button
            onClick={handleTakeover}
            className="rounded-sm bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-sm transition hover:bg-orange-600"
          >
            Take Over
          </button>
        )}
        {status === 'human' && (
          <button
            onClick={handleRelease}
            className="rounded-sm bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-sm transition hover:bg-emerald-500"
          >
            Release to Bot
          </button>
        )}
        {status !== 'closed' && (
          <button
            onClick={handleCloseConversation}
            disabled={isClosing}
            className={`rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition ${
              isClosing ? 'cursor-not-allowed bg-gray-500' : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            {isClosing ? 'Closing...' : 'Close'}
          </button>
        )}
        <button
          onClick={handleDeleteConversation}
          disabled={isDeleting}
          className={`rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition ${
            isDeleting ? 'cursor-not-allowed bg-red-400/70' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {errorMessage && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="border-b border-gray-800 bg-brand-dark/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowProfile((prev) => !prev)}
            className={`rounded-sm border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest transition ${
              showProfile
                ? 'border-brand-orange/60 bg-brand-orange/10 text-brand-orange'
                : 'border-gray-700 text-gray-300 hover:bg-gray-800/70'
            }`}
          >
            {showProfile ? 'Hide Profile' : 'Customer Profile'}
          </button>
          <button
            type="button"
            onClick={() => setShowActions((prev) => !prev)}
            className={`rounded-sm border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest transition ${
              showActions
                ? 'border-brand-orange/60 bg-brand-orange/10 text-brand-orange'
                : 'border-gray-700 text-gray-300 hover:bg-gray-800/70'
            }`}
          >
            {showActions ? 'Hide Actions' : 'Appointment Actions'}
          </button>
        </div>

        {showProfile && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Customer name"
              className="rounded-sm border border-gray-700 bg-brand-darker px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
            />
            <input
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Customer email"
              className="rounded-sm border border-gray-700 bg-brand-darker px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
            />
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone"
              className="rounded-sm border border-gray-700 bg-brand-darker px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
            />
            <input
              value={profileForm.vehicle_make}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, vehicle_make: e.target.value }))}
              placeholder="Vehicle make"
              className="rounded-sm border border-gray-700 bg-brand-darker px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
            />
            <input
              value={profileForm.vehicle_model}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, vehicle_model: e.target.value }))}
              placeholder="Vehicle model"
              className="rounded-sm border border-gray-700 bg-brand-darker px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
            />
            <div className="flex gap-2">
              <input
                value={profileForm.vehicle_year}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, vehicle_year: e.target.value }))}
                placeholder="Year"
                className="w-full rounded-sm border border-gray-700 bg-brand-darker px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-orange"
              />
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className={`rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white ${
                  isSavingProfile ? 'cursor-not-allowed bg-brand-orange/50' : 'bg-brand-orange hover:bg-orange-600'
                }`}
              >
                {isSavingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showActions && (
        <div className="border-b border-gray-800 bg-brand-darker px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Appointment Actions</div>
            <button
              onClick={() => fetchAppointmentActions()}
              className="rounded-sm border border-gray-700 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-300 hover:bg-gray-800/70"
            >
              Refresh
            </button>
          </div>
          {actionsLoading ? (
            <div className="text-xs text-gray-500">Loading actions...</div>
          ) : appointmentActions.length === 0 ? (
            <div className="text-xs text-gray-500">No reschedule/cancel actions yet.</div>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
              {appointmentActions.map((a) => (
                <div key={a.id} className="rounded-sm border border-gray-700 bg-brand-dark px-2 py-1.5 text-[11px] text-gray-200">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-sm px-1.5 py-0.5 font-semibold ${a.action === 'cancel' ? 'bg-red-500/20 text-red-200' : 'bg-brand-orange/20 text-orange-200'}`}>
                      {a.action}
                    </span>
                    <span className="text-gray-500">{a.status}</span>
                  </div>
                  {(a.requested_date || a.requested_time) && (
                    <div className="mt-1 text-gray-300">{a.requested_date || '-'} {a.requested_time || ''}</div>
                  )}
                  {a.reason && <div className="mt-0.5 line-clamp-1 text-gray-500">{a.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={messagesContainerRef} className="h-0 flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)] px-4 py-4">
          {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-gray-500">
            No messages in this conversation.
          </div>
        )}
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user'
          const isHumanAgent = msg.sender === 'human'
          const isBot = msg.sender === 'bot'
          const bubbleClasses = isUser
            ? 'rounded-[14px_14px_4px_14px] bg-gradient-to-br from-brand-orange to-orange-600 text-white shadow-[0_8px_20px_rgba(245,130,32,0.35)]'
            : isHumanAgent
              ? 'rounded-[14px_14px_14px_4px] border border-orange-300/40 bg-orange-100 text-orange-900 shadow-sm'
              : 'rounded-[14px_14px_14px_4px] border border-gray-300/60 bg-gray-100 text-gray-900 shadow-sm'

          return (
            <div
              key={msg.id || idx}
              className={`mb-2.5 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {isHumanAgent && (
                <span
                  className={`mb-0.5 ml-1 text-[11px] font-semibold ${settings.agentColor.startsWith('#') ? '' : settings.agentColor}`}
                  style={settings.agentColor.startsWith('#') ? { color: settings.agentColor } : undefined}
                >
                  {getAgentName(msg) || 'Agent'}
                </span>
              )}
              {isBot && (
                <span className="mb-0.5 ml-1 text-[11px] font-semibold text-gray-500">
                  Bot
                </span>
              )}
              <div className={`max-w-[92%] break-words px-3 py-2 text-sm leading-relaxed sm:max-w-[72%] ${bubbleClasses}`}>
                {msg.content || msg.text || ''}
              </div>
              {formatMessageTime(msg.created_at) && (
                <span className="mt-1 text-[10px] text-gray-500">{formatMessageTime(msg.created_at)}</span>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="z-10 flex shrink-0 flex-col gap-2 border-t border-gray-800 bg-brand-darker/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-end">
        <div className="w-full rounded-sm border border-gray-700 bg-brand-dark px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-300 sm:w-52">
          {canSend ? `Replying as ${effectiveAgentName || 'Admin'}` : 'Take over first'}
        </div>
        <textarea
          ref={composerRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canSend}
          placeholder={canSend ? 'Reply as agent...' : 'Take over to reply'}
          rows={1}
          className={`max-h-40 min-h-[40px] flex-1 resize-none rounded-sm border px-3 py-2 text-sm outline-none transition ${
            canSend
              ? 'border-gray-700 bg-brand-dark text-gray-100 focus:border-brand-orange'
              : 'cursor-not-allowed border-gray-700 bg-brand-dark text-gray-500'
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!canReplyAsAgent || !inputValue.trim() || isSending}
          className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest transition sm:text-sm ${
            canReplyAsAgent && inputValue.trim()
              ? 'bg-brand-orange text-white hover:bg-orange-600'
              : 'cursor-not-allowed bg-gray-700 text-gray-400'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  )
}