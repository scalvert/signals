import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DispatchTarget, Task, TaskRun } from '@/types/workspace'

const mocks = vi.hoisted(() => ({
  createTaskRun: vi.fn(),
  getDispatchTargetForWorkspace: vi.fn(),
  getRepoContext: vi.fn(),
  getSignalById: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateTaskSummary: vi.fn(),
  requireTaskAccess: vi.fn(),
  refreshRepoPermission: vi.fn(),
  registryGet: vi.fn(),
  dispatchTaskToAgentOrchestrator: vi.fn(),
  resolveAgentRunner: vi.fn(),
}))

vi.mock('@/lib/db/queries', () => ({
  createTaskRun: mocks.createTaskRun,
  getDispatchTargetForWorkspace: mocks.getDispatchTargetForWorkspace,
  getRepoContext: mocks.getRepoContext,
  getSignalById: mocks.getSignalById,
  updateTaskStatus: mocks.updateTaskStatus,
  updateTaskSummary: mocks.updateTaskSummary,
}))

vi.mock('@/lib/auth/access', () => ({
  AccessError: class AccessError extends Error {
    constructor(
      public status: 401 | 403 | 404,
      message: string,
    ) {
      super(message)
    }
  },
  accessErrorResponse: (error: unknown) => {
    if (error instanceof Error && 'status' in error) {
      return NextResponse.json({ error: error.message }, { status: Number(error.status) })
    }
    throw error
  },
  requireTaskAccess: mocks.requireTaskAccess,
}))

vi.mock('@/lib/auth/users', () => ({
  getUserToken: vi.fn(() => 'token'),
}))

vi.mock('@/lib/github/permissions', () => ({
  refreshRepoPermission: mocks.refreshRepoPermission,
}))

vi.mock('@/lib/signals/registry', () => ({
  registry: { get: mocks.registryGet },
}))

vi.mock('@/lib/signals/definitions', () => ({}))

vi.mock('@/lib/tasks/executors/llm', () => ({
  executeLlmDispatch: vi.fn(),
}))

vi.mock('@/lib/dispatch/agent-orchestrator', () => ({
  dispatchTaskToAgentOrchestrator: mocks.dispatchTaskToAgentOrchestrator,
  resolveAgentRunner: mocks.resolveAgentRunner,
}))

import { POST } from './route'

const task: Task = {
  id: 42,
  workspaceId: 1,
  repoFullName: 'org/repo',
  title: 'Fix CI',
  description: 'CI is failing',
  sourceType: 'signal',
  sourceId: '9',
  status: 'pending',
  provider: null,
  providerRef: null,
  dispatchState: null,
  resultRef: null,
  statusLine: null,
  notes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  dispatchedAt: null,
  completedAt: null,
}

const target: DispatchTarget = {
  id: 3,
  workspaceId: 1,
  type: 'agent-orchestrator',
  name: 'Agent Orchestrator',
  enabled: true,
  config: {
    aoCommand: 'ao',
    aoCwd: '/tmp/work',
    projectId: 'signals',
    dashboardUrl: 'http://localhost:3000',
    defaultRunner: 'codex',
    allowedRunners: ['codex'],
    runnerIdentity: 'signals-runner',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const run: TaskRun = {
  id: 5,
  taskId: 42,
  workspaceId: 1,
  dispatchTargetId: 3,
  orchestrator: 'agent-orchestrator',
  runner: 'codex',
  status: 'running',
  externalId: 'sig-1',
  externalUrl: 'http://localhost:3000/projects/signals/sessions/sig-1',
  branch: null,
  prUrl: null,
  summary: null,
  error: null,
  rawState: null,
  dispatchedByUserId: 7,
  executedByIdentity: 'signals-runner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
}

const failedRun: TaskRun = {
  ...run,
  id: 6,
  status: 'failed',
  externalId: null,
  externalUrl: null,
  error: 'ao unavailable',
}

describe('task dispatch route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireTaskAccess.mockResolvedValue({
      task,
      userId: 7,
      githubLogin: 'maintainer',
      membership: { role: 'member' },
      workspace: { id: 1 },
    })
    mocks.refreshRepoPermission.mockResolvedValue({ canDispatch: true })
    mocks.getRepoContext.mockReturnValue({ context: 'Run npm test before opening a PR.' })
    mocks.getSignalById.mockReturnValue({ id: 9, type: 'has-ci', metadata: {} })
    mocks.registryGet.mockReturnValue({
      meta: {
        rationale: 'CI prevents regressions.',
        docs: { summary: 'Checks for a CI workflow.' },
        fixInfo: {
          dispatch: 'agent',
          description: 'Add CI',
          objective: 'Add CI',
          prompt: 'Add CI',
          needs: { repoAccess: 'write' },
          expectedOutcome: 'pr-created',
        },
      },
    })
    mocks.resolveAgentRunner.mockReturnValue('codex')
  })

  it('returns setup-required error when AO is not configured', async () => {
    mocks.getDispatchTargetForWorkspace.mockReturnValue(undefined)

    const response = await POST(new Request('http://test.local'), {
      params: Promise.resolve({ id: '42' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('not configured')
    expect(mocks.updateTaskSummary).toHaveBeenCalledWith(42, {
      statusLine: 'Agent Orchestrator is not configured for this workspace.',
    })
  })

  it('dispatches agent tasks to AO and stores a task run', async () => {
    mocks.getDispatchTargetForWorkspace.mockReturnValue(target)
    mocks.dispatchTaskToAgentOrchestrator.mockResolvedValue({
      sessionId: 'sig-1',
      externalUrl: 'http://localhost:3000/projects/signals/sessions/sig-1',
      runner: 'codex',
      stdout: 'SESSION=sig-1',
      stderr: '',
    })
    mocks.createTaskRun.mockReturnValue(run)
    mocks.updateTaskStatus.mockReturnValue({ ...task, status: 'active' })

    const response = await POST(
      new Request('http://test.local', {
        method: 'POST',
        body: JSON.stringify({ runner: 'codex' }),
      }),
      { params: Promise.resolve({ id: '42' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.run.externalId).toBe('sig-1')
    expect(mocks.dispatchTaskToAgentOrchestrator).toHaveBeenCalledWith(
      task,
      target.config,
      expect.objectContaining({
        runner: 'codex',
        signalContext: expect.objectContaining({
          rationale: 'CI prevents regressions.',
          repoContext: 'Run npm test before opening a PR.',
        }),
      }),
    )
    expect(mocks.createTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 42,
        orchestrator: 'agent-orchestrator',
        runner: 'codex',
        dispatchedByUserId: 7,
        executedByIdentity: 'signals-runner',
      }),
    )
  })

  it('records a failed run when AO dispatch fails', async () => {
    mocks.getDispatchTargetForWorkspace.mockReturnValue(target)
    mocks.dispatchTaskToAgentOrchestrator.mockRejectedValue(new Error('ao unavailable'))
    mocks.createTaskRun.mockReturnValue(failedRun)
    mocks.updateTaskStatus.mockReturnValue({ ...task, status: 'failed' })

    const response = await POST(
      new Request('http://test.local', {
        method: 'POST',
        body: JSON.stringify({ runner: 'codex' }),
      }),
      { params: Promise.resolve({ id: '42' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe('ao unavailable')
    expect(mocks.createTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 42,
        status: 'failed',
        error: 'ao unavailable',
        executedByIdentity: 'signals-runner',
      }),
    )
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(
      42,
      'failed',
      expect.objectContaining({
        provider: 'agent-orchestrator',
        statusLine: 'AO dispatch failed: ao unavailable',
      }),
    )
  })
})
