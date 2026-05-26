import type { Task } from '@/types/workspace'

export function interpolatePrompt(
  template: string,
  vars: Record<string, unknown>,
): string {
  let result = template

  result = result.replace(
    /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, key: string, body: string) => {
      const arr = vars[key]
      if (!Array.isArray(arr)) return ''
      return arr
        .map((item: Record<string, unknown>) => {
          let line = body
          line = line.replace(
            /\{\{#if this\.(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
            (_m, field: string, truthy: string, falsy?: string) =>
              item[field] ? truthy : (falsy ?? ''),
          )
          line = line.replace(
            /\{\{this\.(\w+)\}\}/g,
            (_m, field: string) => String(item[field] ?? ''),
          )
          return line
        })
        .join('')
    },
  )

  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_match, key: string, truthy: string, falsy?: string) =>
      vars[key] ? truthy : (falsy ?? ''),
  )

  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => String(vars[key] ?? ''),
  )

  return result
}

export interface PromptSignalContext {
  rationale: string
  fixGuidance?: string
  docsSummary: string
  repoContext?: string
  metadata?: Record<string, unknown>
}

export function buildPrompt(
  task: Task,
  options?: { includeMcpInstructions?: boolean; signalContext?: PromptSignalContext },
): string {
  const lines = [
    `You are working on the repository ${task.repoFullName}.`,
    '',
    '## Task',
    task.title,
    '',
    '## Context',
    task.description,
  ]

  if (options?.signalContext) {
    const ctx = options.signalContext
    lines.push('', '## Why this matters', ctx.rationale)
    if (ctx.fixGuidance) {
      lines.push('', '## Fix guidance', ctx.fixGuidance)
    }
    lines.push('', '## Signal details', ctx.docsSummary)
    if (ctx.repoContext) {
      lines.push('', '## Repository context', ctx.repoContext)
    }
    if (ctx.metadata && Object.keys(ctx.metadata).length > 0) {
      lines.push('', '## Signal metadata', JSON.stringify(ctx.metadata, null, 2))
    }
  }

  lines.push(
    '',
    '## Instructions',
    '- Fix the issue described above',
    '- Run tests to verify your fix',
    '- Commit your changes with a clear commit message',
  )

  if (options?.includeMcpInstructions) {
    lines.push(
      '',
      '## Signals MCP Server',
      'When done, use the Signals MCP server to report completion:',
      `  update_task_status(${task.id}, "completed", { providerRef: "PR URL or description" })`,
      '',
      'For additional context while working:',
      `  get_repo_health("${task.repoFullName}") — full health breakdown`,
      `  get_repo_actionable_items("${task.repoFullName}") — other items to fix`,
    )
  }

  return lines.join('\n')
}
