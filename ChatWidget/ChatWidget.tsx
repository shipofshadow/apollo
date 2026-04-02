import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api, toApiErrorMessage } from '../../api/client'
import MessageBubble from './MessageBubble'
import type { ApiMessage, ChatMessage, MessageMetadata, QuickReplyPayload } from './types'

export type { CardButton, CardData, QuickReplyOption, ChatMessage } from './types'

export default function ChatWidget() {
  const searchParams = new URLSearchParams(window.location.search)
  const isWidgetMode = searchParams.has('widget')
  const isEmbedded = searchParams.has('embedded') || window.self !== window.top
  const isInlineWidget = isWidgetMode || isEmbedded

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<'bot' | 'human' | 'closed'>('bot')
  const [quickRepliesDisabled, setQuickRepliesDisabled] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const mapApiMessage = useCallback((m: ApiMessage): ChatMessage => {
    let metadata: MessageMetadata | null = m.metadata ?? null
    if (!metadata && m.metadata_json) {
      try {
        metadata = JSON.parse(m.metadata_json)
      } catch {
        metadata = {}
      }
    }
    if (!metadata) metadata = {}

    return {
      id: m.id ? `srv-${m.id}` : uuidv4(),
      sender: m.sender || 'bot',
      content: m.content || m.text || '',
      message_type: m.message_type || m.type || 'text',
      metadata,
      timestamp: m.created_at || new Date().toISOString(),
    }
  }, [])

  useEffect(() => {
    if (isInlineWidget) setIsOpen(true)
  }, [isInlineWidget])

  useEffect(() => {
    let id = localStorage.getItem('autobot_session_id')
    if (!id) {
      id = uuidv4()
      localStorage.setItem('autobot_session_id', id)
    }
    setSessionId(id)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const addMessages = useCallback((newMsgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMsgs])
  }, [])

  const startChat = useCallback(async (sid: string) => {
    setIsTyping(true)
    try {
      const data = await api.sendMessage(sid, '', 'start')
      setMessages((data.messages || []).map(mapApiMessage))
      setAgentStatus((data.status || data.session_status || 'bot') as 'bot' | 'human' | 'closed')
    } catch {
      setMessages([
        {
          id: uuidv4(),
          sender: 'bot',
          content: 'Hello! How can I help you today?',
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
    if (isOpen && messages.length === 0 && sessionId) {
      startChat(sessionId)
    }
  }, [isOpen, sessionId, messages.length, startChat])

  const handleSend = useCallback(async (overrideValue: string | QuickReplyPayload | undefined = undefined) => {
    const payload: QuickReplyPayload =
      typeof overrideValue === 'object' && overrideValue !== null
        ? overrideValue
        : { value: typeof overrideValue === 'string' ? overrideValue : inputValue }

    const submitText = (payload.value ?? inputValue).trim()
    const displayText = String(payload.display !== undefined ? payload.display : submitText).trim()

    if (!submitText || !sessionId) return

    addMessages([
      {
        id: uuidv4(),
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
      const data = await api.sendMessage(sessionId, submitText, 'text', displayText)
      addMessages((data.messages || []).map(mapApiMessage))
      setAgentStatus((data.status || data.session_status || agentStatus) as 'bot' | 'human' | 'closed')
    } catch (error) {
      addMessages([
        {
          id: uuidv4(),
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
    handleSend(value)
  }, [handleSend])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''

    if (!files.length || !sessionId) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const valid = files.filter((f) => allowed.includes(f.type))

    if (!valid.length) {
      addMessages([
        {
          id: uuidv4(),
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
      const { urls } = await api.uploadMedia(valid)
      if (!urls?.length) return

      const uploadText = `📎 ${urls.length} photo${urls.length > 1 ? 's' : ''} attached`

      addMessages([
        {
          id: uuidv4(),
          sender: 'user',
          content: uploadText,
          message_type: 'images',
          metadata: { uploaded_images: urls },
          timestamp: new Date().toISOString(),
        },
      ])

      setIsTyping(true)
      try {
        const data = await api.sendMessage(sessionId, urls.join(', '), 'text', uploadText)
        addMessages((data.messages || []).map(mapApiMessage))
        setAgentStatus((data.status || data.session_status || agentStatus) as 'bot' | 'human' | 'closed')
      } catch (error) {
        addMessages([
          {
            id: uuidv4(),
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
      addMessages([
        {
          id: uuidv4(),
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

  const handleToggle = useCallback(() => {
    if (isInlineWidget) {
      window.parent?.postMessage({ type: 'autobot:close' }, '*')
      return
    }
    setIsOpen((prev) => !prev)
  }, [isInlineWidget])

  const handleNewChat = useCallback(async () => {
    setIsTyping(true)
    try {
      const data = await api.newConversation(sessionId || undefined)
      const newSessionId = data?.session_id || uuidv4()
      localStorage.setItem('autobot_session_id', newSessionId)
      setSessionId(newSessionId)
      setMessages([])
      setInputValue('')
      setQuickRepliesDisabled(false)
      setAgentStatus('bot')
      await startChat(newSessionId)
    } catch {
      const newSessionId = uuidv4()
      localStorage.setItem('autobot_session_id', newSessionId)
      setSessionId(newSessionId)
      setMessages([])
      setInputValue('')
      setQuickRepliesDisabled(false)
      setAgentStatus('bot')
      await startChat(newSessionId)
    } finally {
      setIsTyping(false)
    }
  }, [sessionId, startChat])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !sessionId) return

    let cancelled = false

    const syncHistory = async () => {
      try {
        const [history, state] = await Promise.all([api.getChatHistory(sessionId), api.getChatState(sessionId)])
        if (cancelled || !Array.isArray(history)) return
        setMessages(history.map(mapApiMessage))
        setAgentStatus((state?.status || 'bot') as 'bot' | 'human' | 'closed')
      } catch {
        // Ignore polling errors.
      }
    }

    syncHistory()
    const interval = setInterval(syncHistory, 2500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isOpen, sessionId, mapApiMessage])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isCompact = viewportWidth <= 640
  const canSend = agentStatus !== 'closed'
  const showWindow = isInlineWidget || isOpen

  return (
    <>
      {showWindow && (
        <div
          style={{
            position: isInlineWidget ? 'absolute' : 'fixed',
            bottom: isInlineWidget ? 'auto' : (isCompact ? 84 : 90),
            right: isInlineWidget ? 'auto' : (isCompact ? 8 : 24),
            left: isInlineWidget ? 0 : (isCompact ? 8 : 'auto'),
            top: isInlineWidget ? 0 : 'auto',
            width: isInlineWidget ? '100%' : (isCompact ? 'auto' : 380),
            maxWidth: 'calc(100vw - 16px)',
            height: isInlineWidget ? '100%' : (isCompact ? 'calc(100vh - 96px)' : 520),
            maxHeight: isInlineWidget ? '100%' : 'calc(100vh - 96px)',
            borderRadius: isInlineWidget ? 16 : (isCompact ? 12 : 16),
            boxShadow: '0 28px 70px rgba(2, 6, 23, 0.45)',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #f36f21, #b54812)',
              color: 'white',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>AutoBot</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, opacity: 0.85 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: agentStatus === 'bot' ? '#34D399' : agentStatus === 'human' ? '#FCD34D' : '#F87171',
                      display: 'inline-block',
                    }}
                  />
                  {agentStatus === 'bot' ? 'Bot' : agentStatus === 'human' ? 'Agent' : 'Closed'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleNewChat}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                }}
                aria-label="Start new chat"
              >
                New Chat
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 8px 4px',
              background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
              minWidth: 0,
            }}
          >
            {messages.map((msg, idx) => (
              (() => {
                const hasLaterUserReply = messages.slice(idx + 1).some((m) => m.sender === 'user')
                const isQuickReplyActive = msg.message_type === 'quick_reply' && !hasLaterUserReply
                return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isQuickReplyActive={isQuickReplyActive}
                onQuickReply={handleQuickReply}
                quickRepliesDisabled={quickRepliesDisabled}
              />
                )
              })()
            ))}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
                <div
                  style={{
                    background: 'white',
                    borderRadius: '18px 18px 18px 4px',
                    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                    padding: '4px 8px',
                  }}
                >
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

          <div
            style={{
              padding: '12px',
              background: 'white',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <input
                className="autobot-chat-input"
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!canSend}
                placeholder={
                  agentStatus === 'human'
                    ? 'A human agent is handling this chat. You can still reply...'
                    : agentStatus === 'closed'
                      ? 'Conversation closed. Start a new chat'
                      : 'Type a message...'
                }
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 24,
                  fontSize: 14,
                  outline: 'none',
                  background: canSend ? '#f8fafc' : '#eef2f7',
                  color: canSend ? '#111827' : '#6b7280',
                  caretColor: '#111827',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!canSend || isUploading || isTyping}
                title="Upload image"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: canSend && !isUploading && !isTyping ? '#f1f5f9' : '#E5E7EB',
                  border: '1px solid #e2e8f0',
                  cursor: canSend && !isUploading && !isTyping ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                  opacity: isUploading ? 0.5 : 1,
                }}
                aria-label="Upload image"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#6b7280">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
              </button>
              <button
                onClick={() => handleSend()}
                disabled={!canSend || !inputValue.trim() || isTyping}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: canSend && inputValue.trim() && !isTyping ? 'linear-gradient(135deg, #f36f21, #df5e18)' : '#E5E7EB',
                  border: 'none',
                  cursor: canSend && inputValue.trim() && !isTyping ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {!isInlineWidget && (
        <button
          onClick={handleToggle}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
          style={{
            position: 'fixed',
            bottom: isCompact ? 16 : 24,
            right: isCompact ? 16 : 24,
            width: isCompact ? 52 : 56,
            height: isCompact ? 52 : 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f36f21, #b54812)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 28px rgba(179, 72, 18, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            transition: 'transform 0.2s, box-shadow 0.2s',
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.boxShadow = '0 14px 32px rgba(179, 72, 18, 0.65)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 10px 28px rgba(179, 72, 18, 0.55)'
          }}
        >
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          )}
        </button>
      )}
    </>
  )
}
