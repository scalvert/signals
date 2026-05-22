import { NextResponse } from 'next/server'
import { dismissSignal, getRepoContext, getSignalById, upsertRepoContext } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess } from '@/lib/auth/access'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const signalId = Number(id)
  if (isNaN(signalId)) {
    return NextResponse.json({ error: 'Invalid signal ID' }, { status: 400 })
  }

  const body = await req.json()
  const reason = body.reason as string
  if (!reason || typeof reason !== 'string') {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  const signal = getSignalById(signalId)

  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  try {
    const access = await requireWorkspaceAccess(signal.workspaceId)
    if (access.membership.role === 'viewer') {
      return NextResponse.json({ error: 'Workspace role is not allowed' }, { status: 403 })
    }
  } catch (error) {
    return accessErrorResponse(error)
  }

  const dismissed = dismissSignal(signalId, reason)

  const existing = getRepoContext(signal.workspaceId, signal.repoFullName)
  const newContext = existing
    ? `${existing.context}\n${reason}`
    : reason
  upsertRepoContext(signal.workspaceId, signal.repoFullName, newContext)

  return NextResponse.json({ signal: dismissed })
}
