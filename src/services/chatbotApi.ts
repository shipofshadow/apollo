import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { BACKEND_URL, CHATBOT_API_URL } from '../config'
import { AUTH_EXPIRED_EVENT } from './api'

declare module 'axios' {
  export interface AxiosRequestConfig {
    retryable?: boolean
    __retryCount?: number
  }
}

type FlowPayload = {
  name: string
  description: string | null
  flow_json: string
  is_active: boolean
}

export type ChatbotAdminSettings = {
  agent_color: string
  sound_enabled: boolean
  send_on_enter: boolean
  polling_interval: number
  updated_at?: string | null
}

export type ChatbotAdminSettingsUpdate = Partial<Pick<
  ChatbotAdminSettings,
  'agent_color' | 'sound_enabled' | 'send_on_enter' | 'polling_interval'
>>

type RetryConfig = InternalAxiosRequestConfig & {
  __retryCount?: number
  retryable?: boolean
}

const API_TIMEOUT_MS = 12000
const MAX_RETRIES = 2

const axiosInstance = axios.create({
  baseURL: CHATBOT_API_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

axiosInstance.interceptors.request.use((config) => {
  const next = config as RetryConfig
  next.headers = next.headers || {}
  next.headers['X-Client-Request-Id'] =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('apollo_token') : null
  if (token) {
    next.headers.Authorization = `Bearer ${token}`
  }

  if (typeof next.retryable === 'undefined') {
    next.retryable = (next.method || 'get').toLowerCase() === 'get'
  }

  return next
})

// ── Response Interceptor for Token Expiry ────────────────────────────────────

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Check if it's a 401 (Unauthorized) error
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
      }
    }

    const cfg = error.config as RetryConfig | undefined
    if (!cfg) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const networkError = !error.response
    const shouldRetryStatus = typeof status === 'number' && status >= 500
    const canRetry = !!cfg.retryable && (networkError || shouldRetryStatus)

    if (!canRetry) {
      return Promise.reject(error)
    }

    cfg.__retryCount = (cfg.__retryCount || 0) + 1
    if (cfg.__retryCount > MAX_RETRIES) {
      return Promise.reject(error)
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * cfg.__retryCount!))
    return axiosInstance(cfg)
  }
)

export function toApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'Unexpected error. Please try again.'
  }

  const status = error.response?.status
  const detail = (error.response?.data as { detail?: string } | undefined)?.detail

  if (status === 422) return detail || 'Please check your input and try again.'
  if (status === 404) return 'Requested resource was not found.'
  if (status === 429) return 'Too many requests. Please try again shortly.'
  if (status && status >= 500) return 'Server error. Please try again in a moment.'
  if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.'
  if (!error.response) return 'Network error. Check your connection and retry.'
  return detail || 'Request failed. Please try again.'
}

