import { NextResponse } from 'next/server'
import { getTask, updateTaskStatus } from '@/lib/db/queries'
import { dispatchTask, getDefaultProvider } from '@/lib/tasks/dispatch'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const taskId = Number(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  const task = getTask(taskId)
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (task.status !== 'pending') {
    return NextResponse.json({ error: `Task is already ${task.status}` }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const providerType = (body as { provider?: string }).provider ?? getDefaultProvider()

  const result = await dispatchTask(task, providerType)

  if (result.success) {
    const updated = updateTaskStatus(taskId, 'dispatched', {
      provider: providerType,
      providerRef: result.providerRef,
    })
    return NextResponse.json({ task: updated })
  }

  return NextResponse.json({ error: result.error }, { status: 500 })
}
