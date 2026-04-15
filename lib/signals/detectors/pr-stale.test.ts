import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectStalePRs } from './pr-stale'
import type { PullRequest, Signal } from '@/types/workspace'

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Fix something',
    url: 'https://github.com/org/test-repo/pull/42',
    authorLogin: 'contributor',
    authorAssociation: 'CONTRIBUTOR',
    repoFullName: 'org/test-repo',
    isDraft: false,
    ciState: 'passing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysSinceUpdate: 0,
    isExternal: true,
    isStale: false,
    workspaceId: 1,
    ...overrides,
  }
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    type: 'pr-stale',
    severity: 'warning',
    title: 'test signal',
    body: 'test body',
    repoFullName: 'org/test-repo',
    metadata: {},
    detectedAt: new Date().toISOString(),
    workspaceId: 1,
    status: 'active',
    dismissedReason: null,
    enrichedBody: null,
    ...overrides,
  }
}

describe('detectStalePRs', () => {
  const emptyContexts = new Map<string, string>()

  it('triggers for external PRs stale 7+ days', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 8 })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('pr-stale')
  })

  it('does not trigger for external PRs stale less than 7 days', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 6 })
    const signals = detectStalePRs([pr], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('triggers for internal PRs stale 14+ days', () => {
    const pr = makePR({ isExternal: false, daysSinceUpdate: 15 })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals).toHaveLength(1)
  })

  it('does not trigger for internal PRs stale less than 14 days', () => {
    const pr = makePR({ isExternal: false, daysSinceUpdate: 13 })
    const signals = detectStalePRs([pr], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger for draft PRs', () => {
    const pr = makePR({ isDraft: true, isExternal: true, daysSinceUpdate: 30 })
    const signals = detectStalePRs([pr], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('groups stale PRs by repo into a single signal', () => {
    const pr1 = makePR({ number: 1, isExternal: true, daysSinceUpdate: 10 })
    const pr2 = makePR({ number: 2, isExternal: true, daysSinceUpdate: 8 })
    const signals = detectStalePRs([pr1, pr2], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].title).toContain('2 stale PRs')
    expect(signals[0].metadata.prNumbers).toEqual(expect.arrayContaining([1, 2]))
  })

  it('creates separate signals for different repos', () => {
    const pr1 = makePR({ number: 1, repoFullName: 'org/repo-a', isExternal: true, daysSinceUpdate: 10 })
    const pr2 = makePR({ number: 2, repoFullName: 'org/repo-b', isExternal: true, daysSinceUpdate: 10 })
    const signals = detectStalePRs([pr1, pr2], [], emptyContexts)

    expect(signals).toHaveLength(2)
  })

  it('sets severity to critical when external PR is stale > 14 days', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 15 })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals[0].severity).toBe('critical')
  })

  it('sets severity to warning when external PR is stale <= 14 days', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 10 })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals[0].severity).toBe('warning')
  })

  it('sets severity to warning for internal-only stale PRs', () => {
    const pr = makePR({ isExternal: false, daysSinceUpdate: 20 })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals[0].severity).toBe('warning')
  })

  it('sets severity to critical when group has external PR stale > 14 days', () => {
    const internal = makePR({ number: 1, isExternal: false, daysSinceUpdate: 20 })
    const external = makePR({ number: 2, isExternal: true, daysSinceUpdate: 15 })
    const signals = detectStalePRs([internal, external], [], emptyContexts)

    expect(signals[0].severity).toBe('critical')
  })

  it('deduplicates when existing signal has the same PR number set', () => {
    const pr = makePR({ number: 42, isExternal: true, daysSinceUpdate: 10 })
    const existing = makeSignal({
      type: 'pr-stale',
      repoFullName: 'org/test-repo',
      metadata: { prNumbers: [42] },
    })
    const signals = detectStalePRs([pr], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate when PR numbers differ', () => {
    const pr = makePR({ number: 99, isExternal: true, daysSinceUpdate: 10 })
    const existing = makeSignal({
      type: 'pr-stale',
      repoFullName: 'org/test-repo',
      metadata: { prNumbers: [42] },
    })
    const signals = detectStalePRs([pr], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('deduplicates based on sorted PR number set', () => {
    const pr1 = makePR({ number: 10, isExternal: true, daysSinceUpdate: 8 })
    const pr2 = makePR({ number: 5, isExternal: true, daysSinceUpdate: 8 })
    const existing = makeSignal({
      type: 'pr-stale',
      repoFullName: 'org/test-repo',
      metadata: { prNumbers: [5, 10] },
    })
    const signals = detectStalePRs([pr1, pr2], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('suppresses when context matches suppression keywords', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 10 })
    const contexts = new Map([['org/test-repo', 'This repo has long-lived PRs by design']])
    const signals = detectStalePRs([pr], [], contexts)
    expect(signals).toHaveLength(0)
  })

  it('suppresses with "slow review" context', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 10 })
    const contexts = new Map([['org/test-repo', 'slow review cadence expected']])
    const signals = detectStalePRs([pr], [], contexts)
    expect(signals).toHaveLength(0)
  })

  it('does not suppress when context does not match keywords', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 10 })
    const contexts = new Map([['org/test-repo', 'Active project, review quickly']])
    const signals = detectStalePRs([pr], [], contexts)
    expect(signals).toHaveLength(1)
  })

  it('body includes PR details', () => {
    const pr = makePR({
      number: 42,
      authorLogin: 'alice',
      isExternal: true,
      daysSinceUpdate: 10,
    })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals[0].body).toContain('#42')
    expect(signals[0].body).toContain('@alice')
    expect(signals[0].body).toContain('10d')
    expect(signals[0].body).toContain('external')
  })

  it('title uses singular "PR" for a single stale PR', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 10 })
    const signals = detectStalePRs([pr], [], emptyContexts)

    expect(signals[0].title).toContain('1 stale PR on')
    expect(signals[0].title).not.toContain('PRs')
  })

  it('title uses plural "PRs" for multiple stale PRs', () => {
    const pr1 = makePR({ number: 1, isExternal: true, daysSinceUpdate: 10 })
    const pr2 = makePR({ number: 2, isExternal: true, daysSinceUpdate: 8 })
    const signals = detectStalePRs([pr1, pr2], [], emptyContexts)

    expect(signals[0].title).toContain('2 stale PRs')
  })

  it('metadata includes oldestDays', () => {
    const pr1 = makePR({ number: 1, isExternal: true, daysSinceUpdate: 10 })
    const pr2 = makePR({ number: 2, isExternal: true, daysSinceUpdate: 20 })
    const signals = detectStalePRs([pr1, pr2], [], emptyContexts)

    expect(signals[0].metadata.oldestDays).toBe(20)
  })

  it('metadata includes per-PR details', () => {
    const pr = makePR({
      number: 42,
      title: 'Fix bug',
      authorLogin: 'bob',
      isExternal: true,
      daysSinceUpdate: 10,
    })
    const signals = detectStalePRs([pr], [], emptyContexts)

    const prs = signals[0].metadata.prs as Array<Record<string, unknown>>
    expect(prs).toHaveLength(1)
    expect(prs[0]).toMatchObject({
      number: 42,
      title: 'Fix bug',
      author: 'bob',
      daysSinceUpdate: 10,
      isExternal: true,
    })
  })

  it('boundary: external PR at exactly 7 days triggers', () => {
    const pr = makePR({ isExternal: true, daysSinceUpdate: 7 })
    const signals = detectStalePRs([pr], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('boundary: internal PR at exactly 14 days triggers', () => {
    const pr = makePR({ isExternal: false, daysSinceUpdate: 14 })
    const signals = detectStalePRs([pr], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })
})
