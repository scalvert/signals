import { db } from '@/lib/db/client'
import { signals } from '@/lib/db/schema'
import { getRepos, getPullRequests, getSignals } from '@/lib/db/queries'
import { starSpikeDetector } from './detectors/star-spike'
import { healthDropDetector } from './detectors/health-drop'
import { dormantDetector } from './detectors/dormant'
import { milestoneDetector } from './detectors/milestone'
import { detectStalePRs } from './detectors/pr-stale'
import type { Repo } from '@/types/workspace'
import type { DetectedSignal } from './types'

const repoDetectors = [
  starSpikeDetector,
  healthDropDetector,
  dormantDetector,
  milestoneDetector,
]

export function runSignalDetection(
  workspaceId: number,
  previousRepos: Repo[],
): number {
  const currentRepos = getRepos(workspaceId)
  const prs = getPullRequests(workspaceId)
  const existingSignals = getSignals(workspaceId)
  const now = new Date().toISOString()

  const detected: DetectedSignal[] = []

  for (const detector of repoDetectors) {
    detected.push(
      ...detector.detect(currentRepos, previousRepos, existingSignals),
    )
  }

  detected.push(...detectStalePRs(prs, existingSignals))

  for (const signal of detected) {
    db.insert(signals)
      .values({
        workspaceId,
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        body: signal.body,
        repoFullName: signal.repoFullName,
        metadata: JSON.stringify(signal.metadata),
        detectedAt: now,
      })
      .run()
  }

  return detected.length
}
