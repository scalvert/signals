import { and, eq, desc, sql } from 'drizzle-orm'
import { db } from './client'
import {
  workspaces,
  repos,
  pullRequests,
  signals,
  syncLog,
  repoContext,
  settings,
  scoreHistory,
  tasks,
  githubInstallations,
  workspaceMembers,
  repoPermissions,
  dispatchTargets,
  taskRuns,
} from './schema'
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
  Task,
  TaskStatus,
  TaskNote,
  WorkspaceMember,
  WorkspaceRole,
  GitHubInstallation,
  GitHubAccountType,
  RepoPermission,
  GitHubRepoPermission,
  DispatchTarget,
  DispatchTargetType,
  AgentOrchestratorConfig,
  TaskRun,
  TaskRunStatus,
  ExecutionOrchestrator,
  AgentRunner,
} from '@/types/workspace'

export function getWorkspaces(): Workspace[] {
  const rows = db.select().from(workspaces).all()
  return rows.map(parseWorkspaceRow)
}

export function getWorkspacesForUser(userId: number): Workspace[] {
  const memberships = db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .all()
  const memberWorkspaceIds = new Set(memberships.map((m) => m.workspaceId))

  return getWorkspaces().filter((workspace) =>
    memberWorkspaceIds.has(workspace.id) || workspace.userId === userId,
  )
}

export function getWorkspaceById(id: number): Workspace | undefined {
  const row = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .get()
  return row ? parseWorkspaceRow(row) : undefined
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
  userId?: number,
  githubInstallationId?: number | null,
): Workspace {
  const now = new Date().toISOString()
  const result = db
    .insert(workspaces)
    .values({
      name,
      slug,
      sources: JSON.stringify(sources),
      userId: userId ?? null,
      githubInstallationId: githubInstallationId ?? null,
      createdAt: now,
    })
    .returning()
    .get()
  const workspace = parseWorkspaceRow(result)
  if (userId) {
    upsertWorkspaceMember(workspace.id, userId, 'owner')
  }
  return workspace
}

export function deleteWorkspace(id: number): void {
  db.delete(workspaces).where(eq(workspaces.id, id)).run()
}

function parseWorkspaceRow(row: typeof workspaces.$inferSelect): Workspace {
  return {
    ...row,
    githubInstallationId: row.githubInstallationId ?? null,
    sources: JSON.parse(row.sources) as WorkspaceSource[],
    excludedRepos: JSON.parse(row.excludedRepos) as string[],
  }
}

function parseGitHubInstallationRow(
  row: typeof githubInstallations.$inferSelect,
): GitHubInstallation {
  const accountType =
    row.accountType === 'User' ? 'User' : 'Organization'
  return {
    ...row,
    accountType: accountType as GitHubAccountType,
    permissions: JSON.parse(row.permissions) as Record<string, string>,
  }
}

function parseWorkspaceMemberRow(
  row: typeof workspaceMembers.$inferSelect,
): WorkspaceMember {
  return {
    ...row,
    role: row.role as WorkspaceRole,
  }
}

function parseRepoPermissionRow(
  row: typeof repoPermissions.$inferSelect,
): RepoPermission {
  return {
    ...row,
    permission: row.permission as GitHubRepoPermission,
  }
}

function normalizeAgentOrchestratorConfig(
  value: unknown,
): AgentOrchestratorConfig {
  const config = typeof value === 'object' && value !== null
    ? value as Partial<AgentOrchestratorConfig>
    : {}
  const configuredRunners = Array.isArray(config.allowedRunners) && config.allowedRunners.length > 0
    ? config.allowedRunners.map(String).map((runner) => runner.trim()).filter(Boolean)
    : ['codex', 'claude-code', 'cursor', 'opencode']
  const allowedRunners = configuredRunners.length > 0
    ? configuredRunners
    : ['codex', 'claude-code', 'cursor', 'opencode']
  const defaultRunner = typeof config.defaultRunner === 'string' && config.defaultRunner.trim()
    ? config.defaultRunner.trim()
    : allowedRunners[0]

  return {
    aoCommand: typeof config.aoCommand === 'string' && config.aoCommand.trim()
      ? config.aoCommand.trim()
      : 'ao',
    aoCwd: typeof config.aoCwd === 'string' ? config.aoCwd.trim() : '',
    projectId: typeof config.projectId === 'string' ? config.projectId.trim() : '',
    dashboardUrl: typeof config.dashboardUrl === 'string' && config.dashboardUrl.trim()
      ? config.dashboardUrl.trim()
      : null,
    defaultRunner: allowedRunners.includes(defaultRunner)
      ? defaultRunner
      : allowedRunners[0],
    allowedRunners,
    runnerIdentity: typeof config.runnerIdentity === 'string' && config.runnerIdentity.trim()
      ? config.runnerIdentity.trim()
      : 'local runner identity',
  }
}

