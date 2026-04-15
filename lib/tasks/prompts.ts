import type { Task } from '@/types/workspace'

export function buildPrompt(task: Task, options?: { includeMcpInstructions?: boolean }): string {
  const lines = [
    `You are working on the repository ${task.repoFullName}.`,
    '',
    '## Task',
    task.title,
    '',
    '## Context',
    task.description,
    '',
    '## Instructions',
    '- Fix the issue described above',
    '- Run tests to verify your fix',
    '- Commit your changes with a clear commit message',
  ]

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
