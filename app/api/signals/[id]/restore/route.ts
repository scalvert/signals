import { NextResponse } from 'next/server'
import { restoreSignal } from '@/lib/db/queries'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const signalId = Number(id)
  if (isNaN(signalId)) {
    return NextResponse.json({ error: 'Invalid signal ID' }, { status: 400 })
  }

  const restored = restoreSignal(signalId)
  if (!restored) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  return NextResponse.json({ signal: restored })
}
