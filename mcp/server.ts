import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import {
  getWorkspaces,
  getWorkspaceStats,
  getRepos,
  getPullRequests,
  getSignals,
  getTasks,
  getTask,
  createTask,
  updateTaskStatus,
  addTaskNote,
} from '../lib/db/queries'
import type { TaskStatus } from '../types/workspace'

const server = new Server(
  { name: 'signals', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_workspace_summary',
      description: 'Get a summary of all repos, health scores, open PRs, and signals for a workspace',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workspaceId: { type: 'number', description: 'Workspace ID' },
        },
        required: ['workspaceId'],
      },
    },
    {
      name: 'get_repo_health',
      description: 'Get detailed health score breakdown for a specific repo including all check results',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workspaceId: { type: 'number', description: 'Workspace ID' },
          repoName: { type: 'string', description: 'Repository name or full name (e.g. "mcp-server" or "gleanwork/mcp-server")' },
        },
        required: ['workspaceId', 'repoName'],
      },
    },
    {
      name: 'get_repo_signals',
      description: 'Get all active signals for a specific repo',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workspaceId: { type: 'number', description: 'Workspace ID' },
          repoFullName: { type: 'string', description: 'Full repo name (e.g. "gleanwork/mcp-server")' },
        },
        required: ['workspaceId', 'repoFullName'],
      },
    },
    {
      name: 'get_repo_actionable_items',
      description: 'Get combined failing checks and active signals for a repo, each with a description of what to fix. Items are ready to be worked on directly.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workspaceId: { type: 'number', description: 'Workspace ID' },
          repoFullName: { type: 'string', description: 'Full repo name (e.g. "gleanwork/mcp-server")' },
        },
        required: ['workspaceId', 'repoFullName'],
      },
    },
    {
      name: 'get_task_details',
      description: 'Get full context for a specific task including its source signal or check',
      inputSchema: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'number', description: 'Task ID' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'create_task_from_item',
      description: 'Create a task from an actionable item (failing check or active signal). Use after get_repo_actionable_items to start tracking work.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workspaceId: { type: 'number', description: 'Workspace ID' },
          repoFullName: { type: 'string', description: 'Full repo name' },
          sourceType: { type: 'string', enum: ['signal', 'check'], description: 'Whether the item is a signal or a check' },
          sourceId: { type: 'string', description: 'Signal ID or check ID' },
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'What needs to be done' },
        },
        required: ['workspaceId', 'repoFullName', 'sourceType', 'sourceId', 'title', 'description'],
      },
    },
    {
      name: 'update_task_status',
      description: 'Update the status of a task. Use "completed" when work is done, "failed" if it could not be completed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'number', description: 'Task ID' },
          status: { type: 'string', enum: ['completed', 'failed'], description: 'New status' },
          providerRef: { type: 'string', description: 'Reference to the result (e.g. PR URL)' },
        },
        required: ['taskId', 'status'],
      },
    },
    {
      name: 'add_task_note',
      description: 'Add a progress note to a task',
      inputSchema: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'number', description: 'Task ID' },
          text: { type: 'string', description: 'Note text' },
        },
        required: ['taskId', 'text'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'get_workspace_summary': {
      const { workspaceId } = args as { workspaceId: number }
      const stats = getWorkspaceStats(workspaceId)
      const repos = getRepos(workspaceId)
      const activeSignals = getSignals(workspaceId, { status: 'active' })
      const pendingTasks = getTasks(workspaceId, { status: 'pending' })
      const inFlightTasks = getTasks(workspaceId, { status: 'dispatched' })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            stats,
            topRepos: repos.sort((a, b) => b.score - a.score).slice(0, 5).map((r) => ({ name: r.fullName, score: r.score, grade: r.grade })),
            bottomRepos: repos.sort((a, b) => a.score - b.score).slice(0, 5).map((r) => ({ name: r.fullName, score: r.score, grade: r.grade })),
            activeSignals: activeSignals.length,
            pendingTasks: pendingTasks.length,
            inFlightTasks: inFlightTasks.length,
          }, null, 2),
        }],
      }
    }

    case 'get_repo_health': {
      const { workspaceId, repoName } = args as { workspaceId: number; repoName: string }
      const repos = getRepos(workspaceId)
      const repo = repos.find((r) => r.name === repoName || r.fullName === repoName || r.fullName.endsWith(`/${repoName}`))
      if (!repo) return { content: [{ type: 'text', text: JSON.stringify({ error: `Repo "${repoName}" not found` }) }] }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            name: repo.fullName,
            score: repo.score,
            grade: repo.grade,
            triage: repo.triage,
            pillars: repo.pillars,
            checkResults: repo.checkResults,
            stars: repo.stars,
            openIssues: repo.openIssues,
            openPRs: repo.openPRs,
            lastCommitAt: repo.lastCommitAt,
          }, null, 2),
        }],
      }
    }

    case 'get_repo_signals': {
      const { workspaceId, repoFullName } = args as { workspaceId: number; repoFullName: string }
      const allSignals = getSignals(workspaceId, { status: 'active' })
      const repoSignals = allSignals.filter((s) => s.repoFullName === repoFullName)
      return { content: [{ type: 'text', text: JSON.stringify(repoSignals, null, 2) }] }
    }

    case 'get_repo_actionable_items': {
      const { workspaceId, repoFullName } = args as { workspaceId: number; repoFullName: string }
      const repos = getRepos(workspaceId)
      const repo = repos.find((r) => r.fullName === repoFullName)
      const items: Array<{ type: string; id: string; title: string; description: string; severity: string }> = []

      if (repo) {
        for (const [checkId, check] of Object.entries(repo.checkResults)) {
          if (check.score < 0.7) {
            items.push({
              type: 'check',
              id: checkId,
              title: check.checkName,
              description: check.actionable ?? check.label,
              severity: check.score < 0.4 ? 'critical' : 'warning',
            })
          }
        }
      }

      const allSignals = getSignals(workspaceId, { status: 'active' })
      for (const signal of allSignals.filter((s) => s.repoFullName === repoFullName)) {
        items.push({
          type: 'signal',
          id: String(signal.id),
          title: signal.title,
          description: signal.enrichedBody ?? signal.body,
          severity: signal.severity,
        })
      }

      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
    }

    case 'get_task_details': {
      const { taskId } = args as { taskId: number }
      const task = getTask(taskId)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }] }
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] }
    }

    case 'create_task_from_item': {
      const { workspaceId, repoFullName, sourceType, sourceId, title, description } = args as {
        workspaceId: number; repoFullName: string; sourceType: 'signal' | 'check'; sourceId: string; title: string; description: string
      }
      const task = createTask({ workspaceId, repoFullName, sourceType, sourceId, title, description })
      const updated = updateTaskStatus(task.id, 'dispatched', { provider: 'mcp-self-serve' })
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] }
    }

    case 'update_task_status': {
      const { taskId, status, providerRef } = args as { taskId: number; status: TaskStatus; providerRef?: string }
      const task = updateTaskStatus(taskId, status, { providerRef })
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }] }
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] }
    }

    case 'add_task_note': {
      const { taskId, text } = args as { taskId: number; text: string }
      const task = addTaskNote(taskId, text, 'agent')
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }] }
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] }
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[signals-mcp] Server started')
}

main().catch(console.error)
