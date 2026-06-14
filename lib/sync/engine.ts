import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repos, pullRequests, syncLog, scoreHistory, signals } from '@/lib/db/schema'
import {
  getRepos,
  getPullRequests,
  getSignals,
  getRepoContextsForWorkspace,
  getDismissedChecks,
  getTasks,
  updateTaskStatus,
  addTaskNote,
  getSetting,
} from '@/lib/db/queries'
import { getInstallationOctokit } from '@/lib/github/app'
import { fetchReposForWorkspace } from '@/lib/github/fetch-repos'
import { fetchPRsForWorkspace } from '@/lib/github/fetch-prs'
import { registry } from '@/lib/signals/registry'
import { scoreRepo, detectEvents, type DetectedSignal } from '@/lib/signals/engine'
import { enrichSignals } from '@/lib/signals/enrichment'
import { filterReposForWorkspace } from '@/lib/github/filter-repos'
import type { Workspace, PullRequest, Repo, Signal } from '@/types/workspace'
import type { RepoSnapshot } from '@/lib/signals/types'

export async function syncWorkspace(workspace: Workspace): Promise<{
  repoCount: number
  prCount: number
  signalCount: number
}> {
  const now = new Date().toISOString()

  // Create sync log entry
  const logEntry = db
    .insert(syncLog)
    .values({
      workspaceId: workspace.id,
      status: 'running',
      startedAt: now,
    })
    .returning()
    .get()

  try {
    // Capture previous state for signal detection
    const previousRepos = getRepos(workspace.id)

    if (!workspace.githubInstallationId) {
      throw new Error('Workspace is not linked to a GitHub App installation')
    }

    // Fetch data from GitHub (sequential to avoid concurrent pagination 502s)
    const octokit = getInstallationOctokit(workspace.githubInstallationId)
    const allRepos = await fetchReposForWorkspace(workspace.sources, octokit)
    const allPRs = await fetchPRsForWorkspace(workspace.sources, octokit)
    const rawRepos = filterReposForWorkspace(allRepos, workspace.sources, workspace.excludedRepos)
    const rawPRs = allPRs.filter((pr) => rawRepos.some((r) => r.fullName === pr.repoFullName))

    // Clear existing data for this workspace
    db.delete(repos).where(eq(repos.workspaceId, workspace.id)).run()
    db.delete(pullRequests)
      .where(eq(pullRequests.workspaceId, workspace.id))
      .run()

    // Score and insert repos
    for (const raw of rawRepos) {
      const snapshot: RepoSnapshot = {
        name: raw.name,
        fullName: raw.fullName,
        stars: raw.stars,
        forks: raw.forks,
        openIssues: raw.openIssues,
        openPRs: raw.openPRs,
        lastCommitAt: raw.lastCommitAt,
        lastReleaseAt: raw.lastReleaseAt,
        hasCI: raw.hasCI,
        hasLicense: raw.hasLicense,
        hasContributing: raw.hasContributing,
        language: raw.language,
      }

      const dismissed = getDismissedChecks(workspace.id, raw.fullName)
      const repoPRs: PullRequest[] = rawPRs
        .filter((pr) => pr.repoFullName === raw.fullName)
        .map((pr) => ({
          ...pr,
          id: 0,
          daysSinceUpdate: Math.floor((Date.now() - new Date(pr.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
          workspaceId: workspace.id,
        }))
      const scored = scoreRepo(snapshot, repoPRs, dismissed)

      db.insert(repos)
        .values({
          workspaceId: workspace.id,
          name: raw.name,
          fullName: raw.fullName,
          description: raw.description,
          url: raw.url,
          language: raw.language,
          stars: raw.stars,
          forks: raw.forks,
          openIssues: raw.openIssues,
          openPRs: raw.openPRs,
          lastCommitAt: raw.lastCommitAt,
          lastReleaseAt: raw.lastReleaseAt,
          hasCI: raw.hasCI,
          hasLicense: raw.hasLicense,
          hasContributing: raw.hasContributing,
          isPrivate: raw.isPrivate,
          isFork: raw.isFork,
          score: scored.score,
          grade: scored.grade,
          triage: scored.triage,
          pillars: JSON.stringify(scored.pillars),
          checkResults: JSON.stringify(scored.checkResults),
          syncedAt: now,
        })
        .run()

      db.insert(scoreHistory)
        .values({
          workspaceId: workspace.id,
          repoFullName: raw.fullName,
          score: scored.score,
          grade: scored.grade,
          pillars: JSON.stringify(scored.pillars),
          syncedAt: now,
        })
        .run()
    }

    // Insert PRs
    for (const pr of rawPRs) {
      db.insert(pullRequests)
        .values({
          workspaceId: workspace.id,
          number: pr.number,
          title: pr.title,
          url: pr.url,
          authorLogin: pr.authorLogin,
          authorAssociation: pr.authorAssociation,
          isBot: pr.isBot,
          repoFullName: pr.repoFullName,
          isDraft: pr.isDraft,
          ciState: pr.ciState,
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
          syncedAt: now,
        })
        .run()
    }

    // Detect signals by comparing previous and current state
    const signalCount = await runSignalDetection(workspace.id, previousRepos)

    // Update sync log
    db.update(syncLog)
      .set({
        status: 'success',
        completedAt: new Date().toISOString(),
        repoCount: rawRepos.length,
      })
      .where(eq(syncLog.id, logEntry.id))
      .run()

    // Verify completed tasks
    const completedTasks = getTasks(workspace.id, { status: 'completed' })
    for (const task of completedTasks) {
      const repo = getRepos(workspace.id).find((r) => r.fullName === task.repoFullName)
      if (!repo) continue

      let verified = false
      if (task.sourceType === 'check') {
        const check = repo.checkResults[task.sourceId]
        if (!check) {
          updateTaskStatus(task.id, 'failed')
          addTaskNote(task.id, 'Source check no longer exists — check was removed from the signal registry.', 'system')
          continue
        }
        if (check.score >= 0.7) verified = true
      } else if (task.sourceType === 'signal') {
        const activeSignals = getSignals(workspace.id, { status: 'active' })
        const stillActive = activeSignals.some(
          (s) => String(s.id) === task.sourceId && s.repoFullName === task.repoFullName,
        )
        if (!stillActive) verified = true
      }

      if (verified) {
        updateTaskStatus(task.id, 'completed', { statusLine: 'Verified by sync — the originating issue is resolved' })
        addTaskNote(task.id, 'Verified by sync — the originating issue is resolved.', 'system')
      }
    }

    return { repoCount: rawRepos.length, prCount: rawPRs.length, signalCount }
  } catch (err) {
    db.update(syncLog)
      .set({
        status: 'error',
        completedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      .where(eq(syncLog.id, logEntry.id))
      .run()

    throw err
  }
}

export async function runSignalDetection(
  workspaceId: number,
  previousRepos: Repo[],
): Promise<number> {
  const currentRepos = getRepos(workspaceId)
  const prs = getPullRequests(workspaceId)
  const existingSignals = getSignals(workspaceId)
  const repoContexts = getRepoContextsForWorkspace(workspaceId)
  const prevMap = new Map(previousRepos.map((r) => [r.fullName, r]))
  const now = new Date().toISOString()

  const allDetected: DetectedSignal[] = []

  for (const repo of currentRepos) {
    const previousRepo = prevMap.get(repo.fullName)
    const repoContext = repoContexts.get(repo.fullName)
    const detected = detectEvents(repo, previousRepo, prs, existingSignals, repoContext)
    allDetected.push(...detected)
  }

  const insertedSignals: Signal[] = []
  for (const signal of allDetected) {
    const result = db
      .insert(signals)
      .values({
        workspaceId,
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        body: signal.body,
        repoFullName: signal.repoFullName,
        metadata: JSON.stringify(signal.metadata),
        detectedAt: now,
        fixable: registry.get(signal.type)?.meta.fixable ? 1 : 0,
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
      fixable: result.fixable === 1,
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

  return allDetected.length
}
