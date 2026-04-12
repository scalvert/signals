import type { HealthCheck } from '../../types'

export const externalPRRatioCheck: HealthCheck = {
  id: 'external-pr-ratio',
  name: 'External PR ratio',
  description:
    'Placeholder — requires PR data from sync. Defaults to 0.5.',
  pillar: 'community',
  weight: 0.5,
  applies: () => true,
  run(_repo) {
    // This check needs PR-level data that isn't on the RepoSnapshot.
    // The sync engine will compute this separately and override the score.
    // For now, return a neutral 0.5.
    return {
      score: 0.5,
      label: 'External PR data computed during sync',
      evidence: ['computed from PR data at sync time'],
    }
  },
}