function parseDispatchTargetRow(
  row: typeof dispatchTargets.$inferSelect,
): DispatchTarget {
  return {
    ...row,
    type: row.type as DispatchTargetType,
    config: normalizeAgentOrchestratorConfig(JSON.parse(row.config)),
  }
}

function parseTaskRunRow(row: typeof taskRuns.$inferSelect): TaskRun {
  return {
    ...row,
    dispatchTargetId: row.dispatchTargetId ?? null,
    orchestrator: row.orchestrator as ExecutionOrchestrator,
    runner: row.runner as AgentRunner,
    status: row.status as TaskRunStatus,
    externalId: row.externalId ?? null,
    externalUrl: row.externalUrl ?? null,
    branch: row.branch ?? null,
    prUrl: row.prUrl ?? null,
    summary: row.summary ?? null,
    error: row.error ?? null,
    rawState: row.rawState ? JSON.parse(row.rawState) as Record<string, unknown> : null,
    completedAt: row.completedAt ?? null,
  }
}

export function getDispatchTargets(workspaceId: number): DispatchTarget[] {
  return db
    .select()
    .from(dispatchTargets)
    .where(eq(dispatchTargets.workspaceId, workspaceId))
    .all()
    .map(parseDispatchTargetRow)
}

export function getDispatchTargetById(id: number): DispatchTarget | undefined {
  const row = db
    .select()
    .from(dispatchTargets)
    .where(eq(dispatchTargets.id, id))
    .get()
  return row ? parseDispatchTargetRow(row) : undefined
}

export function getDispatchTargetForWorkspace(
  workspaceId: number,
  type: DispatchTargetType,
): DispatchTarget | undefined {
  const row = db
    .select()
    .from(dispatchTargets)
    .where(
      and(
        eq(dispatchTargets.workspaceId, workspaceId),
        eq(dispatchTargets.type, type),
      ),
    )
    .get()
  return row ? parseDispatchTargetRow(row) : undefined
}

export function upsertAgentOrchestratorDispatchTarget(data: {
  workspaceId: number
  name?: string
  enabled: boolean
  config: AgentOrchestratorConfig
}): DispatchTarget {
  const now = new Date().toISOString()
  const existing = getDispatchTargetForWorkspace(data.workspaceId, 'agent-orchestrator')
  const values = {
    type: 'agent-orchestrator',
    name: data.name?.trim() || 'Agent Orchestrator',
    enabled: data.enabled,
    config: JSON.stringify(normalizeAgentOrchestratorConfig(data.config)),
    updatedAt: now,
  }

  if (existing) {
    const row = db
      .update(dispatchTargets)
      .set(values)
      .where(eq(dispatchTargets.id, existing.id))
      .returning()
      .get()
    return parseDispatchTargetRow(row)
  }

  const row = db
    .insert(dispatchTargets)
    .values({
      workspaceId: data.workspaceId,
      ...values,
      createdAt: now,
    })
    .returning()
    .get()
  return parseDispatchTargetRow(row)
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

export function updateWorkspaceInstallation(
  id: number,
  githubInstallationId: number | null,
): void {
  db.update(workspaces)
    .set({ githubInstallationId })
    .where(eq(workspaces.id, id))
    .run()
}

export function upsertGitHubInstallation(data: {
  installationId: number
  accountLogin: string
  accountType: GitHubAccountType
  repositorySelection: string
  permissions: Record<string, string>
}): GitHubInstallation {
  const now = new Date().toISOString()
  const existing = db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, data.installationId))
    .get()

  if (existing) {
    const row = db
      .update(githubInstallations)
      .set({
        accountLogin: data.accountLogin,
        accountType: data.accountType,
        repositorySelection: data.repositorySelection,
        permissions: JSON.stringify(data.permissions),
        updatedAt: now,
      })
      .where(eq(githubInstallations.id, existing.id))
      .returning()
      .get()
    return parseGitHubInstallationRow(row)
  }

  const row = db
    .insert(githubInstallations)
    .values({
      installationId: data.installationId,
      accountLogin: data.accountLogin,
      accountType: data.accountType,
      repositorySelection: data.repositorySelection,
      permissions: JSON.stringify(data.permissions),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get()
  return parseGitHubInstallationRow(row)
}

export function getGitHubInstallations(): GitHubInstallation[] {
  return db
    .select()
    .from(githubInstallations)
    .all()
    .map(parseGitHubInstallationRow)
}

export function getGitHubInstallationByInstallationId(
  installationId: number,
): GitHubInstallation | undefined {
  const row = db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId))
    .get()
  return row ? parseGitHubInstallationRow(row) : undefined
}

