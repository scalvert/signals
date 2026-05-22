import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client')

import { sqlite } from './__mocks__/client'
import {
  createTask,
  updateTaskStatus,
  getRepoDashboardRows,
  getRepoPermission,
  getWorkspaceMember,
  upsertRepoPermission,
  upsertWorkspaceMember,
} from './queries'

function seedWorkspace(): number {
  const stmt = sqlite.prepare(
    `INSERT INTO workspaces (name, slug, sources, excluded_repos, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const result = stmt.run('Test', 'test-ws', '[]', '[]', new Date().toISOString())
  return Number(result.lastInsertRowid)
}

function seedRepo(workspaceId: number, fullName: string, overrides: Partial<{ score: number; grade: string; triage: string }> = {}): void {
  const [, name] = fullName.split('/')
  sqlite.prepare(
    `INSERT INTO repos (workspace_id, name, full_name, url, pillars, score, grade, triage, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    name,
    fullName,
    `https://github.com/${fullName}`,
    JSON.stringify({ activity: 50, community: 50, quality: 50, security: 50 }),
    overrides.score ?? 75,
    overrides.grade ?? 'B',
    overrides.triage ?? 'healthy',
    new Date().toISOString(),
  )
}

function seedSignal(workspaceId: number, repoFullName: string, type: string, status: 'active' | 'dismissed' = 'active'): number {
  const result = sqlite.prepare(
    `INSERT INTO signals (workspace_id, type, severity, title, body, repo_full_name, detected_at, status, fixable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    type,
    'warning',
    `${type} on ${repoFullName}`,
    'body',
    repoFullName,
    new Date().toISOString(),
    status,
    1,
  )
  return Number(result.lastInsertRowid)
}

describe('getRepoDashboardRows', () => {
  let workspaceId: number

  beforeEach(() => {
    sqlite.exec('DELETE FROM repo_permissions')
    sqlite.exec('DELETE FROM workspace_members')
    sqlite.exec('DELETE FROM tasks')
    sqlite.exec('DELETE FROM signals')
    sqlite.exec('DELETE FROM repos')
    sqlite.exec('DELETE FROM workspaces')
    workspaceId = seedWorkspace()
  })

  it('returns one row per repo', () => {
    seedRepo(workspaceId, 'org/a')
    seedRepo(workspaceId, 'org/b')

    const rows = getRepoDashboardRows(workspaceId)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.repo.fullName).sort()).toEqual(['org/a', 'org/b'])
  })

  it('joins active signals to their repo', () => {
    seedRepo(workspaceId, 'org/a')
    seedRepo(workspaceId, 'org/b')
    seedSignal(workspaceId, 'org/a', 'stale-prs')
    seedSignal(workspaceId, 'org/a', 'health-drop')
    seedSignal(workspaceId, 'org/b', 'star-spike')

    const rows = getRepoDashboardRows(workspaceId)
    const a = rows.find((r) => r.repo.fullName === 'org/a')!
    const b = rows.find((r) => r.repo.fullName === 'org/b')!

    expect(a.signals).toHaveLength(2)
    expect(b.signals).toHaveLength(1)
  })

  it('excludes dismissed signals', () => {
    seedRepo(workspaceId, 'org/a')
    seedSignal(workspaceId, 'org/a', 'stale-prs', 'active')
    seedSignal(workspaceId, 'org/a', 'old-noise', 'dismissed')

    const rows = getRepoDashboardRows(workspaceId)

    expect(rows[0].signals).toHaveLength(1)
    expect(rows[0].signals[0].type).toBe('stale-prs')
  })

  it('joins active task to its signal via signalTasks map', () => {
    seedRepo(workspaceId, 'org/a')
    const signalId = seedSignal(workspaceId, 'org/a', 'stale-prs')
    const task = createTask({
      workspaceId,
      repoFullName: 'org/a',
      title: 'Fix stale PRs',
      description: 'desc',
      sourceType: 'signal',
      sourceId: String(signalId),
    })

    const rows = getRepoDashboardRows(workspaceId)

    expect(rows[0].signalTasks[String(signalId)]).toBeDefined()
    expect(rows[0].signalTasks[String(signalId)].id).toBe(task.id)
  })

  it('counts active tasks per repo', () => {
    seedRepo(workspaceId, 'org/a')
    const signalId = seedSignal(workspaceId, 'org/a', 'stale-prs')
    const task = createTask({
      workspaceId,
      repoFullName: 'org/a',
      title: 't',
      description: 'd',
      sourceType: 'signal',
      sourceId: String(signalId),
    })
    updateTaskStatus(task.id, 'active')

    const rows = getRepoDashboardRows(workspaceId)

    expect(rows[0].activeTaskCount).toBe(1)
  })

  it('returns up to 5 recent tasks per repo, newest first', () => {
    seedRepo(workspaceId, 'org/a')
    for (let i = 1; i <= 7; i++) {
      createTask({
        workspaceId,
        repoFullName: 'org/a',
        title: `task ${i}`,
        description: 'd',
        sourceType: 'signal',
        sourceId: `s-${i}`,
      })
    }

    const rows = getRepoDashboardRows(workspaceId)

    expect(rows[0].recentTasks).toHaveLength(5)
    expect(rows[0].recentTasks[0].title).toBe('task 7')
  })

  it('returns empty signals/tasks for repos with no activity', () => {
    seedRepo(workspaceId, 'org/quiet')

    const rows = getRepoDashboardRows(workspaceId)

    expect(rows[0].signals).toEqual([])
    expect(rows[0].recentTasks).toEqual([])
    expect(rows[0].activeTaskCount).toBe(0)
    expect(rows[0].signalTasks).toEqual({})
  })
})

describe('workspace membership and permissions', () => {
  let workspaceId: number

  beforeEach(() => {
    sqlite.exec('DELETE FROM repo_permissions')
    sqlite.exec('DELETE FROM workspace_members')
    sqlite.exec('DELETE FROM workspaces')
    workspaceId = seedWorkspace()
  })

  it('upserts a workspace member role', () => {
    upsertWorkspaceMember(workspaceId, 123, 'member')
    upsertWorkspaceMember(workspaceId, 123, 'owner')

    const member = getWorkspaceMember(workspaceId, 123)

    expect(member?.role).toBe('owner')
  })

  it('stores repo dispatch permission', () => {
    upsertRepoPermission({
      workspaceId,
      userId: 123,
      repoFullName: 'org/a',
      permission: 'write',
      canDispatch: true,
    })

    const permission = getRepoPermission(workspaceId, 123, 'org/a')

    expect(permission?.permission).toBe('write')
    expect(permission?.canDispatch).toBe(true)
  })
})
