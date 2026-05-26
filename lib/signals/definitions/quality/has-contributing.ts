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
      dispatch: 'agent' as const,
      objective: 'A practical CONTRIBUTING.md is added for new contributors.',
      prompt: [
        'Add a CONTRIBUTING.md for {{repoFullName}}.',
        '',
        'Inspect the repository for setup, test, lint, formatting, and release conventions.',
        'Write a concise guide that covers local setup, how to run checks, branch/PR expectations, and where contributors should ask questions.',
        'Avoid inventing process details that are not supported by the repository.',
      ].join('\n'),
      needs: { repoAccess: 'write' as const, github: ['pulls'] as const },
      expectedOutcome: 'pr-created' as const,
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
