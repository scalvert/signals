import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  getRepos,
  getPullRequests,
  getSignals,
  getWorkspaceStats,
  getWorkspaces,
} from '@/lib/db/queries'

export function createMCPServer() {
  const server = new Server(
    { name: 'signals', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_workspace_summary',
        description:
          'Get a summary of all repos, health scores, open PRs for a workspace',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceName: {
              type: 'string',
              description:
                'Workspace name or slug. If omitted, uses the first workspace.',
            },
          },
        },
      },
      {
        name: 'get_repos_needing_attention',
        description: 'Get repos below a health score threshold, sorted by urgency',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceName: { type: 'string' },
            threshold: {
              type: 'number',
              description: 'Health score threshold (default 60)',
            },
          },
        },
      },
      {
        name: 'get_external_prs',
        description:
          'Get open PRs from external contributors with staleness info',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceName: { type: 'string' },
          },
        },
      },
      {
        name: 'get_repo_health',
        description:
          'Get detailed health score breakdown for a specific repo',
        inputSchema: {
          type: 'object' as const,
          properties: {
            repoName: {
              type: 'string',
              description: 'Repo name or full name (e.g. "mcp-server" or "gleanwork/mcp-server")',
            },
            workspaceName: { type: 'string' },
          },
          required: ['repoName'],
        },
      },
      {
        name: 'get_signal_feed',
        description: 'Get recent signals (star spikes, health drops, etc.)',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceName: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'list_workspaces',
        description: 'List all configured workspaces',
        inputSchema: { type: 'object' as const, properties: {} },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const workspaces = getWorkspaces()

    function resolveWorkspaceId(wsName?: string): number {
      if (!wsName && workspaces.length > 0) return workspaces[0].id
      const ws = workspaces.find(
        (w) =>
          w.name.toLowerCase() === wsName?.toLowerCase() ||
          w.slug === wsName?.toLowerCase(),
      )
      if (!ws) throw new Error(`Workspace "${wsName}" not found`)
      return ws.id
    }

    switch (name) {
      case 'list_workspaces': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                workspaces.map((w) => ({
                  name: w.name,
                  slug: w.slug,
                  sources: w.sources,
                })),
                null,
                2,
              ),
            },
          ],
        }
      }

      case 'get_workspace_summary': {
        const id = resolveWorkspaceId(args?.workspaceName as string)
        const stats = getWorkspaceStats(id)
        const repos = getRepos(id)
        const top5 = repos
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((r) => ({ name: r.fullName, score: r.score, grade: r.grade }))
        const bottom5 = repos
          .sort((a, b) => a.score - b.score)
          .slice(0, 5)
          .map((r) => ({ name: r.fullName, score: r.score, grade: r.grade }))
        return {
          content: [
            { type: 'text', text: JSON.stringify({ stats, top5, bottom5 }, null, 2) },
          ],
        }
      }

      case 'get_repos_needing_attention': {
        const id = resolveWorkspaceId(args?.workspaceName as string)
        const threshold = (args?.threshold as number) ?? 60
        const repos = getRepos(id)
          .filter((r) => r.score < threshold)
          .sort((a, b) => a.score - b.score)
          .map((r) => ({
            name: r.fullName,
            score: r.score,
            grade: r.grade,
            openIssues: r.openIssues,
            openPRs: r.openPRs,
            lastCommitAt: r.lastCommitAt,
          }))
        return { content: [{ type: 'text', text: JSON.stringify(repos, null, 2) }] }
      }

      case 'get_external_prs': {
        const id = resolveWorkspaceId(args?.workspaceName as string)
        const prs = getPullRequests(id)
          .filter((pr) => pr.isExternal)
          .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
          .map((pr) => ({
            repo: pr.repoFullName,
            number: pr.number,
            title: pr.title,
            author: pr.authorLogin,
            daysSinceUpdate: pr.daysSinceUpdate,
            isStale: pr.isStale,
            url: pr.url,
          }))
        return { content: [{ type: 'text', text: JSON.stringify(prs, null, 2) }] }
      }

      case 'get_repo_health': {
        const id = resolveWorkspaceId(args?.workspaceName as string)
        const repoName = args?.repoName as string
        const repos = getRepos(id)
        const repo = repos.find(
          (r) =>
            r.name === repoName ||
            r.fullName === repoName ||
            r.fullName.endsWith(`/${repoName}`),
        )
        if (!repo) {
          return {
            content: [{ type: 'text', text: `Repo "${repoName}" not found` }],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  name: repo.fullName,
                  score: repo.score,
                  grade: repo.grade,
                  pillars: repo.pillars,
                  checkResults: repo.checkResults,
                  url: repo.url,
                },
                null,
                2,
              ),
            },
          ],
        }
      }

      case 'get_signal_feed': {
        const id = resolveWorkspaceId(args?.workspaceName as string)
        const limit = (args?.limit as number) ?? 10
        const signals = getSignals(id, { limit })
        return { content: [{ type: 'text', text: JSON.stringify(signals, null, 2) }] }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }
  })

  return server
}
