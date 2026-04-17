import type { HealthCheck } from '../../types'

export const commitFrequencyCheck: HealthCheck = {
  id: 'commit-frequency',
  name: 'Commit frequency',
  description: 'How recently the repository has been committed to',
  pillar: 'activity',
  weight: 0.4,
  fixable: false,
  applies: () => true,
  run(repo) {
    if (!repo.lastCommitAt) {
      return {
        score: 0,
        label: 'No commits found',
        evidence: ['lastCommitAt: null'],
        actionable: 'Push an initial commit to start tracking activity',
      }
    }

    const daysSince = Math.floor(
      (Date.now() - new Date(repo.lastCommitAt).getTime()) /
        (1000 * 60 * 60 * 24),
    )

    let score: number
    if (daysSince <= 7) score = 1.0
    else if (daysSince <= 14) score = 0.8
    else if (daysSince <= 30) score = 0.6
    else if (daysSince <= 60) score = 0.4
    else if (daysSince <= 90) score = 0.2
    else score = 0

    return {
      score,
      label:
        daysSince === 0
          ? 'Committed today'
          : `Last commit ${daysSince} days ago`,
      evidence: [
        `lastCommitAt: ${repo.lastCommitAt}`,
        `daysSince: ${daysSince}`,
      ],
      actionable:
        score < 0.5
          ? 'Repository appears inactive — consider committing a maintenance update'
          : undefined,
    }
  },
}
