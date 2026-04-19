import type { SignalDefinition } from '../../types'

export const hasContributing: SignalDefinition = {
  meta: {
    id: 'has-contributing',
    name: 'Contributing guide',
    category: 'quality',
    rationale:
      'A CONTRIBUTING.md lowers the barrier for new contributors by documenting setup, coding standards, and PR expectations.',
    docs: {
      summary:
        'Binary check: 1.0 if CONTRIBUTING.md present, 0 if not.',
    },
    mode: 'metric',
    weight: 0.3,
    fixable: true,
    fixInfo: {
      description: 'Add a CONTRIBUTING.md to help new contributors get started',
    },
  },

  applies: () => true,

  evaluate({ repo }) {
    return {
      mode: 'metric',
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
