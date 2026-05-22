import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; githubLogin: string; avatarUrl: string }
    accessToken: string
  },
}))

const githubInstallationState = vi.hoisted(() => ({
  canUserAccessInstallation: vi.fn(),
}))

vi.mock('../db/client')
vi.mock('./config', () => ({
  getAuth: () => ({
    auth: async () => authState.session,
  }),
}))
vi.mock('@/lib/github/installations', () => ({
  canUserAccessInstallation: githubInstallationState.canUserAccessInstallation,
}))

import { sqlite } from '../db/__mocks__/client'
import {
  AccessError,
  requireTaskAccess,
  requireWorkspaceAccess,
} from './access'
import { getWorkspaceMember } from '@/lib/db/queries'

function setSession(userId: number, githubLogin: string) {
  authState.session = {
    user: {
      id: String(userId),
      githubLogin,
      avatarUrl: `https://avatars.githubusercontent.com/u/${userId}?v=4`,
    },
    accessToken: `gho_user_${userId}`,
  }
}

function seedWorkspace(options?: { installationId?: number | null }) {
  const now = new Date().toISOString()
  const result = sqlite.prepare(
    `INSERT INTO workspaces (user_id, github_installation_id, name, slug, sources, excluded_repos, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    1,
    options?.installationId ?? 424242,
    'Test',
    `test-${Math.random().toString(36).slice(2)}`,
    '[]',
    '[]',
    now,
  )
  return Number(result.lastInsertRowid)
}

function seedMember(workspaceId: number, userId: number, role: 'owner' | 'member' | 'viewer') {
  sqlite.prepare(
    `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
     VALUES (?, ?, ?, ?)`,
  ).run(workspaceId, userId, role, new Date().toISOString())
}

function seedTask(workspaceId: number) {
  const result = sqlite.prepare(
    `INSERT INTO tasks (workspace_id, repo_full_name, title, description, source_type, source_id, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    'org/repo',
    'Task',
    'Description',
    'signal',
    '1',
    'pending',
    '[]',
    new Date().toISOString(),
  )
  return Number(result.lastInsertRowid)
}

describe('workspace access', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM tasks')
    sqlite.exec('DELETE FROM workspace_members')
    sqlite.exec('DELETE FROM workspaces')
    githubInstallationState.canUserAccessInstallation.mockReset()
    authState.session = null
  })

  it('allows explicit workspace members', async () => {
    const workspaceId = seedWorkspace()
    seedMember(workspaceId, 2, 'member')
    setSession(2, 'octo-member')

    const access = await requireWorkspaceAccess(workspaceId)

    expect(access.membership.role).toBe('member')
  })

  it('backfills the legacy workspace creator as owner', async () => {
    const workspaceId = seedWorkspace()
    setSession(1, 'octo-owner')

    const access = await requireWorkspaceAccess(workspaceId)

    expect(access.membership.role).toBe('owner')
    expect(getWorkspaceMember(workspaceId, 1)?.role).toBe('owner')
  })

  it('auto-joins a GitHub org member', async () => {
    const workspaceId = seedWorkspace({ installationId: 424242 })
    githubInstallationState.canUserAccessInstallation.mockResolvedValue(true)
    setSession(2, 'octo-member')

    const access = await requireWorkspaceAccess(workspaceId)

    expect(access.membership.role).toBe('member')
    expect(getWorkspaceMember(workspaceId, 2)?.role).toBe('member')
  })

  it('rejects non-members when auto-join verifier says no', async () => {
    const workspaceId = seedWorkspace({ installationId: 424242 })
    githubInstallationState.canUserAccessInstallation.mockResolvedValue(false)
    setSession(2, 'octo-outsider')

    await expect(requireWorkspaceAccess(workspaceId)).rejects.toMatchObject({
      status: 403,
      message: 'Workspace access denied',
    } satisfies Partial<AccessError>)
  })

  it('fails closed when auto-join verification errors', async () => {
    const workspaceId = seedWorkspace({ installationId: 424242 })
    const taskId = seedTask(workspaceId)
    githubInstallationState.canUserAccessInstallation.mockRejectedValue(
      new Error('GitHub App credentials are missing'),
    )
    setSession(2, 'octo-outsider')

    await expect(requireTaskAccess(taskId)).rejects.toMatchObject({
      status: 403,
      message: 'Workspace access denied',
    } satisfies Partial<AccessError>)
  })
})
