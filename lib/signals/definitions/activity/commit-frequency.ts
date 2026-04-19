import type { SignalDefinition } from '../../types'
import { daysAgo } from '../utils'

export const commitFrequency: SignalDefinition = {
  meta: {
    id: 'commit-frequency',
    name: 'Commit frequency',
    category: 'activity',
    rationale:
      'Recent commit activity is the strongest signal that a project is actively maintained. Users and contributors check this before investing time.',
    docs: {
      summary:
        'Scores based on days since the last commit: 0-7d=1.0, 8-14d=0.8, 15-30d=0.6, 31-60d=0.4, 61-90d=0.2, 90+=0.',
    },
    mode: 'metric',
    weight: 0.4,
    fixable: false,
  },

  applies: () => true,

  evaluate({ repo }) {
    if (!repo.lastCommitAt) {
      return {
        mode: 'metric',
        score: 0,
        label: 'No commits found',
        evidence: ['lastCommitAt: null'],
        actionable: 'Push an initial commit to start tracking activity',
      }
    }

    const days = daysAgo(repo.lastCommitAt)

    let score: number
    if (days <= 7) score = 1.0
    else if (days <= 14) score = 0.8
    else if (days <= 30) score = 0.6
    else if (days <= 60) score = 0.4
    else if (days <= 90) score = 0.2
    else score = 0

    return {
      mode: 'metric',
      score,
      label: days === 0 ? 'Committed today' : `Last commit ${days} days ago`,
      evidence: [`lastCommitAt: ${repo.lastCommitAt}`, `daysSince: ${days}`],
      actionable:
        score < 0.5
          ? 'Repository appears inactive — consider committing a maintenance update'
          : undefined,
    }
  },
}
