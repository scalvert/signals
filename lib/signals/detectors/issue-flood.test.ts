import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { issueFloodDetector } from './issue-flood'
import type { Repo, Signal } from '@/types/workspace'

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 1,
    name: 'test-repo',
    fullName: 'org/test-repo',
    description: null,
    url: 'https://github.com/org/test-repo',
    language: 'TypeScript',
    stars: 50,
    forks: 10,
    openIssues: 5,
    openPRs: 2,
    lastCommitAt: new Date().toISOString(),
    lastReleaseAt: null,
    hasCI: true,
    hasLicense: true,
    hasContributing: true,
    isPrivate: false,
    isFork: false,
    score: 75,
    grade: 'B' as const,
    triage: 'healthy' as const,
    pillars: { activity: 20, community: 15, quality: 25, security: 15 },
    checkResults: {},
    workspaceId: 1,
    syncedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    type: 'issue-flood',
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

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('issueFloodDetector', () => {
  const emptyContexts = new Map<string, string>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers when 5+ new issues and ratio >= 1.5', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 }) // newIssues=10, ratio=2.0
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('issue-flood')
    expect(signals[0].metadata.newCount).toBe(10)
  })

  it('does not trigger when fewer than 5 new issues', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 14 }) // newIssues=4
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when ratio is below 1.5', () => {
    const prev = makeRepo({ openIssues: 100 })
    const current = makeRepo({ openIssues: 110 }) // newIssues=10, ratio=1.1
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when issues decrease', () => {
    const prev = makeRepo({ openIssues: 20 })
    const current = makeRepo({ openIssues: 10 })
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when no previous repo exists', () => {
    const current = makeRepo({ openIssues: 50 })
    const signals = issueFloodDetector.detect([current], [], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('boundary: exactly 5 new issues with ratio exactly 1.5 triggers', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 15 }) // newIssues=5, ratio=1.5
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('boundary: exactly 5 new issues with ratio below 1.5 does not trigger', () => {
    const prev = makeRepo({ openIssues: 20 })
    const current = makeRepo({ openIssues: 25 }) // newIssues=5, ratio=1.25
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('handles prev.openIssues of 0 (ratio = newIssues)', () => {
    const prev = makeRepo({ openIssues: 0 })
    const current = makeRepo({ openIssues: 6 }) // newIssues=6, ratio=6
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('always sets severity to warning', () => {
    const prev = makeRepo({ openIssues: 5 })
    const current = makeRepo({ openIssues: 50 })
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('warning')
  })

  it('deduplicates when existing signal within 7 days', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 })
    const existing = makeSignal({
      type: 'issue-flood',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(3),
    })
    const signals = issueFloodDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate when existing signal is older than 7 days', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 })
    const existing = makeSignal({
      type: 'issue-flood',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(8),
    })
    const signals = issueFloodDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate signals from a different repo', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 })
    const existing = makeSignal({
      type: 'issue-flood',
      repoFullName: 'org/other-repo',
      detectedAt: daysAgo(1),
    })
    const signals = issueFloodDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate signals of a different type', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 })
    const existing = makeSignal({
      type: 'health-drop',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(1),
    })
    const signals = issueFloodDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('includes correct metadata', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 })
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].metadata).toMatchObject({
      newCount: 10,
      previousTotal: 10,
      currentTotal: 20,
      ratio: 2,
    })
  })

  it('rounds ratio to 2 decimal places', () => {
    const prev = makeRepo({ openIssues: 3 })
    const current = makeRepo({ openIssues: 8 }) // newIssues=5, ratio=2.6666...
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].metadata.ratio).toBe(2.67)
  })

  it('body includes issue count transition', () => {
    const prev = makeRepo({ openIssues: 10 })
    const current = makeRepo({ openIssues: 20 })
    const signals = issueFloodDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].body).toContain('10 new issues')
    expect(signals[0].body).toContain('10')
    expect(signals[0].body).toContain('20')
  })

  it('processes multiple repos independently', () => {
    const prevA = makeRepo({ fullName: 'org/repo-a', openIssues: 10 })
    const currentA = makeRepo({ fullName: 'org/repo-a', name: 'repo-a', openIssues: 20 })
    const prevB = makeRepo({ fullName: 'org/repo-b', openIssues: 5 })
    const currentB = makeRepo({ fullName: 'org/repo-b', name: 'repo-b', openIssues: 6 })

    const signals = issueFloodDetector.detect(
      [currentA, currentB],
      [prevA, prevB],
      [],
      emptyContexts,
    )

    expect(signals).toHaveLength(1)
    expect(signals[0].repoFullName).toBe('org/repo-a')
  })
})
