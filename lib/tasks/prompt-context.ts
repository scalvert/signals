import type { Task } from '@/types/workspace'
import { registry } from '@/lib/signals/registry'
import '@/lib/signals/definitions'
import { getSignalById, getRepoContextsForWorkspace } from '@/lib/db/queries'
import { buildPrompt, type PromptSignalContext } from './prompts'

export function getPromptContext(task: Task): PromptSignalContext | undefined {
  let defn
  if (task.sourceType === 'check') {
    defn = registry.get(task.sourceId)
  } else if (task.sourceType === 'signal') {
    const signal = getSignalById(Number(task.sourceId))
    if (signal) defn = registry.get(signal.type)
  }
  if (!defn) return undefined

  const repoContexts = getRepoContextsForWorkspace(task.workspaceId)

  return {
    rationale: defn.meta.rationale,
    fixGuidance: defn.meta.fixInfo?.description,
    docsSummary: defn.meta.docs.summary,
    repoContext: repoContexts.get(task.repoFullName),
  }
}

export function buildTaskPrompt(
  task: Task,
  options?: { includeMcpInstructions?: boolean },
): string {
  const signalContext = getPromptContext(task)
  return buildPrompt(task, { ...options, signalContext })
}
