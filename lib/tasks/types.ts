import type { Task } from '@/types/workspace'

export interface DispatchResult {
  success: boolean
  providerRef?: string
  error?: string
}

export interface AgentProvider {
  type: string
  mode: 'local' | 'cloud'
  dispatch(task: Task): Promise<DispatchResult>
}

export interface ProviderConfig {
  type: string
  mode: 'local' | 'cloud'
  default?: boolean
  apiKey?: string
  endpoint?: string
}
