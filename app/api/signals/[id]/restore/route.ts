import { NextResponse } from 'next/server'
import { getSignalById, restoreSignal } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess } from '@/lib/auth/access'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const signalId = Number(id)
  if (isNaN(signalId)) {
    return NextResponse.json({ error: 'Invalid signal ID' }, { status: 400 })
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

  const restored = restoreSignal(signalId)
  if (!restored) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  return NextResponse.json({ signal: restored })
}
