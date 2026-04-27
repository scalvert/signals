import { NextResponse } from 'next/server'
import { getTask, getSignalById, updateTaskStatus } from '@/lib/db/queries'
import { getAuth } from '@/lib/auth/config'
import { registry } from '@/lib/signals/registry'
import '@/lib/signals/definitions'
import { executeLlmDispatch } from '@/lib/tasks/executors/llm'

export async function POST(
  _req: Request,
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

  const { auth } = getAuth()
  const session = await auth()
  const token = session?.accessToken
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let signalType: string | undefined
  if (task.sourceType === 'signal') {
    const signal = getSignalById(Number(task.sourceId))
    signalType = signal?.type
  } else {
    signalType = task.sourceId
  }

  if (!signalType) {
    return NextResponse.json({ error: 'Could not resolve signal type' }, { status: 400 })
  }

  const definition = registry.get(signalType)
  const fixInfo = definition?.meta.fixInfo

  if (!fixInfo || !('dispatch' in fixInfo)) {
    return NextResponse.json({ error: 'This signal does not support dispatch' }, { status: 400 })
  }

  updateTaskStatus(taskId, 'active')

  try {
    if (fixInfo.dispatch === 'auto') {
      const [owner, name] = task.repoFullName.split('/')
      const { getOctokit } = await import('@/lib/github/client')
      const octokit = getOctokit(token)
      const signal = task.sourceType === 'signal' ? getSignalById(Number(task.sourceId)) : undefined

      const result = await fixInfo.action({
        repo: { owner, name, fullName: task.repoFullName },
        metadata: signal?.metadata ?? {},
        octokit,
      })

      const updated = updateTaskStatus(taskId, result.success ? 'completed' : 'failed', {
        resultRef: result.resultRef,
        statusLine: result.statusLine,
        dispatchState: result.error ? { error: result.error } : undefined,
      })
      return NextResponse.json({ task: updated })
    }

    if (fixInfo.dispatch === 'llm') {
      const signal = getSignalById(Number(task.sourceId))
      if (!signal) {
        updateTaskStatus(taskId, 'failed', { statusLine: 'Signal not found' })
        return NextResponse.json({ error: 'Signal not found' }, { status: 400 })
      }

      const result = await executeLlmDispatch(task, signal, fixInfo, token)

      const updated = updateTaskStatus(taskId, result.success ? 'completed' : 'failed', {
        resultRef: result.resultRef,
        statusLine: result.statusLine,
        dispatchState: result.error ? { error: result.error } : undefined,
      })
      return NextResponse.json({ task: updated })
    }

    if (fixInfo.dispatch === 'agent') {
      updateTaskStatus(taskId, 'pending', { statusLine: 'Agent dispatch not yet available' })
      return NextResponse.json({ error: 'Agent dispatch not yet available' }, { status: 501 })
    }

    return NextResponse.json({ error: 'Unknown dispatch type' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    updateTaskStatus(taskId, 'failed', { statusLine: `Failed: ${message.slice(0, 100)}` })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
