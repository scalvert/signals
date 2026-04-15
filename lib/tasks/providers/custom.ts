import { buildPrompt } from '../prompts'
import type { AgentProvider, DispatchResult, ProviderConfig } from '../types'
import type { Task } from '@/types/workspace'

export function createCustomProvider(config: ProviderConfig): AgentProvider {
  return {
    type: 'custom',
    mode: config.mode,

    async dispatch(task: Task): Promise<DispatchResult> {
      if (!config.endpoint) {
        return { success: false, error: 'No endpoint configured for custom provider' }
      }

      const prompt = buildPrompt(task, { includeMcpInstructions: true })

      try {
        const res = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            taskId: task.id,
            repoFullName: task.repoFullName,
            title: task.title,
            description: task.description,
            prompt,
          }),
        })

        if (!res.ok) {
          return { success: false, error: `Webhook returned ${res.status}` }
        }

        const data = await res.json().catch(() => ({}))
        return {
          success: true,
          providerRef: data.ref ?? data.id ?? `custom-${Date.now()}`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Webhook request failed',
        }
      }
    },
  }
}
