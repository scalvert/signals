import { describe, it, expect } from 'vitest'
import { mergeDispatchState } from './reconcile'
import type { AttentionItem, SignalsState } from './types'

function item(id: string, dispatch: AttentionItem['dispatch']): AttentionItem {
  return {
    id,
    repo: id.split('#')[0],
    repoUrl: '',
    stars: 0,
    type: id.split('#')[1],
    category: 'quality',
    severity: 'warning',
    title: id,
    rationale: '',
    detail: '',
    fixable: true,
    dispatch,
    rank: 0,
    impact: 0,
    effort: 'low',
    detectedAt: 'now',
  }
}

const dispatchable = () => ({ available: true, prompt: 'do it' })

function state(items: AttentionItem[]): SignalsState {
  return { generatedAt: 'now', repoCount: 1, items }
}

describe('mergeDispatchState', () => {
  it('carries dispatch refs forward onto a freshly-collected item with the same id', () => {
    const fresh = state([item('a/b#has-license', dispatchable())])
    const prior = state([
      item('a/b#has-license', {
        ...dispatchable(),
        agent: 'claude',
        targetIssueUrl: 'https://github.com/a/b/issues/1',
        branch: 'claude/issue-1-x',
        prUrl: 'https://github.com/a/b/pull/2',
        status: 'pr-open',
      }),
    ])

    mergeDispatchState(fresh, prior)

    expect(fresh.items[0].dispatch?.targetIssueUrl).toBe('https://github.com/a/b/issues/1')
    expect(fresh.items[0].dispatch?.prUrl).toBe('https://github.com/a/b/pull/2')
    expect(fresh.items[0].dispatch?.status).toBe('pr-open')
  })

  it('leaves items with no prior dispatch untouched', () => {
    const fresh = state([item('a/b#has-ci', dispatchable())])
    mergeDispatchState(fresh, state([]))
    expect(fresh.items[0].dispatch?.targetIssueUrl).toBeUndefined()
  })

  it('does not resurrect refs for items missing from the fresh set', () => {
    const fresh = state([item('a/b#has-ci', dispatchable())])
    const prior = state([
      item('a/b#has-license', { ...dispatchable(), targetIssueUrl: 'https://github.com/a/b/issues/9' }),
    ])
    mergeDispatchState(fresh, prior)
    expect(fresh.items.find((i) => i.id === 'a/b#has-license')).toBeUndefined()
    expect(fresh.items[0].dispatch?.targetIssueUrl).toBeUndefined()
  })
})
