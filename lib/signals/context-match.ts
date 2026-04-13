import type { SignalType } from '@/types/workspace'

const suppressionRules: Partial<Record<SignalType, string[]>> = {
  dormant: ['low cadence', 'infrequently updated', 'stable', 'maintenance mode', 'rarely changes', 'updated as needed'],
  'health-drop': ['expected decline', 'winding down', 'deprecating', 'archiving soon'],
  'pr-stale': ['long-lived prs', 'slow review', 'review cadence'],
}

export function shouldSuppressSignal(
  signalType: SignalType,
  context: string,
): boolean {
  const keywords = suppressionRules[signalType]
  if (!keywords) return false
  const lower = context.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}
