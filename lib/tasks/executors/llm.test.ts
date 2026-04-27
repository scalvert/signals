import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Task, Signal } from '@/types/workspace'

const mockGenerateText = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  stepCountIs: (n: number) => ({ type: 'step-count', value: n }),
}))
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: (model: string) => ({ modelId: model }) }))
vi.mock('../github-tools', () => ({
  buildGitHubTools: () => ({ get_pr_diff: {}, comment_on_pr: {} }),
}))

import { executeLlmDispatch } from './llm'

const mockTask: Task = {
  id: 1,
  workspaceId: 1,
  repoFullName: 'org/test-repo',
  title: 'Fix stale PRs',
  description: '2 stale PRs.',
  sourceType: 'signal',
  sourceId: '10',
  status: 'pending',
  provider: null,
  providerRef: null,
  dispatchState: null,
  resultRef: null,
  statusLine: null,
  createdAt: '2026-04-19T00:00:00Z',
  dispatchedAt: null,
  completedAt: null,
  notes: [],
}

const mockSignal: Signal = {
  id: 10,
  type: 'stale-prs',
  severity: 'warning',
  title: '2 stale PRs on test-repo',
  body: '#1 by @bob (30d, external)',
  repoFullName: 'org/test-repo',
  metadata: {
    prs: [
      { number: 1, title: 'Add feature', author: 'bob', daysSinceUpdate: 30, isExternal: true },
    ],
  },
  detectedAt: '2026-04-19T00:00:00Z',
  workspaceId: 1,
  status: 'active',
  dismissedReason: null,
  enrichedBody: null,
  fixable: true,
}

const fixInfo = {
  dispatch: 'llm' as const,
  objective: 'Comment on stale PRs',
  prompt: 'Review PRs on {{repoFullName}}: {{#each prs}}#{{this.number}}{{/each}}',
}

describe('executeLlmDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls generateText and collects comment URLs', async () => {
    mockGenerateText.mockResolvedValue({
      toolResults: [
        { toolName: 'get_pr_diff', output: 'diff content' },
        { toolName: 'comment_on_pr', output: { url: 'https://github.com/org/test-repo/pull/1#comment-1', id: 1 } },
      ],
    })

    const result = await executeLlmDispatch(mockTask, mockSignal, fixInfo, 'token')

    expect(result.success).toBe(true)
    expect(result.statusLine).toBe('Commented on 1 PR')
    expect(result.resultRef).toBe('https://github.com/org/test-repo/pull/1#comment-1')
    expect(mockGenerateText).toHaveBeenCalledOnce()

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prompt).toContain('Review PRs on org/test-repo')
    expect(call.prompt).toContain('#1')
    expect(call.stopWhen).toBeDefined()
  })

  it('handles multiple comment URLs', async () => {
    mockGenerateText.mockResolvedValue({
      toolResults: [
        { toolName: 'comment_on_pr', output: { url: 'https://github.com/org/test-repo/pull/1#c1' } },
        { toolName: 'comment_on_pr', output: { url: 'https://github.com/org/test-repo/pull/2#c2' } },
      ],
    })

    const result = await executeLlmDispatch(mockTask, mockSignal, fixInfo, 'token')

    expect(result.success).toBe(true)
    expect(result.statusLine).toBe('Commented on 2 PRs')
  })

  it('handles no comments posted', async () => {
    mockGenerateText.mockResolvedValue({
      toolResults: [],
    })

    const result = await executeLlmDispatch(mockTask, mockSignal, fixInfo, 'token')

    expect(result.success).toBe(true)
    expect(result.statusLine).toBe('Completed — no comments posted')
    expect(result.resultRef).toBeUndefined()
  })

  it('returns failure on error', async () => {
    mockGenerateText.mockRejectedValue(new Error('API quota exceeded'))

    const result = await executeLlmDispatch(mockTask, mockSignal, fixInfo, 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('API quota exceeded')
    expect(result.statusLine).toContain('Failed')
  })
})
