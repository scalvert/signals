import { buildPrompt } from '../prompts'
import type { AgentProvider, DispatchResult, ProviderConfig } from '../types'
import type { Task } from '@/types/workspace'

export function createCodexProvider(config: ProviderConfig): AgentProvider {
  return {
    type: 'codex',
    mode: 'cloud',

    async dispatch(task: Task): Promise<DispatchResult> {
      const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return { success: false, error: 'No API key configured for Codex provider' }
      }

      const prompt = buildPrompt(task, { includeMcpInstructions: true })

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          return {
            success: false,
            error: `Codex API returned ${res.status}: ${(data as Record<string, unknown>).error ?? 'Unknown error'}`,
          }
        }

        const data = await res.json()
        return {
          success: true,
          providerRef: (data as Record<string, unknown>).id as string ?? `codex-${Date.now()}`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Codex API request failed',
        }
      }
    },
  }
}