export function upsertWorkspaceMember(
  workspaceId: number,
  userId: number,
  role: WorkspaceRole,
): WorkspaceMember {
  const now = new Date().toISOString()
  const existing = getWorkspaceMember(workspaceId, userId)
  if (existing) {
    const row = db
      .update(workspaceMembers)
      .set({ role })
      .where(eq(workspaceMembers.id, existing.id))
      .returning()
      .get()
    return parseWorkspaceMemberRow(row)
  }

  const row = db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role, joinedAt: now })
    .returning()
    .get()
  return parseWorkspaceMemberRow(row)
}

export function getWorkspaceMember(
  workspaceId: number,
  userId: number,
): WorkspaceMember | undefined {
  const row = db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .get()
  return row ? parseWorkspaceMemberRow(row) : undefined
}

export function getWorkspaceMembers(workspaceId: number): WorkspaceMember[] {
  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .all()
    .map(parseWorkspaceMemberRow)
}

export function upsertRepoPermission(data: {
  workspaceId: number
  userId: number
  repoFullName: string
  permission: GitHubRepoPermission
  canDispatch: boolean
  checkedAt?: string
}): RepoPermission {
  const checkedAt = data.checkedAt ?? new Date().toISOString()
  const existing = getRepoPermission(data.workspaceId, data.userId, data.repoFullName)
  if (existing) {
    const row = db
      .update(repoPermissions)
      .set({
        permission: data.permission,
        canDispatch: data.canDispatch,
        checkedAt,
      })
      .where(eq(repoPermissions.id, existing.id))
      .returning()
      .get()
    return parseRepoPermissionRow(row)
  }

  const row = db
    .insert(repoPermissions)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      repoFullName: data.repoFullName,
      permission: data.permission,
      canDispatch: data.canDispatch,
      checkedAt,
    })
    .returning()
    .get()
  return parseRepoPermissionRow(row)
}

export function getRepoPermission(
  workspaceId: number,
  userId: number,
  repoFullName: string,
): RepoPermission | undefined {
  const row = db
    .select()
    .from(repoPermissions)
    .where(
      and(
        eq(repoPermissions.workspaceId, workspaceId),
        eq(repoPermissions.userId, userId),
        eq(repoPermissions.repoFullName, repoFullName),
      ),
    )
    .get()
  return row ? parseRepoPermissionRow(row) : undefined
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
    fixable: row.fixable === 1,
  }
}

export function getSignalById(id: number): Signal | undefined {
  const row = db
    .select()
    .from(signals)
    .where(eq(signals.id, id))
    .get()
  if (!row) return undefined
  return parseSignalRow(row)
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
  const row = db
    .select()
    .from(repoContext)
    .where(
      sql`${repoContext.workspaceId} = ${workspaceId} AND ${repoContext.repoFullName} = ${repoFullName}`,
    )
    .get()
  if (!row) return undefined
  return {
    ...row,
    dismissedChecks: JSON.parse(row.dismissedChecks) as string[],
  }
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

export function getDismissedChecks(
  workspaceId: number,
  repoFullName: string,
): Set<string> {
  const ctx = getRepoContext(workspaceId, repoFullName)
  return new Set(ctx?.dismissedChecks ?? [])
}

export function toggleDismissedCheck(
  workspaceId: number,
  repoFullName: string,
  checkId: string,
): string[] {
  const now = new Date().toISOString()
  const existing = getRepoContext(workspaceId, repoFullName)
  const current = new Set(existing?.dismissedChecks ?? [])

  if (current.has(checkId)) {
    current.delete(checkId)
  } else {
    current.add(checkId)
  }

  const dismissedChecks = JSON.stringify(Array.from(current))

  if (existing) {
    db.update(repoContext)
      .set({ dismissedChecks, updatedAt: now })
      .where(eq(repoContext.id, existing.id))
      .run()
  } else {
    db.insert(repoContext)
      .values({ workspaceId, repoFullName, context: '', dismissedChecks, updatedAt: now })
      .run()
  }

  return Array.from(current)
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
  const query = db
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

function parseTaskRow(row: typeof tasks.$inferSelect): Task {
  return {
    ...row,
    sourceType: row.sourceType as Task['sourceType'],
    status: row.status as TaskStatus,
    provider: row.provider ?? null,
    providerRef: row.providerRef ?? null,
    dispatchState: row.dispatchState ? JSON.parse(row.dispatchState) as Record<string, unknown> : null,
    resultRef: row.resultRef ?? null,
    statusLine: row.statusLine ?? null,
    dispatchedAt: row.dispatchedAt ?? null,
    completedAt: row.completedAt ?? null,
    notes: JSON.parse(row.notes) as TaskNote[],
  }
}

export function getTasksBySource(
  workspaceId: number,
  sourceType: 'signal' | 'check',
): Map<string, Task> {
  const rows = db
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId))
    .all()

  const map = new Map<string, Task>()
  for (const row of rows) {
    const task = parseTaskRow(row)
    if (task.sourceType !== sourceType) continue
    if (task.status === 'failed') continue
    map.set(task.sourceId, task)
  }
  return map
}

