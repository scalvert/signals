import { NextResponse } from 'next/server'
import { accessErrorResponse, requireTaskAccess } from '@/lib/auth/access'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const taskId = Number(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  try {
    const { task } = await requireTaskAccess(taskId)
    return NextResponse.json({ task })
  } catch (error) {
    return accessErrorResponse(error)
  }
}
