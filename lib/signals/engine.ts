import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { signals } from '@/lib/db/schema'
import { getRepos, getPullRequests, getSignals, getRepoContextsForWorkspace, getSetting } from '@/lib/db/queries'
import { starSpikeDetector } from './detectors/star-spike'
import { healthDropDetector } from './detectors/health-drop'
import { dormantDetector } from './detectors/dormant'
import { milestoneDetector } from './detectors/milestone'
import { detectStalePRs } from './detectors/pr-stale'
import { enrichSignals } from './enrichment'
import type { Repo, Signal } from '@/types/workspace'
import type { DetectedSignal } from './types'

const repoDetectors = [
  starSpikeDetector,
  healthDropDetector,
  dormantDetector,
  milestoneDetector,
]

export async function runSignalDetection(
  workspaceId: number,
  previousRepos: Repo[],
): Promise<number> {
  const currentRepos = getRepos(workspaceId)
  const prs = getPullRequests(workspaceId)
  const existingSignals = getSignals(workspaceId)
  const repoContexts = getRepoContextsForWorkspace(workspaceId)
  const now = new Date().toISOString()

  const detected: DetectedSignal[] = []

  for (const detector of repoDetectors) {
    detected.push(
      ...detector.detect(currentRepos, previousRepos, existingSignals, repoContexts),
    )
  }

  detected.push(...detectStalePRs(prs, existingSignals, repoContexts))

  const insertedSignals: Signal[] = []
  for (const signal of detected) {
    const result = db.insert(signals)
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
      .returning()
      .get()
    insertedSignals.push({
      ...result,
      type: result.type as Signal['type'],
      severity: result.severity as Signal['severity'],
      status: 'active' as const,
      dismissedReason: null,
      enrichedBody: null,
      metadata: JSON.parse(result.metadata) as Record<string, unknown>,
    })
  }

  const enrichmentEnabled = getSetting('enrichment.enabled')
  const enrichmentModel = getSetting('enrichment.model')
  if (
    enrichmentEnabled === 'true' &&
    enrichmentModel &&
    process.env.ANTHROPIC_API_KEY &&
    insertedSignals.length > 0
  ) {
    const enrichments = await enrichSignals(insertedSignals, repoContexts, enrichmentModel)
    for (const [signalId, enrichedBody] of enrichments) {
      db.update(signals)
        .set({ enrichedBody })
        .where(eq(signals.id, signalId))
        .run()
    }
  }

  return detected.length
}