export function getActiveTaskForSource(
  workspaceId: number,
  sourceType: 'signal' | 'check',
  sourceId: string,
): Task | undefined {
  const rows = db
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId))
    .all()

  return rows
    .map(parseTaskRow)
    .find(
      (t) =>
        t.sourceType === sourceType &&
        t.sourceId === sourceId &&
        t.status !== 'completed' &&
        t.status !== 'failed',
    )
}

export function getTasks(
  workspaceId: number,
  options?: { status?: TaskStatus; repoFullName?: string },
): Task[] {
  const rows = db
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId))
    .orderBy(desc(tasks.createdAt), desc(tasks.id))
    .all()

  return rows
    .map(parseTaskRow)
    .filter((t) => !options?.status || t.status === options.status)
    .filter((t) => !options?.repoFullName || t.repoFullName === options.repoFullName)
}

export function getTask(taskId: number): Task | undefined {
  const row = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get()
  if (!row) return undefined
  return parseTaskRow(row)
}

export interface RepoDashboardRow {
  repo: Repo
  signals: Signal[]
  signalTasks: Record<string, Task>
  recentTasks: Task[]
  activeTaskCount: number
  repoPermission: RepoPermission | null
  canDispatch: boolean
  permissionReason?: string
}

export function getRepoDashboardRows(workspaceId: number): RepoDashboardRow[] {
  const repos = getRepos(workspaceId)
  const signals = getSignals(workspaceId, { status: 'active' })
  const allTasks = getTasks(workspaceId)
  const signalTaskMap = getTasksBySource(workspaceId, 'signal')

  const signalsByRepo = new Map<string, Signal[]>()
  for (const signal of signals) {
    const list = signalsByRepo.get(signal.repoFullName) ?? []
    list.push(signal)
    signalsByRepo.set(signal.repoFullName, list)
  }

  const tasksByRepo = new Map<string, Task[]>()
  for (const task of allTasks) {
    const list = tasksByRepo.get(task.repoFullName) ?? []
    list.push(task)
    tasksByRepo.set(task.repoFullName, list)
  }

  return repos.map((repo) => {
    const repoSignals = signalsByRepo.get(repo.fullName) ?? []
    const repoTasks = tasksByRepo.get(repo.fullName) ?? []

    const signalTasks: Record<string, Task> = {}
    for (const signal of repoSignals) {
      const task = signalTaskMap.get(String(signal.id))
      if (task) signalTasks[String(signal.id)] = task
    }

    return {
      repo,
      signals: repoSignals,
      signalTasks,
      recentTasks: repoTasks.slice(0, 5),
      activeTaskCount: repoTasks.filter((t) => t.status === 'active').length,
      repoPermission: null,
      canDispatch: false,
      permissionReason: 'Repository permission has not been checked for this user.',
    }
  })
}

export function createTask(data: {
  workspaceId: number
  repoFullName: string
  title: string
  description: string
  sourceType: 'signal' | 'check'
  sourceId: string
}): Task {
  const now = new Date().toISOString()
  const row = db
    .insert(tasks)
    .values({
      ...data,
      status: 'pending',
      createdAt: now,
    })
    .returning()
    .get()
  return parseTaskRow(row)
}

export function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
  updates?: {
    provider?: string
    providerRef?: string
    resultRef?: string
    statusLine?: string
    dispatchState?: Record<string, unknown>
  },
): Task | undefined {
  const now = new Date().toISOString()
  const set: Record<string, unknown> = { status }
  if (status === 'active') set.dispatchedAt = now
  if (status === 'completed' || status === 'failed') set.completedAt = now
  if (updates?.provider) set.provider = updates.provider
  if (updates?.providerRef) set.providerRef = updates.providerRef
  if (updates?.resultRef) set.resultRef = updates.resultRef
  if (updates?.statusLine) set.statusLine = updates.statusLine
  if (updates?.dispatchState) set.dispatchState = JSON.stringify(updates.dispatchState)

  const row = db
    .update(tasks)
    .set(set)
    .where(eq(tasks.id, taskId))
    .returning()
    .get()
  if (!row) return undefined
  return parseTaskRow(row)
}

