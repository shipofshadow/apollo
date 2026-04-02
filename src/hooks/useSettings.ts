import { useCallback, useEffect, useMemo, useState } from 'react'
import { chatbotApi, type ChatbotAdminSettingsUpdate } from '../services/chatbotApi'

const STORAGE_KEY = 'apollo_chatbot_admin_settings'
const SETTINGS_EVENT = 'chatbot-settings-updated'

export type SettingsState = {
  agentColor: string
  soundEnabled: boolean
  sendOnEnter: boolean
  pollingInterval: number
}

const DEFAULT_SETTINGS: SettingsState = {
  agentColor: '#fdba74',
  soundEnabled: false,
  sendOnEnter: true,
  pollingInterval: 3000,
}

function toValidPollingInterval(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1000) return DEFAULT_SETTINGS.pollingInterval
  return Math.round(n)
}

function sanitizeSettings(input: Partial<SettingsState> | null | undefined): SettingsState {
  return {
    agentColor: typeof input?.agentColor === 'string' && input.agentColor.trim() !== ''
      ? input.agentColor.trim()
      : DEFAULT_SETTINGS.agentColor,
    soundEnabled: typeof input?.soundEnabled === 'boolean'
      ? input.soundEnabled
      : DEFAULT_SETTINGS.soundEnabled,
    sendOnEnter: typeof input?.sendOnEnter === 'boolean'
      ? input.sendOnEnter
      : DEFAULT_SETTINGS.sendOnEnter,
    pollingInterval: toValidPollingInterval(input?.pollingInterval),
  }
}

function parseStoredSettings(raw: string | null): SettingsState {
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return sanitizeSettings(parsed)
  } catch {
    return DEFAULT_SETTINGS
  }
}

function toApiPayload(settings: SettingsState): ChatbotAdminSettingsUpdate {
  return {
    agent_color: settings.agentColor,
    sound_enabled: settings.soundEnabled,
    send_on_enter: settings.sendOnEnter,
    polling_interval: settings.pollingInterval,
  }
}

function fromApiPayload(payload: Partial<{
  agent_color: string
  sound_enabled: boolean
  send_on_enter: boolean
  polling_interval: number
}>): SettingsState {
  return sanitizeSettings({
    agentColor: payload.agent_color,
    soundEnabled: payload.sound_enabled,
    sendOnEnter: payload.send_on_enter,
    pollingInterval: payload.polling_interval,
  })
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingsState>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS
    return parseStoredSettings(window.localStorage.getItem(STORAGE_KEY))
  })
  const [isSyncing, setIsSyncing] = useState(false)

  const persistSettings = useCallback((next: SettingsState) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }))
  }, [])

  const applySettings = useCallback((next: SettingsState) => {
    setSettings(next)
    persistSettings(next)
  }, [persistSettings])

  const updateSettings = useCallback(async (patch: Partial<SettingsState>) => {
    const next = sanitizeSettings({ ...settings, ...patch })
    applySettings(next)
    setIsSyncing(true)
    try {
      const saved = await chatbotApi.updateAdminSettings(toApiPayload(next))
      applySettings(fromApiPayload(saved))
    } catch (error) {
      console.error('Failed to sync chatbot settings to backend', error)
    } finally {
      setIsSyncing(false)
    }
  }, [applySettings, settings])

  const resetSettings = useCallback(async () => {
    await updateSettings(DEFAULT_SETTINGS)
  }, [updateSettings])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      setSettings(parseStoredSettings(event.newValue))
    }

    const onCustomEvent = (event: Event) => {
      const custom = event as CustomEvent<SettingsState>
      if (!custom.detail) return
      setSettings(sanitizeSettings(custom.detail))
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(SETTINGS_EVENT, onCustomEvent as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SETTINGS_EVENT, onCustomEvent as EventListener)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      setIsSyncing(true)
      try {
        const server = await chatbotApi.getAdminSettings()
        if (!mounted) return
        applySettings(fromApiPayload(server))
      } catch (error) {
        console.error('Failed to load chatbot settings from backend', error)
      } finally {
        if (mounted) setIsSyncing(false)
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [applySettings])

  return useMemo(() => ({
    settings,
    isSyncing,
    updateSettings,
    resetSettings,
  }), [isSyncing, resetSettings, settings, updateSettings])
}
