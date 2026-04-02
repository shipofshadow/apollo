import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import logo from '../../assets/logo.png'
import { chatbotApi, toApiErrorMessage } from '../../services/chatbotApi'
import MessageBubble from './MessageBubble'
import type { ApiMessage, ChatMessage, MessageMetadata, QuickReplyPayload } from './types'

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isPublicWebsitePath(pathname: string) {
  return !/^\/admin(?:\/|$)/.test(pathname) && !/^\/client(?:\/|$)/.test(pathname)
}

export default function WebsiteChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<'bot' | 'human' | 'closed'>('bot')
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [quickRepliesDisabled, setQuickRepliesDisabled] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const shouldRender = typeof window !== 'undefined' && isPublicWebsitePath(window.location.pathname)

  const mapApiMessage = useCallback((message: ApiMessage): ChatMessage => {
    let metadata: MessageMetadata | null = message.metadata ?? null
    if (!metadata && message.metadata_json) {
      try {
        metadata = JSON.parse(message.metadata_json)
      } catch {
        metadata = {}
      }
    }
    if (!metadata) metadata = {}

    return {
      id: message.id ? `srv-${message.id}` : createLocalId(),
      sender: message.sender || 'bot',
      content: message.content || message.text || '',
      message_type: message.message_type || message.type || 'text',
      metadata,
      timestamp: message.created_at || new Date().toISOString(),
    }
  }, [])

  const addMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...nextMessages])
  }, [])

  const checkServiceHealth = useCallback(async () => {
    try {
      const response = await chatbotApi.getHealth()
      setServiceStatus(response?.status === 'ok' ? 'online' : 'offline')
    } catch {
      setServiceStatus('offline')
    }
  }, [])

  const startChat = useCallback(async (sid: string) => {
    setIsTyping(true)
    try {
      const data = await chatbotApi.sendMessage(sid, '', 'start')
      setServiceStatus('online')
      setMessages((data.messages || []).map(mapApiMessage))
      setAgentStatus((data.status || data.session_status || 'bot') as 'bot' | 'human' | 'closed')
    } catch {
      setServiceStatus('offline')
      setMessages([
        {
          id: createLocalId(),
          sender: 'bot',
          content: 'Hello! How can 1625 Auto Lab help you today?',
          message_type: 'text',
          metadata: {},
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [mapApiMessage])

  useEffect(() => {
    if (!shouldRender) return
    let id = localStorage.getItem('autobot_session_id')
    if (!id) {
      id = createLocalId()
      localStorage.setItem('autobot_session_id', id)
    }
    setSessionId(id)
  }, [shouldRender])

  useEffect(() => {
    if (!shouldRender) return
    void checkServiceHealth()
    const interval = window.setInterval(checkServiceHealth, 30000)
    return () => window.clearInterval(interval)
  }, [shouldRender, checkServiceHealth])

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (!isOpen || !sessionId || messages.length > 0) return
    void startChat(sessionId)
  }, [isOpen, sessionId, messages.length, startChat])

  useEffect(() => {
    if (!isOpen || !sessionId) return

    let cancelled = false

    const syncHistory = async () => {
      try {
        const [history, state] = await Promise.all([
          chatbotApi.getChatHistory(sessionId),
          chatbotApi.getChatState(sessionId),
        ])
        setServiceStatus('online')
        if (cancelled || !Array.isArray(history)) return
        setMessages(history.map(mapApiMessage))
        setAgentStatus((state?.status || 'bot') as 'bot' | 'human' | 'closed')
      } catch {
        setServiceStatus('offline')
      }
    }

    void syncHistory()
    const interval = window.setInterval(syncHistory, 2500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isOpen, sessionId, mapApiMessage])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleSend = useCallback(async (overrideValue?: string | QuickReplyPayload) => {
    const payload: QuickReplyPayload =
      typeof overrideValue === 'object' && overrideValue !== null
        ? overrideValue
        : { value: typeof overrideValue === 'string' ? overrideValue : inputValue }

    const submitText = (payload.value ?? inputValue).trim()
    const displayText = String(payload.display !== undefined ? payload.display : submitText).trim()
    if (!submitText || !sessionId) return

    addMessages([
      {
        id: createLocalId(),
        sender: 'user',
        content: displayText,
        message_type: 'text',
        metadata: {},
        timestamp: new Date().toISOString(),
      },
    ])

    setInputValue('')
    setIsTyping(true)

    try {
      const data = await chatbotApi.sendMessage(sessionId, submitText, 'text', displayText)
      setServiceStatus('online')
      addMessages((data.messages || []).map(mapApiMessage))
      setAgentStatus((data.status || data.session_status || agentStatus) as 'bot' | 'human' | 'closed')
    } catch (error) {
      setServiceStatus('offline')
      addMessages([
        {
          id: createLocalId(),
          sender: 'bot',
          content: toApiErrorMessage(error),
          message_type: 'text',
          metadata: {},
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsTyping(false)
      setQuickRepliesDisabled(false)
    }
  }, [inputValue, sessionId, addMessages, mapApiMessage, agentStatus])

  const handleQuickReply = useCallback((value: string | QuickReplyPayload) => {
    setQuickRepliesDisabled(true)
    void handleSend(value)
  }, [handleSend])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (!files.length || !sessionId) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const valid = files.filter((file) => allowed.includes(file.type))

    if (!valid.length) {
      addMessages([
        {
          id: createLocalId(),
          sender: 'bot',
          content: 'Only JPEG, PNG, WebP, and GIF images are supported.',
          message_type: 'text',
          metadata: {},
          timestamp: new Date().toISOString(),
        },
      ])
      return
    }

    setIsUploading(true)
    try {
      const { urls } = await chatbotApi.uploadMedia(valid)
      if (!urls?.length) return

      const uploadText = `📎 ${urls.length} photo${urls.length > 1 ? 's' : ''} attached`
      addMessages([
        {
          id: createLocalId(),
          sender: 'user',
          content: uploadText,
          message_type: 'images',
          metadata: { uploaded_images: urls },
          timestamp: new Date().toISOString(),
        },
      ])

      setIsTyping(true)
      try {
        const data = await chatbotApi.sendMessage(sessionId, urls.join(', '), 'text', uploadText)
        setServiceStatus('online')
        addMessages((data.messages || []).map(mapApiMessage))
        setAgentStatus((data.status || data.session_status || agentStatus) as 'bot' | 'human' | 'closed')
      } catch (error) {
        setServiceStatus('offline')
        addMessages([
          {
            id: createLocalId(),
            sender: 'bot',
            content: toApiErrorMessage(error),
            message_type: 'text',
            metadata: {},
            timestamp: new Date().toISOString(),
          },
        ])
      } finally {
        setIsTyping(false)
      }
    } catch (error) {
      setServiceStatus('offline')
      addMessages([
        {
          id: createLocalId(),
          sender: 'bot',
          content: toApiErrorMessage(error),
          message_type: 'text',
          metadata: {},
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsUploading(false)
    }
  }, [sessionId, addMessages, mapApiMessage, agentStatus])

  const handleNewChat = useCallback(async () => {
    setIsTyping(true)
    try {
      const data = await chatbotApi.newConversation(sessionId || undefined)
      const newSessionId = data?.session_id || createLocalId()
      localStorage.setItem('autobot_session_id', newSessionId)
      setSessionId(newSessionId)
      setMessages([])
      setInputValue('')
      setQuickRepliesDisabled(false)
      setAgentStatus('bot')
      await startChat(newSessionId)
    } catch {
      const fallbackSessionId = createLocalId()
      localStorage.setItem('autobot_session_id', fallbackSessionId)
      setSessionId(fallbackSessionId)
      setMessages([])
      setInputValue('')
      setQuickRepliesDisabled(false)
      setAgentStatus('bot')
      await startChat(fallbackSessionId)
    } finally {
      setIsTyping(false)
    }
  }, [sessionId, startChat])

  const isCompact = viewportWidth <= 640
  const canSend = serviceStatus === 'online' && agentStatus !== 'closed'
  const statusLabel = useMemo(() => {
    if (serviceStatus === 'checking') return 'Checking Bot'
    if (serviceStatus === 'offline') return 'Bot Offline'
    if (agentStatus === 'human') return 'Live Agent'
    if (agentStatus === 'closed') return 'Closed'
    return 'Bot Online'
  }, [agentStatus, serviceStatus])

  if (!shouldRender) {
    return null
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed z-[1000] overflow-hidden border border-white/10 bg-white shadow-[0_28px_70px_rgba(2,6,23,0.45)]"
          style={{
            bottom: isCompact ? 84 : 90,
            right: isCompact ? 8 : 24,
            left: isCompact ? 8 : 'auto',
            width: isCompact ? 'auto' : 380,
            maxWidth: 'calc(100vw - 16px)',
            height: isCompact ? 'calc(100vh - 96px)' : 560,
            maxHeight: 'calc(100vh - 96px)',
            borderRadius: isCompact ? 16 : 22,
          }}
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-orange via-orange-600 to-orange-900 px-4 py-4 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_40%),linear-gradient(135deg,transparent,rgba(0,0,0,0.12))]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm">
                  <img src={logo} alt="1625 Auto Lab" className="h-7 w-7 object-contain" />
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest">1625 Assistant</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-orange-50/90">
                    <span className={`inline-block h-2 w-2 rounded-full ${serviceStatus === 'checking' ? 'bg-slate-200' : serviceStatus === 'offline' ? 'bg-rose-300' : agentStatus === 'bot' ? 'bg-emerald-300' : agentStatus === 'human' ? 'bg-amber-200' : 'bg-rose-300'}`} />
                    {statusLabel}
                  </div>
                </div>
              </div>

              <div className="relative flex items-center gap-2">
                <button
                  onClick={() => void handleNewChat()}
                  className="rounded-full border border-white/30 bg-white/12 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-white/20"
                >
                  New Chat
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-white/12 text-white transition hover:bg-white/20"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100%-82px)] flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {messages.map((message, index) => {
                const hasLaterUserReply = messages.slice(index + 1).some((item) => item.sender === 'user')
                const isQuickReplyActive = message.message_type === 'quick_reply' && !hasLaterUserReply
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isQuickReplyActive={isQuickReplyActive}
                    onQuickReply={handleQuickReply}
                    quickRepliesDisabled={quickRepliesDisabled}
                  />
                )
              })}

              {isTyping && (
                <div className="mb-3 flex items-start">
                  <div className="rounded-[18px_18px_18px_4px] bg-white px-3 py-2 shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
                    <div className="typing-indicator">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white px-3 py-3">
              <div className="mb-2 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-[11px] text-slate-600">
                {serviceStatus === 'offline'
                  ? 'Chat assistant is currently offline. Please try again in a moment.'
                  : serviceStatus === 'checking'
                    ? 'Checking assistant availability...'
                    : agentStatus === 'human'
                  ? 'A human agent is handling this chat. You can still reply here.'
                  : agentStatus === 'closed'
                    ? 'This conversation is closed. Start a new chat to continue.'
                    : 'Ask about services, bookings, schedules, or your vehicle needs.'}
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canSend || isUploading || isTyping}
                  title="Upload image"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!canSend}
                  placeholder={serviceStatus === 'offline' ? 'Assistant offline' : canSend ? 'Type a message...' : 'Start a new chat to continue'}
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-orange"
                />

                <button
                  onClick={() => void handleSend()}
                  disabled={!canSend || !inputValue.trim() || isTyping}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-orange-700 text-white shadow-[0_10px_28px_rgba(179,72,18,0.35)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className="fixed z-[1001] grid place-items-center rounded-full bg-gradient-to-br from-brand-orange to-orange-800 text-white shadow-[0_12px_30px_rgba(179,72,18,0.55)] transition hover:scale-105"
        style={{
          bottom: isCompact ? 16 : 24,
          right: isCompact ? 16 : 24,
          width: isCompact ? 54 : 58,
          height: isCompact ? 54 : 58,
        }}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        )}
      </button>
    </>
  )
}