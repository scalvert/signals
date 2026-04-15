import { eq, desc, sql } from 'drizzle-orm'
import { db } from './client'
import { workspaces, repos, pullRequests, signals, syncLog, repoContext, settings, scoreHistory } from './schema'
import type {
  Workspace,
  WorkspaceSource,
  Repo,
  PullRequest,
  Signal,
  WorkspaceStats,
  SyncStatus,
  RepoPillars,
  RepoContext,
} from '@/types/workspace'

export function getWorkspaces(): Workspace[] {
  const rows = db.select().from(workspaces).all()
  return rows.map(parseWorkspaceRow)
}

export function getWorkspaceBySlug(slug: string): Workspace | undefined {
  const row = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .get()
  return row ? parseWorkspaceRow(row) : undefined
}

export function createWorkspace(
  name: string,
  slug: string,
  sources: WorkspaceSource[],
): Workspace {
  const now = new Date().toISOString()
  const result = db
    .insert(workspaces)
    .values({
      name,
      slug,
      sources: JSON.stringify(sources),
      createdAt: now,
    })
    .returning()
    .get()
  return parseWorkspaceRow(result)
}

export function deleteWorkspace(id: number): void {
  db.delete(workspaces).where(eq(workspaces.id, id)).run()
}

function parseWorkspaceRow(row: typeof workspaces.$inferSelect): Workspace {
  return {
    ...row,
    sources: JSON.parse(row.sources) as WorkspaceSource[],
    excludedRepos: JSON.parse(row.excludedRepos) as string[],
  }
}

export function updateWorkspaceExcludedRepos(
  id: number,
  excludedRepos: string[],
): void {
  db.update(workspaces)
    .set({ excludedRepos: JSON.stringify(excludedRepos) })
    .where(eq(workspaces.id, id))
    .run()
}

export function getRepos(workspaceId: number): Repo[] {
  const rows = db
    .select()
    .from(repos)
    .where(eq(repos.workspaceId, workspaceId))
    .all()
  return rows.map((row) => ({
    ...row,
    grade: row.grade as Repo['grade'],
    triage: row.triage as Repo['triage'],
    pillars: JSON.parse(row.pillars) as RepoPillars,
    checkResults: JSON.parse(row.checkResults) as Repo['checkResults'],
  }))
}

