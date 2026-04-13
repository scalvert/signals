import { NextResponse } from 'next/server'
import { dismissSignal, getRepoContext, upsertRepoContext } from '@/lib/db/queries'
import { signals } from '@/lib/db/schema'
import { db } from '@/lib/db/client'
import { eq } from 'drizzle-orm'

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

  const signal = db
    .select()
    .from(signals)
    .where(eq(signals.id, signalId))
    .get()

  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  const dismissed = dismissSignal(signalId, reason)

  const existing = getRepoContext(signal.workspaceId, signal.repoFullName)
  const newContext = existing
    ? `${existing.context}\n${reason}`
    : reason
  upsertRepoContext(signal.workspaceId, signal.repoFullName, newContext)

  return NextResponse.json({ signal: dismissed })
}
