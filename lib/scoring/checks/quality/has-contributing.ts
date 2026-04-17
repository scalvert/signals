import type { HealthCheck } from '../../types'

export const hasContributingCheck: HealthCheck = {
  id: 'has-contributing',
  name: 'Contributing guide',
  description: 'Repository has a CONTRIBUTING.md file',
  pillar: 'quality',
  weight: 0.3,
  fixable: true,
  applies: () => true,
  run(repo) {
    return {
      score: repo.hasContributing ? 1 : 0,
      label: repo.hasContributing
        ? 'CONTRIBUTING.md present'
        : 'No CONTRIBUTING.md found',
      evidence: [`hasContributing: ${repo.hasContributing}`],
      actionable: repo.hasContributing
        ? undefined
        : 'Add a CONTRIBUTING.md to help new contributors get started',
    }
  },
}
