import type { HealthCheck } from '../../types'

export const prMergeVelocityCheck: HealthCheck = {
  id: 'pr-merge-velocity',
  name: 'PR merge velocity',
  description:
    'Ratio of open PRs to repo activity — lower means faster merging',
  pillar: 'activity',
  weight: 0.25,
  applies: () => true,
  run(repo) {
    if (repo.openPRs === 0) {
      return {
        score: 1.0,
        label: 'No open PRs',
        evidence: ['openPRs: 0'],
      }
    }

    // Normalize against repo size: a 1000-star repo with 10 PRs is healthier
    // than a 10-star repo with 10 PRs
    const sizeAdjustor = Math.max(repo.stars / 100, 1)
    const ratio = repo.openPRs / sizeAdjustor

    let score: number
    if (ratio <= 1) score = 1.0
    else if (ratio <= 3) score = 0.7
    else if (ratio <= 5) score = 0.4
    else score = 0.2

    return {
      score,
      label: `${repo.openPRs} open PRs (ratio: ${ratio.toFixed(1)})`,
      evidence: [
        `openPRs: ${repo.openPRs}`,
        `stars: ${repo.stars}`,
        `adjustedRatio: ${ratio.toFixed(2)}`,
      ],
      actionable:
        score < 0.5
          ? 'PR backlog is growing — consider a review sprint'
          : undefined,
    }
  },
}
