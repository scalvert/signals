import type { SignalDefinition } from '../../types'

export const hasLicense: SignalDefinition = {
  meta: {
    id: 'has-license',
    name: 'License file',
    category: 'quality',
    rationale:
      'A LICENSE file is a legal requirement for OSS adoption. Without one, enterprises cannot use the project and contributors have no IP clarity.',
    docs: {
      summary: 'Binary check: 1.0 if LICENSE file present, 0 if not.',
    },
    mode: 'metric',
    weight: 0.3,
    fixable: true,
    fixInfo: {
      description: 'Add a LICENSE file (MIT recommended for OSS)',
      dispatch: 'agent' as const,
      objective: 'A LICENSE file is added with a defensible default for an OSS repository.',
      prompt: [
        'Add an appropriate LICENSE file for {{repoFullName}}.',
        '',
        'Use MIT as the default unless repository context clearly points to another license.',
        'Use the current year and the repository owner or project owner in the copyright line.',
        'If the repository already contains license language elsewhere, preserve it and avoid introducing a conflicting license.',
      ].join('\n'),
      needs: { repoAccess: 'write' as const, github: ['pulls'] as const },
      expectedOutcome: 'pr-created' as const,
    },
  },

  applies: () => true,

  evaluate({ repo }) {
    return {
      mode: 'metric',
      score: repo.hasLicense ? 1 : 0,
      label: repo.hasLicense ? 'LICENSE file present' : 'No LICENSE file found',
      evidence: [`hasLicense: ${repo.hasLicense}`],
      actionable: repo.hasLicense
        ? undefined
        : 'Add a LICENSE file (MIT recommended for OSS)',
    }
  },
}
