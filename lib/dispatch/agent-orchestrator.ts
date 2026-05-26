import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { buildPrompt } from '@/lib/tasks/prompts'
import type { PromptSignalContext } from '@/lib/tasks/prompts'
import type {
  AgentOrchestratorConfig,
  AgentRunner,
  Task,
  TaskRunStatus,
} from '@/types/workspace'

const execFileAsync = promisify(execFile)
const MAX_AO_PROMPT_LENGTH = 3800

export interface CommandResult {
  stdout: string
  stderr: string
}

export interface CommandOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  timeout?: number
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: CommandOptions,
) => Promise<CommandResult>

export interface AgentOrchestratorStatus {
  configured: boolean
  available: boolean
  message: string
  raw?: unknown
}

export interface AgentOrchestratorDispatchResult {
  sessionId: string
  externalUrl: string | null
  runner: AgentRunner
  stdout: string
  stderr: string
}

export interface AoSessionListEntry {
  id: string
  projectId?: string
  projectName?: string
  role?: string
  branch?: string | null
  status?: string | null
  issueId?: string | null
  pr?: string | null
  workspacePath?: string | null
  lastActivityAt?: string | null
  activity?: string | null
  summary?: string | null
}

export interface MappedAoSession {
  status: TaskRunStatus
  branch: string | null
  prUrl: string | null
  summary: string | null
  rawState: Record<string, unknown>
}

export async function defaultCommandRunner(
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout ?? 15000,
    maxBuffer: 1024 * 1024,
  })
  return {
    stdout: String(stdout ?? ''),
    stderr: String(stderr ?? ''),
  }
}

export function validateAgentOrchestratorConfig(
  config: AgentOrchestratorConfig,
): string | null {
  if (!config.aoCommand.trim()) return 'AO command is required.'
  if (!config.aoCwd.trim()) return 'AO working directory is required.'
  if (!config.projectId.trim()) return 'AO project ID is required.'
  if (!config.runnerIdentity.trim()) return 'Runner identity label is required.'
  if (config.allowedRunners.length === 0) return 'At least one agent runner is required.'
  return null
}

export function resolveAgentRunner(
  config: AgentOrchestratorConfig,
  requestedRunner?: string | null,
): AgentRunner {
  const runner = requestedRunner?.trim() || config.defaultRunner
  if (!config.allowedRunners.includes(runner)) {
    throw new Error(`Runner "${runner}" is not allowed for this workspace.`)
  }
  return runner
}

export function parseAoSessionId(stdout: string): string | null {
  const match = stdout.match(/^SESSION=(.+)$/m)
  return match?.[1]?.trim() || null
}

export function getAoSessionUrl(
  config: AgentOrchestratorConfig,
  sessionId: string,
): string | null {
  if (!config.dashboardUrl) return null
  const base = config.dashboardUrl.replace(/\/$/, '')
  return `${base}/projects/${encodeURIComponent(config.projectId)}/sessions/${encodeURIComponent(sessionId)}`
}

export function buildAgentOrchestratorPrompt(
  task: Task,
  signalContext?: PromptSignalContext,
): string {
  const prompt = [
    `Signals task ${task.id}`,
    '',
    buildPrompt(task, { includeMcpInstructions: true, signalContext }),
    '',
    '## Delegation context',
    '- This task was dispatched from Signals.',
    '- Open a pull request or leave a clear result summary.',
    '- Keep the work scoped to the repository and task described above.',
  ].join('\n')

  if (prompt.length <= MAX_AO_PROMPT_LENGTH) return prompt
  return `${prompt.slice(0, MAX_AO_PROMPT_LENGTH - 120)}\n\n[Signals truncated additional context for AO prompt length.]`
}

export async function getAgentOrchestratorStatus(
  config: AgentOrchestratorConfig,
  runner: CommandRunner = defaultCommandRunner,
): Promise<AgentOrchestratorStatus> {
  const validationError = validateAgentOrchestratorConfig(config)
  if (validationError) {
    return { configured: false, available: false, message: validationError }
  }

  try {
    const result = await runner(config.aoCommand, ['status', '--json'], {
      cwd: config.aoCwd,
      env: { ...process.env, AO_PROJECT_ID: config.projectId },
      timeout: 10000,
    })
    const raw = parseJsonObject(result.stdout)
    return {
      configured: true,
      available: true,
      message: 'Agent Orchestrator is available.',
      raw: raw ?? result.stdout,
    }
  } catch (error) {
    return {
      configured: true,
      available: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function dispatchTaskToAgentOrchestrator(
  task: Task,
  config: AgentOrchestratorConfig,
  options?: {
    runner?: string | null
    commandRunner?: CommandRunner
    signalContext?: PromptSignalContext
  },
): Promise<AgentOrchestratorDispatchResult> {
  const validationError = validateAgentOrchestratorConfig(config)
  if (validationError) throw new Error(validationError)

  const agentRunner = resolveAgentRunner(config, options?.runner)
  const prompt = buildAgentOrchestratorPrompt(task, options?.signalContext)
  const commandRunner = options?.commandRunner ?? defaultCommandRunner
  const result = await commandRunner(
    config.aoCommand,
    ['spawn', '--agent', agentRunner, '--prompt', prompt],
    {
      cwd: config.aoCwd,
      env: { ...process.env, AO_PROJECT_ID: config.projectId },
      timeout: 30000,
    },
  )

  const sessionId = parseAoSessionId(result.stdout)
  if (!sessionId) {
    throw new Error('AO did not return a session id.')
  }

  return {
    sessionId,
    externalUrl: getAoSessionUrl(config, sessionId),
    runner: agentRunner,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

export async function getAgentOrchestratorSession(
  config: AgentOrchestratorConfig,
  sessionId: string,
  runner: CommandRunner = defaultCommandRunner,
): Promise<AoSessionListEntry | null> {
  const validationError = validateAgentOrchestratorConfig(config)
  if (validationError) throw new Error(validationError)

  const result = await runner(
    config.aoCommand,
    ['session', 'ls', '--json', '--include-terminated'],
    {
      cwd: config.aoCwd,
      env: { ...process.env, AO_PROJECT_ID: config.projectId },
      timeout: 10000,
    },
  )
  const parsed = parseJsonObject(result.stdout)
  const data = Array.isArray(parsed?.data) ? parsed.data : []
  const session = data.find(
    (entry) => isObject(entry) && entry.id === sessionId,
  )
  return isObject(session) ? session as unknown as AoSessionListEntry : null
}

export function mapAoSessionToTaskRun(
  session: AoSessionListEntry,
): MappedAoSession {
  const status = mapAoStatus(session.status, session.activity)
  return {
    status,
    branch: session.branch ?? null,
    prUrl: session.pr ?? null,
    summary: session.summary ?? null,
    rawState: { ...session },
  }
}

function mapAoStatus(
  status?: string | null,
  activity?: string | null,
): TaskRunStatus {
  if (activity === 'waiting_input' || activity === 'blocked') return 'needs-input'
  if (activity === 'exited' && status !== 'merged' && status !== 'done') return 'failed'

  switch (status) {
    case 'needs_input':
    case 'stuck':
      return 'needs-input'
    case 'pr_open':
    case 'ci_failed':
    case 'review_pending':
    case 'changes_requested':
    case 'approved':
    case 'mergeable':
      return 'review'
    case 'merged':
    case 'cleanup':
    case 'done':
      return 'completed'
    case 'killed':
    case 'terminated':
      return 'cancelled'
    case 'errored':
      return 'failed'
    default:
      return 'running'
  }
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return isObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
