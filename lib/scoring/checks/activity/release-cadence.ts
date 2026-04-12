import type { HealthCheck } from '../../types'

export const releaseCadenceCheck: HealthCheck = {
  id: 'release-cadence',
  name: 'Release cadence',
  description: 'Whether the repository has published a recent release',
  pillar: 'activity',
  weight: 0.35,
  applies: () => true,
  run(repo) {
    if (!repo.lastReleaseAt) {
      return {
        score: 0.1,
        label: 'No releases published',
        evidence: ['lastReleaseAt: null'],
        actionable:
          'Cut an initial release to signal stability to users',
      }
    }

    const daysSince = Math.floor(
      (Date.now() - new Date(repo.lastReleaseAt).getTime()) /
        (1000 * 60 * 60 * 24),
    )

    let score: number
    if (daysSince <= 30) score = 1.0
    else if (daysSince <= 60) score = 0.8
    else if (daysSince <= 90) score = 0.6
    else if (daysSince <= 180) score = 0.3
    else score = 0.1

    return {
      score,
      label: `Last release ${daysSince} days ago`,
      evidence: [
        `lastReleaseAt: ${repo.lastReleaseAt}`,
        `daysSince: ${daysSince}`,
      ],
      actionable:
        score < 0.5
          ? 'Consider cutting a release to show active maintenance'
          : undefined,
    }
  },
}
