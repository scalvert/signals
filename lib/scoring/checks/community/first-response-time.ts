import type { HealthCheck } from '../../types'

export const firstResponseTimeCheck: HealthCheck = {
  id: 'first-response-time',
  name: 'First response time',
  description:
    'Placeholder — requires issue timeline data. Defaults to 0.5.',
  pillar: 'community',
  weight: 0.5,
  fixable: false,
  applies: () => true,
  run(_repo) {
    // Computing actual first-response-time requires fetching issue timelines
    // which is expensive. We'll enhance this in a future iteration.
    return {
      score: 0.5,
      label: 'Response time data computed during sync',
      evidence: ['computed from issue timeline data at sync time'],
    }
  },
}
