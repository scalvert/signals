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