export function getPullRequests(workspaceId: number): PullRequest[] {
  const rows = db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.workspaceId, workspaceId))
    .all()

  const now = Date.now()
  return rows.map((row) => {
    const daysSinceUpdate = Math.floor(
      (now - new Date(row.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    )
    const externalAssociations = new Set([
      'FIRST_TIME_CONTRIBUTOR',
      'FIRST_TIMER',
      'NONE',
    ])
    return {
      ...row,
      ciState: row.ciState as PullRequest['ciState'],
      daysSinceUpdate,
      isExternal: externalAssociations.has(row.authorAssociation),
      isStale: daysSinceUpdate > 7,
    }
  })
}

function parseSignalRow(row: typeof signals.$inferSelect): Signal {
  return {
    ...row,
    type: row.type as Signal['type'],
    severity: row.severity as Signal['severity'],
    status: (row.status ?? 'active') as Signal['status'],
    dismissedReason: row.dismissedReason ?? null,
    enrichedBody: row.enrichedBody ?? null,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }
}

export function getSignals(
  workspaceId: number,
  options?: { limit?: number; status?: 'active' | 'dismissed' },
): Signal[] {
  const query = db
    .select()
    .from(signals)
    .where(eq(signals.workspaceId, workspaceId))
    .orderBy(desc(signals.detectedAt))

  const rows = options?.limit ? query.limit(options.limit).all() : query.all()

  return rows
    .map(parseSignalRow)
    .filter((s) => !options?.status || s.status === options.status)
}

export function dismissSignal(
  signalId: number,
  reason: string,
): Signal | undefined {
  const row = db
    .update(signals)
    .set({ status: 'dismissed', dismissedReason: reason })
    .where(eq(signals.id, signalId))
    .returning()
    .get()
  if (!row) return undefined
  return parseSignalRow(row)
}

export function restoreSignal(signalId: number): Signal | undefined {
  const row = db
    .update(signals)
    .set({ status: 'active', dismissedReason: null })
    .where(eq(signals.id, signalId))
    .returning()
    .get()
  if (!row) return undefined
  return parseSignalRow(row)
}

export function getWorkspaceStats(workspaceId: number): WorkspaceStats {
  const repoRows = db
    .select()
    .from(repos)
    .where(eq(repos.workspaceId, workspaceId))
    .all()

  const prCount = db
    .select({ count: sql<number>`count(*)` })
    .from(pullRequests)
    .where(eq(pullRequests.workspaceId, workspaceId))
    .get()

  const totalRepos = repoRows.length
  const avgHealthScore =
    totalRepos > 0
      ? Math.round(
          repoRows.reduce((sum, r) => sum + r.score, 0) / totalRepos,
        )
      : 0
  const totalStars = repoRows.reduce((sum, r) => sum + r.stars, 0)

  return {
    totalRepos,
    openPRs: prCount?.count ?? 0,
    avgHealthScore,
    starsLast30d: totalStars,
  }
}

export function getLatestSync(workspaceId: number): SyncStatus | null {
  const row = db
    .select()
    .from(syncLog)
    .where(eq(syncLog.workspaceId, workspaceId))
    .orderBy(desc(syncLog.startedAt))
    .limit(1)
    .get()

  if (!row) return null

  return {
    ...row,
    status: row.status as SyncStatus['status'],
  }
}

export function getRepoContext(
  workspaceId: number,
  repoFullName: string,
): RepoContext | undefined {
  return db
    .select()
    .from(repoContext)
    .where(
      sql`${repoContext.workspaceId} = ${workspaceId} AND ${repoContext.repoFullName} = ${repoFullName}`,
    )
    .get() as RepoContext | undefined
}

export function getRepoContextsForWorkspace(
  workspaceId: number,
): Map<string, string> {
  const rows = db
    .select()
    .from(repoContext)
    .where(eq(repoContext.workspaceId, workspaceId))
    .all()
  return new Map(rows.map((r) => [r.repoFullName, r.context]))
}

export function upsertRepoContext(
  workspaceId: number,
  repoFullName: string,
  context: string,
): void {
  const now = new Date().toISOString()
  const existing = getRepoContext(workspaceId, repoFullName)
  if (existing) {
    db.update(repoContext)
      .set({ context, updatedAt: now })
      .where(eq(repoContext.id, existing.id))
      .run()
  } else {
    db.insert(repoContext)
      .values({ workspaceId, repoFullName, context, updatedAt: now })
      .run()
  }
}

export function getSetting(key: string): string | undefined {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  return row?.value
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString()
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key))
      .run()
  } else {
    db.insert(settings)
      .values({ key, value, updatedAt: now })
      .run()
  }
}

export interface ScoreSnapshot {
  repoFullName: string
  score: number
  grade: string
  pillars: RepoPillars
  syncedAt: string
}

export function getScoreHistory(
  workspaceId: number,
  options?: { limit?: number; repoFullName?: string },
): ScoreSnapshot[] {
  let query = db
    .select()
    .from(scoreHistory)
    .where(eq(scoreHistory.workspaceId, workspaceId))
    .orderBy(desc(scoreHistory.syncedAt))

  const rows = options?.limit ? query.limit(options.limit).all() : query.all()

  return rows
    .filter((r) => !options?.repoFullName || r.repoFullName === options.repoFullName)
    .map((r) => ({
      repoFullName: r.repoFullName,
      score: r.score,
      grade: r.grade,
      pillars: JSON.parse(r.pillars) as RepoPillars,
      syncedAt: r.syncedAt,
    }))
}
