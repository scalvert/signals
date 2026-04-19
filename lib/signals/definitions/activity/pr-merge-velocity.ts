import type { SignalDefinition } from '../../types'
import { isBot } from '../utils'

export const prMergeVelocity: SignalDefinition = {
  meta: {
    id: 'pr-merge-velocity',
    name: 'PR merge velocity',
    category: 'activity',
    rationale:
      'A growing PR backlog signals slow review or understaffing. Only human PRs are counted — bot PRs (Dependabot, Renovate) are tracked separately.',
    docs: {
      summary:
        'Scores based on open human PR count: 0=1.0, 1-5=0.8, 6-15=0.6, 16-30=0.4, 30+=0.2. Bot PRs are excluded from the count.',
    },
    mode: 'metric',
    weight: 0.25,
    fixable: false,
  },

  applies: () => true,

  evaluate({ repo, pullRequests }) {
    const humanPRs = pullRequests.filter((pr) => !isBot(pr.authorLogin))
    const count = humanPRs.length

    if (count === 0) {
      return {
        mode: 'metric',
        score: 1.0,
        label: 'No open human PRs',
        evidence: ['openHumanPRs: 0'],
      }
    }

    let score: number
    if (count <= 5) score = 0.8
    else if (count <= 15) score = 0.6
    else if (count <= 30) score = 0.4
    else score = 0.2

    return {
      mode: 'metric',
      score,
      label: `${count} open human PR${count !== 1 ? 's' : ''}`,
      evidence: [
        `openHumanPRs: ${count}`,
        `totalOpenPRs: ${pullRequests.length}`,
        `botPRsExcluded: ${pullRequests.length - count}`,
      ],
      actionable:
        score < 0.5
          ? 'PR backlog is growing — consider a review sprint'
          : undefined,
    }
  },
}
