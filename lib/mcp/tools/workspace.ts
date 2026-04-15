import { getWorkspaces, getWorkspaceStats, getRepos, getSignals, getTasks } from '@/lib/db/queries'
import { json, type MCPTool } from './types'

export const listWorkspaces: MCPTool = {
  definition: {
    name: 'list_workspaces',
    description: 'List all configured workspaces',
    inputSchema: { type: 'object', properties: {} },
  },
  handler: () => {
    const workspaces = getWorkspaces()
    return json(workspaces.map((w) => ({ name: w.name, slug: w.slug, sources: w.sources })))
  },
}

export const getWorkspaceSummary: MCPTool = {
  definition: {
    name: 'get_workspace_summary',
    description: 'Get a summary of repos, health scores, open PRs, signals, and tasks for a workspace',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceName: { type: 'string', description: 'Workspace name or slug. If omitted, uses the first workspace.' },
      },
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const stats = getWorkspaceStats(id)
    const repos = getRepos(id)
    const activeSignals = getSignals(id, { status: 'active' })
    const pendingTasks = getTasks(id, { status: 'pending' })
    const inFlightTasks = getTasks(id, { status: 'dispatched' })
    return json({
      stats,
      topRepos: repos.sort((a, b) => b.score - a.score).slice(0, 5).map((r) => ({ name: r.fullName, score: r.score, grade: r.grade })),
      bottomRepos: repos.sort((a, b) => a.score - b.score).slice(0, 5).map((r) => ({ name: r.fullName, score: r.score, grade: r.grade })),
      activeSignals: activeSignals.length,
      pendingTasks: pendingTasks.length,
      inFlightTasks: inFlightTasks.length,
    })
  },
}
