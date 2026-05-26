import {
  getDispatchTargetById,
  getLatestTaskRun,
  getTask,
  updateTaskRun,
  updateTaskSummary,
} from '@/lib/db/queries'
import {
  getAgentOrchestratorSession,
  mapAoSessionToTaskRun,
} from './agent-orchestrator'
import type { Task, TaskRun, TaskRunStatus } from '@/types/workspace'

const TERMINAL_RUN_STATUSES = new Set<TaskRunStatus>([
  'completed',
  'failed',
  'cancelled',
])

export async function syncLatestTaskRun(taskId: number): Promise<{
  task: Task | undefined
  run: TaskRun | undefined
}> {
  const task = getTask(taskId)
  if (!task) return { task: undefined, run: undefined }

  const run = getLatestTaskRun(taskId)
  if (!run || run.orchestrator !== 'agent-orchestrator') {
    return { task, run }
  }
  if (!run.externalId || TERMINAL_RUN_STATUSES.has(run.status)) {
    return { task, run }
  }
  if (!run.dispatchTargetId) {
    return { task, run }
  }

  const target = getDispatchTargetById(run.dispatchTargetId)
  if (!target || target.type !== 'agent-orchestrator') {
    return { task, run }
  }

  let session
  try {
    session = await getAgentOrchestratorSession(target.config, run.externalId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const updatedTask = updateTaskSummary(task.id, {
      statusLine: `AO status unavailable: ${message.slice(0, 100)}`,
    }) ?? task
    return { task: updatedTask, run }
  }
  if (!session) {
    const updatedTask = updateTaskSummary(task.id, {
      statusLine: `AO session ${run.externalId} has not reported status yet.`,
    }) ?? task
    return { task: updatedTask, run }
  }

  const mapped = mapAoSessionToTaskRun(session)
  const completedAt = TERMINAL_RUN_STATUSES.has(mapped.status)
    ? new Date().toISOString()
    : null
  const updatedRun = updateTaskRun(run.id, {
    status: mapped.status,
    branch: mapped.branch,
    prUrl: mapped.prUrl,
    externalUrl: run.externalUrl,
    summary: mapped.summary,
    rawState: mapped.rawState,
    completedAt,
  }) ?? run

  const taskStatus = taskStatusForRun(mapped.status)
  const resultRef = mapped.prUrl ?? run.externalUrl
  const updatedTask = updateTaskSummary(task.id, {
    status: taskStatus,
    resultRef,
    statusLine: statusLineForRun(updatedRun),
    dispatchState: {
      orchestrator: run.orchestrator,
      runner: run.runner,
      runId: run.id,
      externalId: run.externalId,
      branch: mapped.branch,
      prUrl: mapped.prUrl,
      status: mapped.status,
    },
    completedAt: taskStatus === 'completed' || taskStatus === 'failed'
      ? (completedAt ?? new Date().toISOString())
      : null,
  }) ?? task

  return { task: updatedTask, run: updatedRun }
}

function taskStatusForRun(status: TaskRunStatus): Task['status'] {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'failed':
    case 'cancelled':
      return 'failed'
    case 'needs-input':
      return 'needs-attention'
    default:
      return 'active'
  }
}

function statusLineForRun(run: TaskRun): string {
  if (run.status === 'completed') return run.summary ?? 'AO run completed.'
  if (run.status === 'failed') return run.error ?? 'AO run failed.'
  if (run.status === 'cancelled') return 'AO run was cancelled.'
  if (run.status === 'needs-input') return 'AO run needs input.'
  if (run.status === 'review') return run.prUrl ? 'AO run opened a PR for review.' : 'AO run is in review.'
  return `AO run active with ${run.runner}.`
}