export function updateTaskSummary(
  taskId: number,
  updates: {
    status?: TaskStatus
    provider?: string | null
    providerRef?: string | null
    resultRef?: string | null
    statusLine?: string | null
    dispatchState?: Record<string, unknown> | null
    completedAt?: string | null
  },
): Task | undefined {
  const set: Record<string, unknown> = {}
  if (updates.status) set.status = updates.status
  if (updates.provider !== undefined) set.provider = updates.provider
  if (updates.providerRef !== undefined) set.providerRef = updates.providerRef
  if (updates.resultRef !== undefined) set.resultRef = updates.resultRef
  if (updates.statusLine !== undefined) set.statusLine = updates.statusLine
  if (updates.dispatchState !== undefined) {
    set.dispatchState = updates.dispatchState ? JSON.stringify(updates.dispatchState) : null
  }
  if (updates.completedAt !== undefined) set.completedAt = updates.completedAt

  const row = db
    .update(tasks)
    .set(set)
    .where(eq(tasks.id, taskId))
    .returning()
    .get()
  if (!row) return undefined
  return parseTaskRow(row)
}

export function createTaskRun(data: {
  taskId: number
  workspaceId: number
  dispatchTargetId: number | null
  orchestrator: ExecutionOrchestrator
  runner: AgentRunner
  status: TaskRunStatus
  externalId?: string | null
  externalUrl?: string | null
  branch?: string | null
  prUrl?: string | null
  summary?: string | null
  error?: string | null
  rawState?: Record<string, unknown> | null
  dispatchedByUserId: number
  executedByIdentity: string
}): TaskRun {
  const now = new Date().toISOString()
  const row = db
    .insert(taskRuns)
    .values({
      ...data,
      externalId: data.externalId ?? null,
      externalUrl: data.externalUrl ?? null,
      branch: data.branch ?? null,
      prUrl: data.prUrl ?? null,
      summary: data.summary ?? null,
      error: data.error ?? null,
      rawState: data.rawState ? JSON.stringify(data.rawState) : null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    .returning()
    .get()
  return parseTaskRunRow(row)
}

export function getTaskRuns(taskId: number): TaskRun[] {
  return db
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskId, taskId))
    .orderBy(desc(taskRuns.createdAt), desc(taskRuns.id))
    .all()
    .map(parseTaskRunRow)
}

export function getLatestTaskRun(taskId: number): TaskRun | undefined {
  const row = db
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskId, taskId))
    .orderBy(desc(taskRuns.createdAt), desc(taskRuns.id))
    .limit(1)
    .get()
  return row ? parseTaskRunRow(row) : undefined
}

export function updateTaskRun(
  runId: number,
  updates: {
    status?: TaskRunStatus
    externalId?: string | null
    externalUrl?: string | null
    branch?: string | null
    prUrl?: string | null
    summary?: string | null
    error?: string | null
    rawState?: Record<string, unknown> | null
    completedAt?: string | null
  },
): TaskRun | undefined {
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (updates.status) set.status = updates.status
  if (updates.externalId !== undefined) set.externalId = updates.externalId
  if (updates.externalUrl !== undefined) set.externalUrl = updates.externalUrl
  if (updates.branch !== undefined) set.branch = updates.branch
  if (updates.prUrl !== undefined) set.prUrl = updates.prUrl
  if (updates.summary !== undefined) set.summary = updates.summary
  if (updates.error !== undefined) set.error = updates.error
  if (updates.rawState !== undefined) {
    set.rawState = updates.rawState ? JSON.stringify(updates.rawState) : null
  }
  if (updates.completedAt !== undefined) set.completedAt = updates.completedAt

  const row = db
    .update(taskRuns)
    .set(set)
    .where(eq(taskRuns.id, runId))
    .returning()
    .get()
  return row ? parseTaskRunRow(row) : undefined
}

export function addTaskNote(
  taskId: number,
  text: string,
  source: 'agent' | 'system',
): Task | undefined {
  const task = getTask(taskId)
  if (!task) return undefined

  const notes: TaskNote[] = [...task.notes, { text, timestamp: new Date().toISOString(), source }]
  const row = db
    .update(tasks)
    .set({ notes: JSON.stringify(notes) })
    .where(eq(tasks.id, taskId))
    .returning()
    .get()
  if (!row) return undefined
  return parseTaskRow(row)
}
