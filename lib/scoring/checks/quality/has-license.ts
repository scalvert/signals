import type { HealthCheck } from '../../types'

export const hasLicenseCheck: HealthCheck = {
  id: 'has-license',
  name: 'License file',
  description: 'Repository has a LICENSE file',
  pillar: 'quality',
  weight: 0.3,
  applies: () => true,
  run(repo) {
    return {
      score: repo.hasLicense ? 1 : 0,
      label: repo.hasLicense
        ? 'LICENSE file present'
        : 'No LICENSE file found',
      evidence: [`hasLicense: ${repo.hasLicense}`],
      actionable: repo.hasLicense
        ? undefined
        : 'Add a LICENSE file (MIT recommended for OSS)',
    }
  },
}
