import type { HealthCheck } from '../types'
import { commitFrequencyCheck } from './activity/commit-frequency'
import { releaseCadenceCheck } from './activity/release-cadence'
import { prMergeVelocityCheck } from './activity/pr-merge-velocity'
import { externalPRRatioCheck } from './community/external-pr-ratio'
import { firstResponseTimeCheck } from './community/first-response-time'
import { hasCICheck } from './quality/has-ci'
import { hasLicenseCheck } from './quality/has-license'
import { hasContributingCheck } from './quality/has-contributing'
import { securityPlaceholderCheck } from './security/security-placeholder'

export const ALL_CHECKS: HealthCheck[] = [
  commitFrequencyCheck,
  releaseCadenceCheck,
  prMergeVelocityCheck,
  externalPRRatioCheck,
  firstResponseTimeCheck,
  hasCICheck,
  hasLicenseCheck,
  hasContributingCheck,
  securityPlaceholderCheck,
]
