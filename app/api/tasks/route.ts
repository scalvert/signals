import { NextResponse } from 'next/server'
import { createTask, getTasks, getActiveTaskForSource } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess } from '@/lib/auth/access'
import type { TaskStatus } from '@/types/workspace'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = Number(url.searchParams.get('workspaceId'))
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  try {
    await requireWorkspaceAccess(workspaceId)
  } catch (error) {
    return accessErrorResponse(error)
  }

  const status = url.searchParams.get('status') as TaskStatus | null
  const repo = url.searchParams.get('repo') ?? undefined
  const tasks = getTasks(workspaceId, { status: status ?? undefined, repoFullName: repo })
  return NextResponse.json({ tasks })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { workspaceId, repoFullName, title, description, sourceType, sourceId } = body as {
      workspaceId: number
      repoFullName: string
      title: string
      description: string
      sourceType: 'signal' | 'check'
      sourceId: string
    }

    if (!workspaceId || !repoFullName || !title || !description || !sourceType || !sourceId) {
      return NextResponse.json(
        { error: 'workspaceId, repoFullName, title, description, sourceType, and sourceId are required' },
        { status: 400 },
      )
    }

    const access = await requireWorkspaceAccess(workspaceId)
    if (access.membership.role === 'viewer') {
      return NextResponse.json({ error: 'Workspace role is not allowed' }, { status: 403 })
    }

    const existing = getActiveTaskForSource(workspaceId, sourceType, sourceId)
    if (existing) {
      return NextResponse.json(
        { error: 'A task already exists for this item', task: existing },
        { status: 409 },
      )
    }

    const task = createTask({ workspaceId, repoFullName, title, description, sourceType, sourceId })
    return NextResponse.json({ task })
  } catch (error) {
    return accessErrorResponse(error)
  }
}