export const chatbotApi = {
  getHealth: () =>
    axiosInstance.get('/health', { retryable: false }).then((res) => res.data),

  sendMessage: (sessionId: string, message: string, messageType: string = 'text', displayMessage?: string) =>
    axiosInstance
      .post('/chat/send', {
        session_id: sessionId,
        message,
        message_type: messageType,
        ...(displayMessage ? { display_message: displayMessage } : {}),
      }, { retryable: false })
      .then((res) => res.data),

  newConversation: (sessionId?: string) =>
    axiosInstance
      .post('/chat/new', sessionId ? { session_id: sessionId } : {}, { retryable: false })
      .then((res) => res.data),

  getChatHistory: (sessionId: string) =>
    axiosInstance.get(`/chat/history/${sessionId}`).then((res) => res.data),

  getChatState: (sessionId: string) =>
    axiosInstance.get(`/chat/state/${sessionId}`).then((res) => res.data),

  getConversations: () =>
    axiosInstance.get('/admin/conversations').then((res) => res.data),

  getTeamMembers: () =>
    axiosInstance.get('/admin/team-members').then((res) => res.data),

  getConversation: (sessionId: string) =>
    axiosInstance
      .get(`/admin/conversations/${sessionId}`)
      .then((res) => res.data),

  getAdminSettings: () =>
    axiosInstance
      .get<ChatbotAdminSettings>('/admin/settings')
      .then((res) => res.data),

  updateAdminSettings: (payload: ChatbotAdminSettingsUpdate) =>
    axiosInstance
      .put<ChatbotAdminSettings>('/admin/settings', payload, { retryable: false })
      .then((res) => res.data),

  deleteConversation: (sessionId: string) =>
    axiosInstance
      .delete(`/admin/conversations/${sessionId}`, { retryable: false })
      .then((res) => res.data),

  closeConversation: (sessionId: string) =>
    axiosInstance
      .post(`/admin/close/${sessionId}`, undefined, { retryable: false })
      .then((res) => res.data),

  adminReply: (sessionId: string, message: string, agentId?: number | null, agentName?: string | null) =>
    axiosInstance
      .post(
        `/admin/reply/${sessionId}`,
        {
          message,
          ...(typeof agentId === 'number' ? { agent_id: agentId } : {}),
          ...(agentName ? { agent_name: agentName } : {}),
        },
        { retryable: false }
      )
      .then((res) => res.data),

  takeover: (sessionId: string) =>
    axiosInstance
      .post(`/admin/takeover/${sessionId}`)
      .then((res) => res.data),

  release: (sessionId: string) =>
    axiosInstance
      .post(`/admin/release/${sessionId}`)
      .then((res) => res.data),

  getFlows: () =>
    axiosInstance.get('/flows').then((res) => res.data),

  createFlow: (flow: FlowPayload) =>
    axiosInstance.post('/flows', flow).then((res) => res.data),

  updateFlow: (id: string, flow: FlowPayload) =>
    axiosInstance.put(`/flows/${id}`, flow).then((res) => res.data),

  activateFlow: (id: string) =>
    axiosInstance.post(`/flows/${id}/activate`).then((res) => res.data),

  deleteFlow: (id: string) =>
    axiosInstance.delete(`/flows/${id}`).then((res) => res.data),

  getPendingHandoffs: () =>
    axiosInstance.get('/handoff/pending').then((res) => res.data),

  getCustomerProfile: (sessionId: string) =>
    axiosInstance.get(`/customer/profile/${sessionId}`).then((res) => res.data),

  upsertCustomerProfile: (sessionId: string, payload: Record<string, unknown>) =>
    axiosInstance.put(`/customer/profile/${sessionId}`, payload, { retryable: false }).then((res) => res.data),

  setPresence: (sessionId: string, actor: 'customer' | 'agent', typing: boolean) =>
    axiosInstance.post(`/customer/presence/${sessionId}`, { actor, typing }, { retryable: false }).then((res) => res.data),

  markRead: (sessionId: string, actor: 'customer' | 'agent') =>
    axiosInstance.post(`/customer/read/${sessionId}`, { actor }, { retryable: false }).then((res) => res.data),

  getPresence: (sessionId: string) =>
    axiosInstance.get(`/customer/presence/${sessionId}`).then((res) => res.data),

  getServiceAvailability: (serviceId: number) =>
    axiosInstance.get(`/customer/service-availability/${serviceId}`).then((res) => res.data),

  requestReschedule: (sessionId: string, payload: Record<string, unknown>) =>
    axiosInstance.post(`/customer/appointment/${sessionId}/reschedule`, payload, { retryable: false }).then((res) => res.data),

  requestCancel: (sessionId: string, payload: Record<string, unknown>) =>
    axiosInstance.post(`/customer/appointment/${sessionId}/cancel`, payload, { retryable: false }).then((res) => res.data),

  getAppointmentActions: (sessionId: string, limit = 20) =>
    axiosInstance.get(`/customer/appointment/${sessionId}/actions`, { params: { limit } }).then((res) => res.data),

  uploadMedia: (files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files[]', f))
    return axios
      .post<{ urls: string[] }>(`${BACKEND_URL}/api/bookings/media`, form)
      .then((res) => res.data)
  },
}
