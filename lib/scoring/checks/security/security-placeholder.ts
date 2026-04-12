import type { HealthCheck } from '../../types'

export const securityPlaceholderCheck: HealthCheck = {
  id: 'security-placeholder',
  name: 'Security scoring',
  description:
    'Placeholder for OpenSSF Scorecard integration — returns 0.5 for all repos',
  pillar: 'security',
  weight: 1.0,
  applies: () => true,
  run(_repo) {
    return {
      score: 0.5,
      label: 'No automated security scoring configured',
      evidence: ['placeholder: 0.5'],
      actionable:
        'OpenSSF Scorecard integration planned for a future release',
    }
  },
}
