import { tool } from 'ai'
import { z } from 'zod'
import {
  getRepos,
  getPullRequests,
  getSignals,
  getWorkspaceStats,
} from '@/lib/db/queries'

export function buildWorkspaceTools(workspaceId: number) {
  return {
    get_workspace_summary: tool({
      description:
        'Get a summary of all repos, health scores, open PRs, and signals for this workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const stats = getWorkspaceStats(workspaceId)
        const repos = getRepos(workspaceId)
        const topRepos = repos
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((r) => ({
            name: r.fullName,
            score: r.score,
            grade: r.grade,
            triage: r.triage,
          }))
        const bottomRepos = repos
          .sort((a, b) => a.score - b.score)
          .slice(0, 5)
          .map((r) => ({
            name: r.fullName,
            score: r.score,
            grade: r.grade,
            triage: r.triage,
          }))
        return { stats, topRepos, bottomRepos }
      },
    }),

    get_repos_needing_attention: tool({
      description:
        'Get repos below a health score threshold, sorted by urgency',
      inputSchema: z.object({
        threshold: z
          .number()
          .default(60)
          .describe('Health score threshold (repos below this are returned)'),
      }),
      execute: async ({ threshold }: { threshold: number }) => {
        const repos = getRepos(workspaceId)
        return repos
          .filter((r) => r.score < threshold)
          .sort((a, b) => a.score - b.score)
          .map((r) => ({
            name: r.fullName,
            score: r.score,
            grade: r.grade,
            triage: r.triage,
            language: r.language,
            openIssues: r.openIssues,
            openPRs: r.openPRs,
            lastCommitAt: r.lastCommitAt,
          }))
      },
    }),

    get_external_prs: tool({
      description:
        'Get open pull requests from external contributors with staleness info',
      inputSchema: z.object({}),
      execute: async () => {
        const prs = getPullRequests(workspaceId)
        return prs
          .filter((pr) => pr.isExternal)
          .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
          .map((pr) => ({
            repo: pr.repoFullName,
            number: pr.number,
            title: pr.title,
            author: pr.authorLogin,
            daysSinceUpdate: pr.daysSinceUpdate,
            isStale: pr.isStale,
            isDraft: pr.isDraft,
            ciState: pr.ciState,
            url: pr.url,
          }))
      },
    }),

    get_signal_feed: tool({
      description:
        'Get recent signals (star spikes, health drops, new contributors, etc.)',
      inputSchema: z.object({
        limit: z
          .number()
          .default(10)
          .describe('Maximum number of signals to return'),
      }),
      execute: async ({ limit }: { limit: number }) => {
        return getSignals(workspaceId, { limit })
      },
    }),

    get_repo_health: tool({
      description:
        'Get detailed health score breakdown for a specific repo including all check results',
      inputSchema: z.object({
        repoName: z
          .string()
          .describe(
            'Repository name (e.g. "mcp-server") or full name (e.g. "gleanwork/mcp-server")',
          ),
      }),
      execute: async ({ repoName }: { repoName: string }) => {
        const repos = getRepos(workspaceId)
        const repo = repos.find(
          (r) =>
            r.name === repoName ||
            r.fullName === repoName ||
            r.fullName.endsWith(`/${repoName}`),
        )
        if (!repo)
          return { error: `Repo "${repoName}" not found in this workspace` }
        return {
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
          url: repo.url,
        }
      },
    }),
  }
}
