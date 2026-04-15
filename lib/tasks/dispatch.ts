import { getSetting } from '@/lib/db/queries'
import { claudeCodeProvider } from './providers/claude-code'
import { cursorProvider } from './providers/cursor'
import { createCustomProvider } from './providers/custom'
import { createCodexProvider } from './providers/codex'
import type { AgentProvider, ProviderConfig, DispatchResult } from './types'
import type { Task } from '@/types/workspace'

const builtInProviders: Record<string, AgentProvider> = {
  'claude-code': claudeCodeProvider,
  'cursor': cursorProvider,
}

function getConfiguredProviders(): ProviderConfig[] {
  const raw = getSetting('agent.providers')
  if (!raw) return [{ type: 'claude-code', mode: 'local', default: true }]
  try {
    return JSON.parse(raw) as ProviderConfig[]
  } catch {
    return [{ type: 'claude-code', mode: 'local', default: true }]
  }
}

function getProvider(providerType: string): AgentProvider | null {
  if (builtInProviders[providerType]) return builtInProviders[providerType]

  const configs = getConfiguredProviders()
  const config = configs.find((c) => c.type === providerType)
  if (config?.type === 'custom') return createCustomProvider(config)
  if (config?.type === 'codex') return createCodexProvider(config)

  return null
}

export function getAvailableProviders(): ProviderConfig[] {
  return getConfiguredProviders()
}

export function getDefaultProvider(): string {
  const configs = getConfiguredProviders()
  const defaultConfig = configs.find((c) => c.default)
  return defaultConfig?.type ?? configs[0]?.type ?? 'claude-code'
}

export async function dispatchTask(task: Task, providerType: string): Promise<DispatchResult> {
  const provider = getProvider(providerType)
  if (!provider) {
    return { success: false, error: `Unknown provider: ${providerType}` }
  }

  return provider.dispatch(task)
}
