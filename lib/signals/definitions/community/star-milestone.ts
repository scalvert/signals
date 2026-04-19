import type { SignalDefinition } from '../../types'
import { formatMilestone } from '../utils'

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

export const starMilestone: SignalDefinition = {
  meta: {
    id: 'star-milestone',
    name: 'Star milestone',
    category: 'community',
    rationale:
      'Star milestones are worth celebrating — they mark growth and can be shared on social media to drive further adoption.',
    docs: {
      summary:
        'Fires when a repo crosses a milestone threshold (10, 25, 50, 100, 250, 500, 1k, 2.5k, 5k, 10k). Dedup is per-milestone per-repo (never fires twice for the same milestone).',
    },
    mode: 'event',
    fixable: false,
  },

  applies: () => true,

  evaluate({ repo, previousRepo, existingSignals }) {
    if (!previousRepo) return null

    const crossed = MILESTONES.filter(
      (m) => repo.stars >= m && previousRepo.stars < m,
    )
    if (crossed.length === 0) return null

    const milestone = crossed[crossed.length - 1]

    const alreadyDetected = existingSignals.some((s) => {
      return (
        (s.type === 'star-milestone' || s.type === 'milestone') &&
        s.repoFullName === repo.fullName &&
        (s.metadata as Record<string, unknown>).milestone === milestone
      )
    })
    if (alreadyDetected) return null

    return {
      mode: 'event',
      detected: true,
      severity: 'info',
      title: `${repo.name} reached ${formatMilestone(milestone)} stars`,
      body: `${repo.name} crossed ${formatMilestone(milestone)} stars (now at ${repo.stars}).`,
      metadata: { milestone, currentStars: repo.stars },
    }
  },
}
