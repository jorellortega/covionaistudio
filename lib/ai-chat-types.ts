export type AIMessageRole = 'system' | 'user' | 'assistant'

export interface AIMessage {
  role: AIMessageRole
  content: string
  timestamp?: string
}

export interface GlobalAISetting {
  setting_key: string
  setting_value: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

export type AISettingsMap = Record<string, string>

