import { eq, desc, sql } from 'drizzle-orm'
import { db } from './client'
import { workspaces, repos, pullRequests, signals, syncLog } from './schema'
import type {
  Workspace,
  WorkspaceSource,
  Repo,
  PullRequest,
  Signal,
  WorkspaceStats,
  SyncStatus,
  RepoPillars,
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
  }
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

export function getSignals(
  workspaceId: number,
  options?: { limit?: number },
): Signal[] {
  const query = db
    .select()
    .from(signals)
    .where(eq(signals.workspaceId, workspaceId))
    .orderBy(desc(signals.detectedAt))

  const rows = options?.limit ? query.limit(options.limit).all() : query.all()

  return rows.map((row) => ({
    ...row,
    type: row.type as Signal['type'],
    severity: row.severity as Signal['severity'],
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }))
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
