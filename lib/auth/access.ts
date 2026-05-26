import { NextResponse } from 'next/server'
import { getAuth } from './config'
import {
  getWorkspaceById,
  getWorkspaceBySlug,
  getWorkspaceMember,
  getTask,
  upsertWorkspaceMember,
} from '@/lib/db/queries'
import { ensureUserFromSession } from './users'
import { canUserAccessInstallation } from '@/lib/github/installations'
import type { Session } from 'next-auth'
import type { Task, Workspace, WorkspaceMember, WorkspaceRole } from '@/types/workspace'

export class AccessError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message: string,
  ) {
    super(message)
  }
}

export interface AccessSession {
  session: Session
  userId: number
  githubLogin: string
}

export interface WorkspaceAccess extends AccessSession {
  workspace: Workspace
  membership: WorkspaceMember
}

export interface TaskAccess extends WorkspaceAccess {
  task: Task
}

export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  throw error
}

export async function requireSession(): Promise<AccessSession> {
  const { auth } = getAuth()
  const session = await auth()
  if (session?.error) {
    throw new AccessError(401, 'Authentication refresh required')
  }
  const ensuredUser = session ? ensureUserFromSession(session) : null
  const userId = ensuredUser?.id ?? (session?.user?.id ? Number(session.user.id) : NaN)

  if (!session?.user?.githubLogin || !Number.isFinite(userId)) {
    throw new AccessError(401, 'Not authenticated')
  }

  return {
    session,
    userId,
    githubLogin: ensuredUser?.githubLogin ?? session.user.githubLogin,
  }
}

async function autoJoinWorkspace(
  workspace: Workspace,
  user: AccessSession,
): Promise<WorkspaceMember | undefined> {
  if (!workspace.githubInstallationId) return undefined

  let canJoin = false
  try {
    canJoin = await canUserAccessInstallation(
      workspace.githubInstallationId,
      user.githubLogin,
    )
  } catch {
    // Auto-join is opportunistic. If GitHub/app auth is unavailable, fail closed
    // and require explicit membership instead of turning access checks into 500s.
    return undefined
  }

  if (!canJoin) return undefined
  return upsertWorkspaceMember(workspace.id, user.userId, 'member')
}

export async function requireWorkspaceAccess(
  workspaceId: number,
): Promise<WorkspaceAccess> {
  const user = await requireSession()
  const workspace = getWorkspaceById(workspaceId)
  if (!workspace) throw new AccessError(404, 'Workspace not found')

  let membership = getWorkspaceMember(workspace.id, user.userId)
  if (!membership && workspace.userId === user.userId) {
    membership = upsertWorkspaceMember(workspace.id, user.userId, 'owner')
  }
  if (!membership) {
    membership = await autoJoinWorkspace(workspace, user)
  }
  if (!membership) throw new AccessError(403, 'Workspace access denied')

  return { ...user, workspace, membership }
}

export async function requireWorkspaceAccessBySlug(
  slug: string,
): Promise<WorkspaceAccess> {
  const user = await requireSession()
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) throw new AccessError(404, 'Workspace not found')

  let membership = getWorkspaceMember(workspace.id, user.userId)
  if (!membership && workspace.userId === user.userId) {
    membership = upsertWorkspaceMember(workspace.id, user.userId, 'owner')
  }
  if (!membership) {
    membership = await autoJoinWorkspace(workspace, user)
  }
  if (!membership) throw new AccessError(403, 'Workspace access denied')

  return { ...user, workspace, membership }
}

export async function requireWorkspaceRole(
  workspaceId: number,
  roles: WorkspaceRole[],
): Promise<WorkspaceAccess> {
  const access = await requireWorkspaceAccess(workspaceId)
  if (!roles.includes(access.membership.role)) {
    throw new AccessError(403, 'Workspace role is not allowed')
  }
  return access
}

export async function requireTaskAccess(taskId: number): Promise<TaskAccess> {
  const task = getTask(taskId)
  if (!task) throw new AccessError(404, 'Task not found')
  const access = await requireWorkspaceAccess(task.workspaceId)
  return { ...access, task }
}
