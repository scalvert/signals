import { generateText, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { FixResult } from '@/lib/signals/types'
import type { Task, Signal } from '@/types/workspace'
import { interpolatePrompt } from '../prompts'
import { buildGitHubTools } from '../github-tools'

interface LlmFixInfo {
  dispatch: 'llm'
  objective: string
  prompt: string
}

export async function executeLlmDispatch(
  task: Task,
  signal: Signal,
  fixInfo: LlmFixInfo,
  githubToken: string,
): Promise<FixResult> {
  const [owner, repo] = task.repoFullName.split('/')

  const templateVars: Record<string, unknown> = {
    repoFullName: task.repoFullName,
    owner,
    repo,
    ...signal.metadata,
  }

  const userPrompt = interpolatePrompt(fixInfo.prompt, templateVars)

  const tools = buildGitHubTools(githubToken)

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: `You are a GitHub maintainer assistant. Your objective: ${fixInfo.objective}. Be concise, genuine, and actionable.`,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(20),
      maxOutputTokens: 4096,
    })

    const commentUrls: string[] = []
    for (const toolResult of result.toolResults) {
      if (toolResult.toolName === 'comment_on_pr' && toolResult.output) {
        const r = toolResult.output as { url?: string }
        if (r.url) commentUrls.push(r.url)
      }
    }

    const statusLine = commentUrls.length > 0
      ? `Commented on ${commentUrls.length} PR${commentUrls.length > 1 ? 's' : ''}`
      : 'Completed — no comments posted'

    return {
      success: true,
      resultRef: commentUrls[0],
      statusLine,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: message,
      statusLine: `Failed: ${message.slice(0, 100)}`,
    }
  }
}
