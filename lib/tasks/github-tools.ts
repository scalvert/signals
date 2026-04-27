import { tool } from 'ai'
import { z } from 'zod'
import { getOctokit } from '@/lib/github/client'

export function buildGitHubTools(token: string) {
  const octokit = getOctokit(token)

  return {
    get_pr_diff: tool({
      description: 'Read the diff of a pull request to understand what it changes',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        prNumber: z.number().describe('Pull request number'),
      }),
      execute: async ({ owner, repo, prNumber }) => {
        const { data } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: prNumber,
          mediaType: { format: 'diff' },
        })
        const diff = data as unknown as string
        if (diff.length > 50_000) {
          return diff.slice(0, 50_000) + '\n\n[diff truncated — too large]'
        }
        return diff
      },
    }),

    comment_on_pr: tool({
      description: 'Post a comment on a pull request',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        prNumber: z.number().describe('Pull request number'),
        body: z.string().describe('Comment body in Markdown'),
      }),
      execute: async ({ owner, repo, prNumber, body }) => {
        const { data } = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body,
        })
        return { url: data.html_url, id: data.id }
      },
    }),
  }
}
