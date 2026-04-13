import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { Signal } from '@/types/workspace'

const enrichmentSchema = z.object({
  enrichments: z.array(
    z.object({
      signalId: z.number(),
      enrichedBody: z.string(),
    }),
  ),
})

export async function enrichSignals(
  signals: Signal[],
  repoContexts: Map<string, string>,
  model: string,
): Promise<Map<number, string>> {
  if (signals.length === 0) return new Map()

  const contextEntries = Array.from(repoContexts.entries())
    .map(([repo, ctx]) => `- ${repo}: ${ctx}`)
    .join('\n')

  const signalEntries = signals
    .map((s) => `- [id=${s.id}] ${s.type} (${s.severity}) on ${s.repoFullName}: ${s.body}`)
    .join('\n')

  try {
    const { object } = await generateObject({
      model: anthropic(model),
      schema: enrichmentSchema,
      system: `You are a signal enrichment engine for an OSS maintainer dashboard.
Given raw signals and per-repo context notes from the maintainer, rewrite each signal body to incorporate the relevant context.
Keep each enriched body to 1-2 concise sentences.
Adjust tone based on context — if the maintainer has noted something is expected, make the signal informational rather than alarming.
Return every signal ID from the input, even if no context applies (in that case, lightly rephrase the original).`,
      prompt: `Repo contexts:\n${contextEntries || '(none)'}\n\nSignals to enrich:\n${signalEntries}`,
    })

    return new Map(object.enrichments.map((e) => [e.signalId, e.enrichedBody]))
  } catch {
    return new Map()
  }
}
