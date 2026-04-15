import { getRepos, getPullRequests, getSignals } from '@/lib/db/queries'
import { json, error, type MCPTool } from './types'

export const getReposNeedingAttention: MCPTool = {
  definition: {
    name: 'get_repos_needing_attention',
    description: 'Get repos below a health score threshold, sorted by urgency',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceName: { type: 'string' },
        threshold: { type: 'number', description: 'Health score threshold (default 60)' },
      },
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const threshold = (args.threshold as number) ?? 60
    const repos = getRepos(id)
      .filter((r) => r.score < threshold)
      .sort((a, b) => a.score - b.score)
      .map((r) => ({ name: r.fullName, score: r.score, grade: r.grade, openIssues: r.openIssues, openPRs: r.openPRs, lastCommitAt: r.lastCommitAt }))
    return json(repos)
  },
}

export const getRepoHealth: MCPTool = {
  definition: {
    name: 'get_repo_health',
    description: 'Get detailed health score breakdown for a specific repo',
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'Repo name or full name (e.g. "mcp-server" or "gleanwork/mcp-server")' },
        workspaceName: { type: 'string' },
      },
      required: ['repoName'],
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const repoName = args.repoName as string
    const repos = getRepos(id)
    const repo = repos.find((r) => r.name === repoName || r.fullName === repoName || r.fullName.endsWith(`/${repoName}`))
    if (!repo) return error(`Repo "${repoName}" not found`)
    return json({ name: repo.fullName, score: repo.score, grade: repo.grade, pillars: repo.pillars, checkResults: repo.checkResults, url: repo.url })
  },
}

export const getRepoSignals: MCPTool = {
  definition: {
    name: 'get_repo_signals',
    description: 'Get all active signals for a specific repo',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceName: { type: 'string' },
        repoFullName: { type: 'string', description: 'Full repo name (e.g. "gleanwork/mcp-server")' },
      },
      required: ['repoFullName'],
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const allSignals = getSignals(id, { status: 'active' })
    return json(allSignals.filter((s) => s.repoFullName === args.repoFullName))
  },
}

export const getRepoActionableItems: MCPTool = {
  definition: {
    name: 'get_repo_actionable_items',
    description: 'Get combined failing checks and active signals for a repo, each with a description of what to fix. Items are ready to be worked on directly.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceName: { type: 'string' },
        repoFullName: { type: 'string', description: 'Full repo name (e.g. "gleanwork/mcp-server")' },
      },
      required: ['repoFullName'],
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const repoFullName = args.repoFullName as string
    const repos = getRepos(id)
    const repo = repos.find((r) => r.fullName === repoFullName)
    const items: Array<{ type: string; id: string; title: string; description: string; severity: string }> = []

    if (repo) {
      for (const [checkId, check] of Object.entries(repo.checkResults)) {
        if (check.score < 0.7) {
          items.push({ type: 'check', id: checkId, title: check.checkName, description: check.actionable ?? check.label, severity: check.score < 0.4 ? 'critical' : 'warning' })
        }
      }
    }

    const allSignals = getSignals(id, { status: 'active' })
    for (const signal of allSignals.filter((s) => s.repoFullName === repoFullName)) {
      items.push({ type: 'signal', id: String(signal.id), title: signal.title, description: signal.enrichedBody ?? signal.body, severity: signal.severity })
    }

    return json(items)
  },
}

export const getExternalPrs: MCPTool = {
  definition: {
    name: 'get_external_prs',
    description: 'Get open PRs from external contributors with staleness info',
    inputSchema: {
      type: 'object',
      properties: { workspaceName: { type: 'string' } },
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const prs = getPullRequests(id)
      .filter((pr) => pr.isExternal)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
      .map((pr) => ({ repo: pr.repoFullName, number: pr.number, title: pr.title, author: pr.authorLogin, daysSinceUpdate: pr.daysSinceUpdate, isStale: pr.isStale, url: pr.url }))
    return json(prs)
  },
}
