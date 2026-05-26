import { NextResponse } from 'next/server'
import {
  createTaskRun,
  getRepoContext,
  getDispatchTargetForWorkspace,
  getSignalById,
  updateTaskStatus,
  updateTaskSummary,
} from '@/lib/db/queries'
import { AccessError, accessErrorResponse, requireTaskAccess } from '@/lib/auth/access'
import { getUserToken } from '@/lib/auth/users'
import { refreshRepoPermission } from '@/lib/github/permissions'
import { registry } from '@/lib/signals/registry'
import '@/lib/signals/definitions'
import { executeLlmDispatch } from '@/lib/tasks/executors/llm'
import { dispatchTaskToAgentOrchestrator, resolveAgentRunner } from '@/lib/dispatch/agent-orchestrator'
import { interpolatePrompt, type PromptSignalContext } from '@/lib/tasks/prompts'
import type { SignalDefinition, SignalFixInfo } from '@/lib/signals/types'
import type { Signal, Task } from '@/types/workspace'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const taskId = Number(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  try {
    const access = await requireTaskAccess(taskId)
    const { task } = access

    if (task.status !== 'pending') {
      return NextResponse.json({ error: `Task is already ${task.status}` }, { status: 400 })
    }

    if (access.membership.role === 'viewer') {
      return NextResponse.json({ error: 'Workspace role is not allowed' }, { status: 403 })
    }

    const permission = await refreshRepoPermission(
      task.workspaceId,
      access.userId,
      access.githubLogin,
      task.repoFullName,
      { force: true },
    )
    if (!permission.canDispatch) {
      return NextResponse.json({ error: 'Requires write access on GitHub' }, { status: 403 })
    }

    const signal = task.sourceType === 'signal'
      ? getSignalById(Number(task.sourceId))
      : undefined
    let signalType: string | undefined
    if (task.sourceType === 'signal') {
      signalType = signal?.type
    } else {
      signalType = task.sourceId
    }

    if (!signalType) {
      return NextResponse.json({ error: 'Could not resolve signal type' }, { status: 400 })
    }

    const definition = registry.get(signalType)
    const fixInfo = definition?.meta.fixInfo

    if (!definition || !fixInfo || !('dispatch' in fixInfo)) {
      return NextResponse.json({ error: 'This signal does not support dispatch' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({})) as {
      dispatchTarget?: string
      runner?: string
    }

    if (fixInfo.dispatch === 'agent' || body.dispatchTarget === 'agent-orchestrator') {
      const target = getDispatchTargetForWorkspace(task.workspaceId, 'agent-orchestrator')
      if (!target) {
        updateTaskSummary(taskId, {
          statusLine: 'Agent Orchestrator is not configured for this workspace.',
        })
        return NextResponse.json(
          { error: 'Agent Orchestrator is not configured for this workspace.' },
          { status: 400 },
        )
      }
      if (!target.enabled) {
        updateTaskSummary(taskId, {
          statusLine: 'Agent Orchestrator dispatch target is disabled.',
        })
        return NextResponse.json(
          { error: 'Agent Orchestrator dispatch target is disabled.' },
          { status: 400 },
        )
      }

      let runner = target.config.defaultRunner
      try {
        runner = resolveAgentRunner(target.config, body.runner)
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : String(error) },
          { status: 400 },
        )
      }

      try {
        const result = await dispatchTaskToAgentOrchestrator(task, target.config, {
          runner,
          signalContext: buildDispatchSignalContext(task, definition, fixInfo, signal),
        })
        const run = createTaskRun({
          taskId,
          workspaceId: task.workspaceId,
          dispatchTargetId: target.id,
          orchestrator: 'agent-orchestrator',
          runner: result.runner,
          status: 'running',
          externalId: result.sessionId,
          externalUrl: result.externalUrl,
          rawState: {
            stdout: result.stdout,
            stderr: result.stderr,
          },
          dispatchedByUserId: access.userId,
          executedByIdentity: target.config.runnerIdentity,
        })
        const updated = updateTaskStatus(taskId, 'active', {
          provider: 'agent-orchestrator',
          providerRef: result.sessionId,
          resultRef: result.externalUrl ?? undefined,
          statusLine: `AO run ${result.sessionId} started with ${result.runner}.`,
          dispatchState: {
            orchestrator: run.orchestrator,
            runner: run.runner,
            runId: run.id,
            externalId: run.externalId,
            executedByIdentity: run.executedByIdentity,
          },
        })
        return NextResponse.json({ task: updated, run })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const run = createTaskRun({
          taskId,
          workspaceId: task.workspaceId,
          dispatchTargetId: target.id,
          orchestrator: 'agent-orchestrator',
          runner,
          status: 'failed',
          error: message,
          rawState: { error: message },
          dispatchedByUserId: access.userId,
          executedByIdentity: target.config.runnerIdentity,
        })
        const updated = updateTaskStatus(taskId, 'failed', {
          provider: 'agent-orchestrator',
          statusLine: `AO dispatch failed: ${message.slice(0, 120)}`,
          dispatchState: {
            orchestrator: run.orchestrator,
            runner: run.runner,
            runId: run.id,
            error: message,
          },
        })
        return NextResponse.json({ error: message, task: updated, run }, { status: 502 })
      }
    }

    const token = getUserToken(access.userId)
    if (!token) {
      return NextResponse.json({ error: 'No GitHub token on record — please sign out and sign in again' }, { status: 401 })
    }

    updateTaskStatus(taskId, 'active')

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

    return NextResponse.json({ error: 'Unknown dispatch type' }, { status: 400 })
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error)
    const message = error instanceof Error ? error.message : String(error)
    updateTaskStatus(taskId, 'failed', { statusLine: `Failed: ${message.slice(0, 100)}` })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildDispatchSignalContext(
  task: Task,
  definition: SignalDefinition,
  fixInfo: SignalFixInfo,
  signal?: Signal,
): PromptSignalContext {
  const [owner, repo] = task.repoFullName.split('/')
  const templateVars: Record<string, unknown> = {
    repoFullName: task.repoFullName,
    owner,
    repo,
    ...(signal?.metadata ?? {}),
  }
  const details: string[] = [fixInfo.description]
  if ('objective' in fixInfo) {
    details.push(`Objective: ${fixInfo.objective}`)
  }
  if ('prompt' in fixInfo) {
    details.push(interpolatePrompt(fixInfo.prompt, templateVars))
  }
  const repoContext = getRepoContext(task.workspaceId, task.repoFullName)?.context

  return {
    rationale: definition.meta.rationale,
    fixGuidance: details.join('\n\n'),
    docsSummary: definition.meta.docs.summary,
    repoContext: repoContext?.trim() || undefined,
    metadata: signal?.metadata,
  }
}
