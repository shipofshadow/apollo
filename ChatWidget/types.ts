export type CardButton = {
  type?: string
  url?: string
  value?: string | number
  payload?: string
  caption?: string
  label?: string
  text?: string
}

export type CardData = {
  title?: string
  description?: string
  image_url?: string
  variant_id?: string | number
  buttons?: CardButton[]
}

export type QuickReplyOption = {
  label: string
  value: string
}

export type MessageMetadata = {
  cards?: CardData[]
  buttons?: Array<{ label?: string; value?: string }>
  options?: QuickReplyOption[]
  uploaded_images?: string[]
  [key: string]: unknown
}

export type ChatMessage = {
  id: string
  sender: string
  content: string
  message_type: string
  metadata: MessageMetadata
  timestamp: string
}

export type ApiMessage = {
  id?: string | number
  sender?: string
  content?: string
  text?: string
  message_type?: string
  type?: string
  metadata?: MessageMetadata
  metadata_json?: string
  created_at?: string
}

export type QuickReplyPayload = {
  value: string
  display?: string
}