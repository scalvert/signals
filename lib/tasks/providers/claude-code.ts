import { execFile } from 'child_process'
import { buildTaskPrompt } from '../prompt-context'
import type { AgentProvider, DispatchResult } from '../types'
import type { Task } from '@/types/workspace'

export const claudeCodeProvider: AgentProvider = {
  type: 'claude-code',
  mode: 'local',

  async dispatch(task: Task): Promise<DispatchResult> {
    const prompt = buildTaskPrompt(task, { includeMcpInstructions: true })

    return new Promise((resolve) => {
      execFile('claude', ['--print', '--prompt', prompt], {
        timeout: 10000,
        cwd: process.cwd(),
      }, (error) => {
        if (error) {
          resolve({
            success: false,
            error: `Failed to launch Claude Code: ${error.message}`,
          })
          return
        }

        resolve({
          success: true,
          providerRef: `claude-code-session-${Date.now()}`,
        })
      })
    })
  },
}
