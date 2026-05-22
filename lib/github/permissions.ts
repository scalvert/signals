import {
  getRepoPermission,
  upsertRepoPermission,
  type RepoDashboardRow,
} from '@/lib/db/queries'
import { getUserToken } from '@/lib/auth/users'
import { getOctokit } from './client'
import type { GitHubRepoPermission, RepoPermission } from '@/types/workspace'

const DISPATCH_PERMISSIONS = new Set<GitHubRepoPermission>(['write', 'maintain', 'admin'])
const PERMISSION_TTL_MS = 60 * 60 * 1000

function normalizePermission(permission: string | undefined): GitHubRepoPermission {
  if (
    permission === 'read' ||
    permission === 'triage' ||
    permission === 'write' ||
    permission === 'maintain' ||
    permission === 'admin'
  ) {
    return permission
  }
  return 'none'
}

function isFresh(permission: RepoPermission): boolean {
  return Date.now() - new Date(permission.checkedAt).getTime() < PERMISSION_TTL_MS
}

export function canDispatchWithPermission(permission: GitHubRepoPermission): boolean {
  return DISPATCH_PERMISSIONS.has(permission)
}

export async function refreshRepoPermission(
  workspaceId: number,
  userId: number,
  githubLogin: string,
  repoFullName: string,
  options?: { force?: boolean },
): Promise<RepoPermission> {
  const cached = getRepoPermission(workspaceId, userId, repoFullName)
  if (cached && !options?.force && isFresh(cached)) return cached

  const token = getUserToken(userId)
  if (!token) {
    return upsertRepoPermission({
      workspaceId,
      userId,
      repoFullName,
      permission: 'none',
      canDispatch: false,
    })
  }

  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) {
    return upsertRepoPermission({
      workspaceId,
      userId,
      repoFullName,
      permission: 'none',
      canDispatch: false,
    })
  }

  const octokit = getOctokit(token)
  try {
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: githubLogin,
    })
    const permission = normalizePermission(response.data.permission)
    return upsertRepoPermission({
      workspaceId,
      userId,
      repoFullName,
      permission,
      canDispatch: canDispatchWithPermission(permission),
    })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: number }).status)
      : 0
    if (status === 403 || status === 404) {
      return upsertRepoPermission({
        workspaceId,
        userId,
        repoFullName,
        permission: 'none',
        canDispatch: false,
      })
    }
    throw error
  }
}

export async function applyRepoPermissionsToDashboardRows(
  rows: RepoDashboardRow[],
  workspaceId: number,
  userId: number,
  githubLogin: string,
): Promise<RepoDashboardRow[]> {
  const results: RepoDashboardRow[] = []
  for (const row of rows) {
    const permission = await refreshRepoPermission(
      workspaceId,
      userId,
      githubLogin,
      row.repo.fullName,
    )
    results.push({
      ...row,
      repoPermission: permission,
      canDispatch: permission.canDispatch,
      permissionReason: permission.canDispatch
        ? undefined
        : 'Requires write access on GitHub.',
    })
  }
  return results
}

export async function requireRepoDispatchPermission(
  workspaceId: number,
  userId: number,
  githubLogin: string,
  repoFullName: string,
): Promise<RepoPermission> {
  const permission = await refreshRepoPermission(
    workspaceId,
    userId,
    githubLogin,
    repoFullName,
    { force: true },
  )
  if (!permission.canDispatch) {
    throw new Error('Requires write access on GitHub')
  }
  return permission
}

