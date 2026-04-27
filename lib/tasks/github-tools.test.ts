import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPullsGet = vi.fn()
const mockCreateComment = vi.fn()

vi.mock('@/lib/github/client', () => ({
  getOctokit: () => ({
    rest: {
      pulls: { get: mockPullsGet },
      issues: { createComment: mockCreateComment },
    },
  }),
}))

import { buildGitHubTools } from './github-tools'

describe('buildGitHubTools', () => {
  const tools = buildGitHubTools('fake-token')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get_pr_diff', () => {
    it('returns the diff text', async () => {
      const mockDiff = 'diff --git a/file.ts b/file.ts\n+added line'
      mockPullsGet.mockResolvedValue({ data: mockDiff })

      const result = await tools.get_pr_diff.execute!(
        { owner: 'org', repo: 'repo', prNumber: 42 },
        { toolCallId: 'test', messages: [], abortSignal: undefined as never },
      )

      expect(result).toBe(mockDiff)
      expect(mockPullsGet).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        mediaType: { format: 'diff' },
      })
    })

    it('truncates diffs over 50k characters', async () => {
      const largeDiff = 'x'.repeat(60_000)
      mockPullsGet.mockResolvedValue({ data: largeDiff })

      const result = await tools.get_pr_diff.execute!(
        { owner: 'org', repo: 'repo', prNumber: 1 },
        { toolCallId: 'test', messages: [], abortSignal: undefined as never },
      )

      expect((result as string).length).toBe(50_000 + '\n\n[diff truncated — too large]'.length)
      expect(result).toContain('[diff truncated')
    })
  })

  describe('comment_on_pr', () => {
    it('posts a comment and returns the URL', async () => {
      mockCreateComment.mockResolvedValue({
        data: { html_url: 'https://github.com/org/repo/pull/42#comment-1', id: 123 },
      })

      const result = await tools.comment_on_pr.execute!(
        { owner: 'org', repo: 'repo', prNumber: 42, body: 'Looks good!' },
        { toolCallId: 'test', messages: [], abortSignal: undefined as never },
      )

      expect(result).toEqual({
        url: 'https://github.com/org/repo/pull/42#comment-1',
        id: 123,
      })
      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        issue_number: 42,
        body: 'Looks good!',
      })
    })
  })
})
