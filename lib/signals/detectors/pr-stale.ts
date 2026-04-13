import type { DetectedSignal } from '../types'
import type { PullRequest, Signal } from '@/types/workspace'
import { shouldSuppressSignal } from '../context-match'

const EXTERNAL_STALE_DAYS = 7
const INTERNAL_STALE_DAYS = 14

export function detectStalePRs(
  prs: PullRequest[],
  existingSignals: Signal[],
  repoContexts: Map<string, string>,
): DetectedSignal[] {
  const signals: DetectedSignal[] = []

  const grouped = new Map<string, PullRequest[]>()
  for (const pr of prs) {
    if (pr.isDraft) continue
    const threshold = pr.isExternal ? EXTERNAL_STALE_DAYS : INTERNAL_STALE_DAYS
    if (pr.daysSinceUpdate < threshold) continue

    const existing = grouped.get(pr.repoFullName) ?? []
    existing.push(pr)
    grouped.set(pr.repoFullName, existing)
  }

  for (const [repoFullName, stalePRs] of grouped) {
    const prNumbers = stalePRs.map((p) => p.number)
    const key = prNumbers.sort().join(',')

    if (isDuplicate(existingSignals, repoFullName, key)) continue

    const context = repoContexts.get(repoFullName)
    if (context && shouldSuppressSignal('pr-stale', context)) continue

    const oldest = Math.max(...stalePRs.map((p) => p.daysSinceUpdate))
    const hasExternal = stalePRs.some((p) => p.isExternal)
    const severity = hasExternal && oldest > 14 ? 'critical' : 'warning'
    const repoName = repoFullName.split('/')[1]

    signals.push({
      type: 'pr-stale',
      severity,
      title: `${stalePRs.length} stale PR${stalePRs.length > 1 ? 's' : ''} on ${repoName}`,
      body: stalePRs
        .map(
          (pr) =>
            `#${pr.number} by @${pr.authorLogin} (${pr.daysSinceUpdate}d, ${pr.isExternal ? 'external' : 'internal'})`,
        )
        .join('. '),
      repoFullName,
      metadata: {
        prNumbers,
        oldestDays: oldest,
        hasExternal,
        prs: stalePRs.map((p) => ({
          number: p.number,
          title: p.title,
          author: p.authorLogin,
          daysSinceUpdate: p.daysSinceUpdate,
          isExternal: p.isExternal,
        })),
      },
    })
  }

  return signals
}

function isDuplicate(signals: Signal[], repoFullName: string, key: string): boolean {
  return signals.some((s) => {
    if (s.type !== 'pr-stale' || s.repoFullName !== repoFullName) return false
    const existing = ((s.metadata as Record<string, unknown>).prNumbers as number[]) ?? []
    return existing.sort().join(',') === key
  })
}
