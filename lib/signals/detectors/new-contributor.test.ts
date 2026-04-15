import { describe, it, expect } from 'vitest'
import { detectNewContributors } from './new-contributor'
import type { PullRequest, Signal } from '@/types/workspace'

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Add feature',
    url: 'https://github.com/org/test-repo/pull/42',
    authorLogin: 'new-dev',
    authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
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
    type: 'new-contributor',
    severity: 'info',
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

describe('detectNewContributors', () => {
  it('triggers for FIRST_TIME_CONTRIBUTOR', () => {
    const pr = makePR({ authorAssociation: 'FIRST_TIME_CONTRIBUTOR' })
    const signals = detectNewContributors([pr], [])

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('new-contributor')
  })

  it('triggers for FIRST_TIMER', () => {
    const pr = makePR({ authorAssociation: 'FIRST_TIMER' })
    const signals = detectNewContributors([pr], [])

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('new-contributor')
  })

  it('does not trigger for CONTRIBUTOR association', () => {
    const pr = makePR({ authorAssociation: 'CONTRIBUTOR' })
    const signals = detectNewContributors([pr], [])
    expect(signals).toHaveLength(0)
  })

  it('does not trigger for MEMBER association', () => {
    const pr = makePR({ authorAssociation: 'MEMBER' })
    const signals = detectNewContributors([pr], [])
    expect(signals).toHaveLength(0)
  })

  it('does not trigger for OWNER association', () => {
    const pr = makePR({ authorAssociation: 'OWNER' })
    const signals = detectNewContributors([pr], [])
    expect(signals).toHaveLength(0)
  })

  it('does not trigger for COLLABORATOR association', () => {
    const pr = makePR({ authorAssociation: 'COLLABORATOR' })
    const signals = detectNewContributors([pr], [])
    expect(signals).toHaveLength(0)
  })

  it('does not trigger for NONE association', () => {
    const pr = makePR({ authorAssociation: 'NONE' })
    const signals = detectNewContributors([pr], [])
    expect(signals).toHaveLength(0)
  })

  it('creates separate signals for different contributors', () => {
    const pr1 = makePR({ number: 1, authorLogin: 'alice', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' })
    const pr2 = makePR({ number: 2, authorLogin: 'bob', authorAssociation: 'FIRST_TIMER' })
    const signals = detectNewContributors([pr1, pr2], [])

    expect(signals).toHaveLength(2)
  })

  it('deduplicates by author per repo', () => {
    const pr = makePR({ authorLogin: 'alice', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' })
    const existing = makeSignal({
      type: 'new-contributor',
      repoFullName: 'org/test-repo',
      metadata: { authorLogin: 'alice' },
    })
    const signals = detectNewContributors([pr], [existing])
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate same author in a different repo', () => {
    const pr = makePR({
      authorLogin: 'alice',
      authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
      repoFullName: 'org/other-repo',
    })
    const existing = makeSignal({
      type: 'new-contributor',
      repoFullName: 'org/test-repo',
      metadata: { authorLogin: 'alice' },
    })
    const signals = detectNewContributors([pr], [existing])
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate different author in the same repo', () => {
    const pr = makePR({ authorLogin: 'bob', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' })
    const existing = makeSignal({
      type: 'new-contributor',
      repoFullName: 'org/test-repo',
      metadata: { authorLogin: 'alice' },
    })
    const signals = detectNewContributors([pr], [existing])
    expect(signals).toHaveLength(1)
  })

  it('always sets severity to info', () => {
    const pr = makePR({ authorAssociation: 'FIRST_TIME_CONTRIBUTOR' })
    const signals = detectNewContributors([pr], [])

    expect(signals[0].severity).toBe('info')
  })

  it('includes correct metadata', () => {
    const pr = makePR({
      number: 99,
      title: 'My first PR',
      authorLogin: 'newbie',
      authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
    })
    const signals = detectNewContributors([pr], [])

    expect(signals[0].metadata).toMatchObject({
      prNumber: 99,
      prTitle: 'My first PR',
      authorLogin: 'newbie',
    })
  })

  it('title includes repo name', () => {
    const pr = makePR({
      repoFullName: 'org/cool-lib',
      authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
    })
    const signals = detectNewContributors([pr], [])

    expect(signals[0].title).toContain('cool-lib')
  })

  it('body mentions author and PR number', () => {
    const pr = makePR({
      number: 55,
      authorLogin: 'alice',
      authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
    })
    const signals = detectNewContributors([pr], [])

    expect(signals[0].body).toContain('@alice')
    expect(signals[0].body).toContain('#55')
    expect(signals[0].body).toContain('first contribution')
  })

  it('handles empty PR list', () => {
    const signals = detectNewContributors([], [])
    expect(signals).toHaveLength(0)
  })

  it('handles mix of qualifying and non-qualifying PRs', () => {
    const firstTimer = makePR({ number: 1, authorLogin: 'new1', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' })
    const member = makePR({ number: 2, authorLogin: 'member1', authorAssociation: 'MEMBER' })
    const firstTimerAgain = makePR({ number: 3, authorLogin: 'new2', authorAssociation: 'FIRST_TIMER' })
    const contributor = makePR({ number: 4, authorLogin: 'contrib1', authorAssociation: 'CONTRIBUTOR' })

    const signals = detectNewContributors([firstTimer, member, firstTimerAgain, contributor], [])

    expect(signals).toHaveLength(2)
    expect(signals.map((s) => (s.metadata as Record<string, unknown>).authorLogin)).toEqual(['new1', 'new2'])
  })
})
