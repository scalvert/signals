import { describe, it, expect } from 'vitest'
import { renderSlackText, renderIssueMarkdown, renderDigestMarkdown, DIGEST_MARKER } from './render'
import type { AttentionItem, SignalsState } from './types'

function makeItem(over: Partial<AttentionItem>): AttentionItem {
  return {
    id: 'a/b#dormant-repo',
    repo: 'a/b',
    repoUrl: 'https://github.com/a/b',
    stars: 12,
    type: 'dormant-repo',
    category: 'activity',
    severity: 'critical',
    title: 'b appears dormant',
    rationale: 'no commits in a while',
    detail: 'No commits in 200 days.',
    fixable: true,
    dispatch: { available: true, prompt: 'fix it' },
    rank: 40,
    impact: 36,
    effort: 'medium',
    detectedAt: 'now',
    ...over,
  }
}

const state = (items: AttentionItem[]): SignalsState => ({ generatedAt: 'now', repoCount: 3, items })

describe('render', () => {
  it('renders the top N and respects the limit', () => {
    const s = state([makeItem({ id: 'a/b#x', rank: 50 }), makeItem({ id: 'a/c#y', rank: 10 })])
    const md = renderDigestMarkdown(s, 1)
    expect(md).toContain('Top 1')
    expect(md).toContain('b appears dormant')
  })

  it('issue markdown carries the upsert marker and a dispatch hint for undispatched items', () => {
    const md = renderIssueMarkdown(state([makeItem({})]), 10)
    expect(md.startsWith(DIGEST_MARKER)).toBe(true)
    expect(md).toContain('/dispatch a/b#dormant-repo')
  })

  it('shows PR status instead of a dispatch hint once dispatched', () => {
    const md = renderIssueMarkdown(
      state([makeItem({ dispatch: { available: true, prompt: 'x', status: 'pr-open', prUrl: 'https://github.com/a/b/pull/2' } })]),
      10,
    )
    expect(md).toContain('PR open: https://github.com/a/b/pull/2')
    expect(md).not.toContain('/dispatch a/b#dormant-repo')
  })

  it('slack text uses mrkdwn links and handles the empty case', () => {
    expect(renderSlackText(state([makeItem({})]), 10)).toContain('<https://github.com/a/b|a/b>')
    expect(renderSlackText(state([]), 10)).toContain('nothing needs your attention')
  })
})
