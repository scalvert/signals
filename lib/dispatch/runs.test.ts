import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DispatchTarget, Task, TaskRun } from '@/types/workspace'

const mocks = vi.hoisted(() => ({
  getDispatchTargetById: vi.fn(),
  getLatestTaskRun: vi.fn(),
  getTask: vi.fn(),
  updateTaskRun: vi.fn(),
  updateTaskSummary: vi.fn(),
  getAgentOrchestratorSession: vi.fn(),
  mapAoSessionToTaskRun: vi.fn(),
}))

vi.mock('@/lib/db/queries', () => ({
  getDispatchTargetById: mocks.getDispatchTargetById,
  getLatestTaskRun: mocks.getLatestTaskRun,
  getTask: mocks.getTask,
  updateTaskRun: mocks.updateTaskRun,
  updateTaskSummary: mocks.updateTaskSummary,
}))

vi.mock('./agent-orchestrator', () => ({
  getAgentOrchestratorSession: mocks.getAgentOrchestratorSession,
  mapAoSessionToTaskRun: mocks.mapAoSessionToTaskRun,
}))

import { syncLatestTaskRun } from './runs'

const task: Task = {
  id: 42,
  workspaceId: 1,
  repoFullName: 'org/repo',
  title: 'Fix CI',
  description: 'CI is failing',
  sourceType: 'signal',
  sourceId: '9',
  status: 'active',
  provider: 'agent-orchestrator',
  providerRef: 'sig-1',
  dispatchState: null,
  resultRef: null,
  statusLine: 'AO run started.',
  notes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  dispatchedAt: '2026-01-01T00:00:01.000Z',
  completedAt: null,
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
  createdAt: '2026-01-01T00:00:02.000Z',
  updatedAt: '2026-01-01T00:00:02.000Z',
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

describe('syncLatestTaskRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTask.mockReturnValue(task)
    mocks.getLatestTaskRun.mockReturnValue(run)
    mocks.getDispatchTargetById.mockReturnValue(target)
  })

  it('syncs AO review state into the latest run and task summary', async () => {
    const session = {
      id: 'sig-1',
      status: 'pr_open',
      branch: 'signals/fix-ci',
      pr: 'https://github.com/org/repo/pull/1',
    }
    mocks.getAgentOrchestratorSession.mockResolvedValue(session)
    mocks.mapAoSessionToTaskRun.mockReturnValue({
      status: 'review',
      branch: 'signals/fix-ci',
      prUrl: 'https://github.com/org/repo/pull/1',
      summary: null,
      rawState: session,
    })
    mocks.updateTaskRun.mockImplementation((_runId, updates) => ({
      ...run,
      ...updates,
      updatedAt: '2026-01-01T00:00:03.000Z',
    }))
    mocks.updateTaskSummary.mockImplementation((_taskId, updates) => ({
      ...task,
      ...updates,
    }))

    const result = await syncLatestTaskRun(42)

    expect(mocks.getAgentOrchestratorSession).toHaveBeenCalledWith(
      target.config,
      'sig-1',
    )
    expect(mocks.updateTaskRun).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        status: 'review',
        branch: 'signals/fix-ci',
        prUrl: 'https://github.com/org/repo/pull/1',
      }),
    )
    expect(mocks.updateTaskSummary).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        status: 'active',
        resultRef: 'https://github.com/org/repo/pull/1',
        statusLine: 'AO run opened a PR for review.',
      }),
    )
    expect(result.task?.resultRef).toBe('https://github.com/org/repo/pull/1')
  })

  it('keeps the task active when AO status is temporarily unavailable', async () => {
    mocks.getAgentOrchestratorSession.mockRejectedValue(new Error('ao offline'))
    mocks.updateTaskSummary.mockReturnValue({
      ...task,
      statusLine: 'AO status unavailable: ao offline',
    })

    const result = await syncLatestTaskRun(42)

    expect(mocks.updateTaskRun).not.toHaveBeenCalled()
    expect(mocks.updateTaskSummary).toHaveBeenCalledWith(42, {
      statusLine: 'AO status unavailable: ao offline',
    })
    expect(result.task?.status).toBe('active')
  })
})
