import { registry } from '../registry'

import { commitFrequency } from './activity/commit-frequency'
import { releaseCadence } from './activity/release-cadence'
import { prMergeVelocity } from './activity/pr-merge-velocity'
import { dormantRepo } from './activity/dormant-repo'
import { healthDrop } from './activity/health-drop'
import { issueFlood } from './activity/issue-flood'

import { stalePRs } from './community/stale-prs'
import { staleBotPRs } from './community/stale-bot-prs'
import { newContributor } from './community/new-contributor'
import { starSpike } from './community/star-spike'
import { starMilestone } from './community/star-milestone'

import { hasLicense } from './quality/has-license'
import { hasCI } from './quality/has-ci'
import { hasContributing } from './quality/has-contributing'

const allSignals = [
  commitFrequency,
  releaseCadence,
  prMergeVelocity,
  dormantRepo,
  healthDrop,
  issueFlood,
  stalePRs,
  staleBotPRs,
  newContributor,
  starSpike,
  starMilestone,
  hasLicense,
  hasCI,
  hasContributing,
]

for (const signal of allSignals) {
  registry.register(signal)
}

export { allSignals }
