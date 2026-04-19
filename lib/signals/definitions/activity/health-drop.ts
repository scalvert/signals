import type { SignalDefinition } from '../../types'

export const healthDrop: SignalDefinition = {
  meta: {
    id: 'health-drop',
    name: 'Health score drop',
    category: 'activity',
    rationale:
      'A sudden health score drop means multiple checks degraded at once — a leading indicator of neglect or a breaking change that knocked out CI, removed files, or stalled PRs.',
    docs: {
      summary:
        'Fires when a repo score drops 4+ points between syncs. Warning at 4-8 points, critical at 8+. Requires previousRepo in context.',
    },
    mode: 'event',
    fixable: false,
    dedupDays: 7,
    suppressionKeywords: [
      'expected decline',
      'winding down',
      'deprecating',
      'archiving soon',
    ],
  },

  applies: () => true,

  evaluate({ repo, previousRepo }) {
    if (!previousRepo) return null

    const drop = previousRepo.score - repo.score
    if (drop < 4) return null

    const severity = drop > 8 ? 'critical' : 'warning'
    const changes: string[] = []
    const pillars = ['activity', 'community', 'quality', 'security'] as const
    for (const p of pillars) {
      const diff = repo.pillars[p] - previousRepo.pillars[p]
      if (diff < -2) changes.push(`${p} ${diff}`)
    }
    const detail = changes.length > 0
      ? `Declining pillars: ${changes.join(', ')}.`
      : 'Check individual health checks for details.'

    return {
      mode: 'event',
      detected: true,
      severity,
      title: `Health score dropped on ${repo.name}`,
      body: `Score fell from ${previousRepo.score} to ${repo.score} (−${drop} points). ${detail}`,
      metadata: {
        scoreBefore: previousRepo.score,
        scoreAfter: repo.score,
        drop,
        pillarsBefore: previousRepo.pillars,
        pillarsAfter: repo.pillars,
      },
    }
  },
}
