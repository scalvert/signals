import { describe, expect, it, vi } from 'vitest'
import {
  dispatchTaskToAgentOrchestrator,
  getAgentOrchestratorSession,
  mapAoSessionToTaskRun,
  parseAoSessionId,
  type CommandRunner,
} from './agent-orchestrator'
import type { AgentOrchestratorConfig, Task } from '@/types/workspace'

const config: AgentOrchestratorConfig = {
  aoCommand: 'ao',
  aoCwd: '/tmp/work',
  projectId: 'signals',
  dashboardUrl: 'http://localhost:3000',
  defaultRunner: 'codex',
  allowedRunners: ['codex', 'claude-code'],
  runnerIdentity: 'signals-runner',
}

const task: Task = {
  id: 42,
  workspaceId: 1,
  repoFullName: 'org/repo',
  title: 'Fix CI',
  description: 'CI is failing',
  sourceType: 'signal',
  sourceId: '12',
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

describe('Agent Orchestrator adapter', () => {
  it('parses AO session ids from stdout', () => {
    expect(parseAoSessionId('ok\nSESSION=sig-1\n')).toBe('sig-1')
    expect(parseAoSessionId('ok')).toBeNull()
  })

  it('dispatches with argv arguments instead of shell interpolation', async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      stdout: 'Session spawned\nSESSION=sig-1\n',
      stderr: '',
    })

    const result = await dispatchTaskToAgentOrchestrator(task, config, {
      runner: 'codex',
      commandRunner: runner,
    })

    expect(runner).toHaveBeenCalledTimes(1)
    const [command, args, options] = runner.mock.calls[0]
    expect(command).toBe('ao')
    expect(args[0]).toBe('spawn')
    expect(args[1]).toBe('--agent')
    expect(args[2]).toBe('codex')
    expect(args[3]).toBe('--prompt')
    expect(args[4]).toContain('Signals task 42')
    expect(options.cwd).toBe('/tmp/work')
    expect(options.env?.AO_PROJECT_ID).toBe('signals')
    expect(result.sessionId).toBe('sig-1')
    expect(result.externalUrl).toBe('http://localhost:3000/projects/signals/sessions/sig-1')
  })

  it('includes signal context in the AO prompt', async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      stdout: 'SESSION=sig-1\n',
      stderr: '',
    })

    await dispatchTaskToAgentOrchestrator(task, config, {
      runner: 'codex',
      commandRunner: runner,
      signalContext: {
        rationale: 'CI protects maintainers from regressions.',
        fixGuidance: 'Add a GitHub Actions workflow.',
        docsSummary: 'Checks for workflow files.',
      },
    })

    const args = runner.mock.calls[0][1]
    expect(args[4]).toContain('## Why this matters')
    expect(args[4]).toContain('CI protects maintainers from regressions.')
    expect(args[4]).toContain('Add a GitHub Actions workflow.')
  })

  it('rejects runners not allowed by workspace config', async () => {
    await expect(
      dispatchTaskToAgentOrchestrator(task, config, {
        runner: 'cursor',
        commandRunner: vi.fn<CommandRunner>(),
      }),
    ).rejects.toThrow('Runner "cursor" is not allowed')
  })

  it('loads a session from AO JSON output', async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      stdout: JSON.stringify({
        data: [
          { id: 'sig-1', status: 'working' },
          { id: 'sig-2', status: 'pr_open', pr: 'https://github.com/org/repo/pull/1' },
        ],
        meta: { hiddenTerminatedCount: 0 },
      }),
      stderr: '',
    })

    const session = await getAgentOrchestratorSession(config, 'sig-2', runner)

    expect(session?.id).toBe('sig-2')
    expect(runner).toHaveBeenCalledWith(
      'ao',
      ['session', 'ls', '--json', '--include-terminated'],
      expect.objectContaining({ cwd: '/tmp/work' }),
    )
  })

  it('maps AO session states into Signals run states', () => {
    expect(mapAoSessionToTaskRun({ id: 'a', status: 'working' }).status).toBe('running')
    expect(mapAoSessionToTaskRun({ id: 'a', status: 'needs_input' }).status).toBe('needs-input')
    expect(mapAoSessionToTaskRun({ id: 'a', status: 'pr_open' }).status).toBe('review')
    expect(mapAoSessionToTaskRun({ id: 'a', status: 'done' }).status).toBe('completed')
    expect(mapAoSessionToTaskRun({ id: 'a', status: 'errored' }).status).toBe('failed')
    expect(mapAoSessionToTaskRun({ id: 'a', status: 'killed' }).status).toBe('cancelled')
  })
})
