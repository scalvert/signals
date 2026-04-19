import type { SignalDefinition } from '../../types'

const MIN_DELTA = 5
const SPIKE_RATIO = 3.0

export const starSpike: SignalDefinition = {
  meta: {
    id: 'star-spike',
    name: 'Star spike',
    category: 'community',
    rationale:
      'A sudden jump in stars usually means external attention — HN, Reddit, a newsletter, or a viral tweet. This is a window to convert attention into contributors.',
    docs: {
      summary:
        'Fires when a repo gains 5+ stars since last sync AND either the gain is 20+ or the ratio (delta/previous) exceeds 3x. Info at 5-19, warning at 20+.',
    },
    mode: 'event',
    fixable: false,
    dedupDays: 1,
  },

  applies: () => true,

  evaluate({ repo, previousRepo }) {
    if (!previousRepo) return null

    const delta = repo.stars - previousRepo.stars
    if (delta < MIN_DELTA) return null

    const ratio = previousRepo.stars > 0 ? delta / previousRepo.stars : delta
    if (ratio < SPIKE_RATIO && delta < 20) return null

    return {
      mode: 'event',
      detected: true,
      severity: delta >= 20 ? 'warning' : 'info',
      title: `Star spike on ${repo.name}`,
      body: `+${delta} stars detected (${previousRepo.stars} → ${repo.stars}). Possible source: HN, Reddit, or newsletter mention.`,
      metadata: {
        delta,
        previous: previousRepo.stars,
        current: repo.stars,
        ratio,
      },
    }
  },
}
