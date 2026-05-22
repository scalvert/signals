import { NextResponse } from 'next/server'
import { toggleDismissedCheck } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess } from '@/lib/auth/access'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, repoFullName, checkId } = body as {
    workspaceId: number
    repoFullName: string
    checkId: string
  }

  if (!workspaceId || !repoFullName || !checkId) {
    return NextResponse.json(
      { error: 'workspaceId, repoFullName, and checkId are required' },
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

  const dismissedChecks = toggleDismissedCheck(workspaceId, repoFullName, checkId)
  return NextResponse.json({ dismissedChecks })
}
