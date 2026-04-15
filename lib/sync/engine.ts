import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repos, pullRequests, syncLog } from '@/lib/db/schema'
import { getRepos } from '@/lib/db/queries'
import { fetchReposForWorkspace } from '@/lib/github/fetch-repos'
import { fetchPRsForWorkspace } from '@/lib/github/fetch-prs'
import { scoreRepo } from '@/lib/scoring/engine'
import { runSignalDetection } from '@/lib/signals/engine'
import type { Workspace, WorkspaceSource } from '@/types/workspace'
import type { RepoSnapshot } from '@/lib/scoring/types'

function filterReposBySourceSelection<T extends { name: string; fullName: string; isFork: boolean; isPrivate: boolean }>(repos: T[], sources: WorkspaceSource[]): T[] {
  const included = new Set<string>()

  for (const source of sources) {
    if (source.type === 'repo') {
      included.add(source.value)
      continue
    }

    const prefix = source.value + '/'
    const sourceRepos = repos.filter((r) => r.fullName.startsWith(prefix))
    const selection = source.repos

    for (const repo of sourceRepos) {
      if (selection?.visibility === 'public' && repo.isPrivate) continue
      if (selection?.visibility === 'private' && !repo.isPrivate) continue
      if (selection?.excludeForks && repo.isFork) continue

      if (selection?.mode === 'selected') {
        if (!selection.selected.includes(repo.name)) continue
      } else if (selection?.mode === 'all' && selection.selected.length > 0) {
        if (selection.selected.includes(repo.name)) continue
      }

      included.add(repo.fullName)
    }
  }

  return repos.filter((r) => included.has(r.fullName))
}

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

    // Fetch data from GitHub (sequential to avoid concurrent pagination 502s)
    const allRepos = await fetchReposForWorkspace(workspace.sources)
    const allPRs = await fetchPRsForWorkspace(workspace.sources)
    const rawRepos = filterReposBySourceSelection(allRepos, workspace.sources)
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

      const scored = scoreRepo(snapshot)

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
