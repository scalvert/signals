import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { buildWorkspaceTools } from '@/lib/ai/tools'

export const maxDuration = 30

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages
  const workspaceId = Number(body.workspaceId ?? 0)

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are an AI assistant embedded in Signals, an open source OSS maintainer dashboard.
You help maintainers understand and act on the health of their GitHub repositories.
You have access to tools to query repos, PRs, signals, and health scores.
Always use tools to get real data before answering — never guess or make up data.
Be concise and actionable. When you identify issues, suggest specific next steps.
Format responses with markdown for readability.`,
    messages: await convertToModelMessages(messages),
    tools: buildWorkspaceTools(workspaceId),
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
