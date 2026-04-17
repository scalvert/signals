import type { HealthCheck } from '../../types'

export const hasCICheck: HealthCheck = {
  id: 'has-ci',
  name: 'CI configuration',
  description: 'Repository has GitHub Actions workflows configured',
  pillar: 'quality',
  weight: 0.4,
  fixable: true,
  applies: () => true,
  run(repo) {
    return {
      score: repo.hasCI ? 1 : 0,
      label: repo.hasCI
        ? 'GitHub Actions workflows found'
        : 'No CI configuration detected',
      evidence: [`hasCI: ${repo.hasCI}`],
      actionable: repo.hasCI
        ? undefined
        : 'Add a .github/workflows directory with at least a basic CI workflow',
    }
  },
}
