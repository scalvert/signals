import { NextResponse } from 'next/server'
import { getRepoContext, upsertRepoContext } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess } from '@/lib/auth/access'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = Number(url.searchParams.get('workspaceId'))
  const repo = url.searchParams.get('repo')

  if (isNaN(workspaceId) || !repo) {
    return NextResponse.json(
      { error: 'workspaceId and repo are required' },
      { status: 400 },
    )
  }

  try {
    await requireWorkspaceAccess(workspaceId)
  } catch (error) {
    return accessErrorResponse(error)
  }

  const context = getRepoContext(workspaceId, repo)
  return NextResponse.json({ context: context ?? null })
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { workspaceId, repoFullName, context } = body as {
    workspaceId: number
    repoFullName: string
    context: string
  }

  if (!workspaceId || !repoFullName || typeof context !== 'string') {
    return NextResponse.json(
      { error: 'workspaceId, repoFullName, and context are required' },
      { status: 400 },
    )
  }

  try {
    const access = await requireWorkspaceAccess(workspaceId)
    if (access.membership.role === 'viewer') {
      return NextResponse.json({ error: 'Workspace role is not allowed' }, { status: 403 })
    }
  } catch (error) {
    return accessErrorResponse(error)
  }

  upsertRepoContext(workspaceId, repoFullName, context)
  return NextResponse.json({ success: true })
}
