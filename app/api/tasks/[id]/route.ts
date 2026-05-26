import { NextResponse } from 'next/server'
import { accessErrorResponse, requireTaskAccess } from '@/lib/auth/access'
import { syncLatestTaskRun } from '@/lib/dispatch/runs'

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
    if (task.status === 'active') {
      const synced = await syncLatestTaskRun(taskId)
      return NextResponse.json({ task: synced.task ?? task, run: synced.run })
    }
    return NextResponse.json({ task })
  } catch (error) {
    return accessErrorResponse(error)
  }
}
