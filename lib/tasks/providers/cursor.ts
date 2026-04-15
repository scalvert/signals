import { execFile } from 'child_process'
import { buildPrompt } from '../prompts'
import type { AgentProvider, DispatchResult } from '../types'
import type { Task } from '@/types/workspace'

export const cursorProvider: AgentProvider = {
  type: 'cursor',
  mode: 'local',

  async dispatch(task: Task): Promise<DispatchResult> {
    const prompt = buildPrompt(task)

    return new Promise((resolve) => {
      execFile('cursor', ['--prompt', prompt], {
        timeout: 10000,
        cwd: process.cwd(),
      }, (error) => {
        if (error) {
          resolve({
            success: false,
            error: `Failed to launch Cursor: ${error.message}`,
          })
          return
        }

        resolve({
          success: true,
          providerRef: `cursor-session-${Date.now()}`,
        })
      })
    })
  },
}
