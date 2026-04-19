import type { SignalDefinition } from '../../types'
import { daysAgo } from '../utils'

export const releaseCadence: SignalDefinition = {
  meta: {
    id: 'release-cadence',
    name: 'Release cadence',
    category: 'activity',
    rationale:
      'Regular releases signal stability and active distribution to users. Repos that have never released (dotfiles, configs) are excluded — they should not be penalized for a workflow that does not apply.',
    docs: {
      summary:
        'Scores based on days since the last release: 0-30d=1.0, 31-60d=0.8, 61-90d=0.6, 91-180d=0.3, 180+=0.1. Repos with no releases are excluded via applies().',
    },
    mode: 'metric',
    weight: 0.35,
    fixable: false,
  },

  applies: (repo) => repo.lastReleaseAt !== null,

  evaluate({ repo }) {
    if (!repo.lastReleaseAt) return null

    const days = daysAgo(repo.lastReleaseAt)

    let score: number
    if (days <= 30) score = 1.0
    else if (days <= 60) score = 0.8
    else if (days <= 90) score = 0.6
    else if (days <= 180) score = 0.3
    else score = 0.1

    return {
      mode: 'metric',
      score,
      label: `Last release ${days} days ago`,
      evidence: [
        `lastReleaseAt: ${repo.lastReleaseAt}`,
        `daysSince: ${days}`,
      ],
      actionable:
        score < 0.5
          ? 'Consider cutting a release to show active maintenance'
          : undefined,
    }
  },
}
