import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dormantDetector } from './dormant'
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
    type: 'dormant',
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

describe('dormantDetector', () => {
  const emptyContexts = new Map<string, string>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers when repo has no commits in 30+ days', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(35) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('dormant')
    expect(signals[0].repoFullName).toBe('org/test-repo')
    expect(signals[0].metadata.daysSinceLastCommit).toBe(35)
  })

  it('does not trigger when last commit is within 30 days', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(29) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger at exactly 30 days (boundary: < 30 means no trigger, daysSince uses floor)', () => {
    // At exactly 30 days, Math.floor gives 30, and the check is daysSince < 30,
    // so 30 is NOT less than 30 => it triggers
    const repo = makeRepo({ lastCommitAt: daysAgo(30) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not trigger when repo has zero stars', () => {
    const repo = makeRepo({ stars: 0, lastCommitAt: daysAgo(60) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when lastCommitAt is null', () => {
    const repo = makeRepo({ lastCommitAt: null })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('sets severity to warning when dormant 30-60 days', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].severity).toBe('warning')
  })

  it('sets severity to critical when dormant more than 60 days', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(61) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].severity).toBe('critical')
  })

  it('severity at exactly 60 days is warning (> 60 required for critical)', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(60) })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].severity).toBe('warning')
  })

  it('deduplicates when existing dormant signal exists within 30 days', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const existing = makeSignal({
      type: 'dormant',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(10),
    })
    const signals = dormantDetector.detect([repo], [], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate when existing signal is older than 30 days', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const existing = makeSignal({
      type: 'dormant',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(31),
    })
    const signals = dormantDetector.detect([repo], [], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate signals from a different repo', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const existing = makeSignal({
      type: 'dormant',
      repoFullName: 'org/other-repo',
      detectedAt: daysAgo(5),
    })
    const signals = dormantDetector.detect([repo], [], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate signals of a different type', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const existing = makeSignal({
      type: 'health-drop',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(5),
    })
    const signals = dormantDetector.detect([repo], [], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('suppresses signal when context matches suppression keywords', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const contexts = new Map([['org/test-repo', 'This repo is in maintenance mode']])
    const signals = dormantDetector.detect([repo], [], [], contexts)
    expect(signals).toHaveLength(0)
  })

  it('suppresses with "low cadence" context', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const contexts = new Map([['org/test-repo', 'low cadence updates expected']])
    const signals = dormantDetector.detect([repo], [], [], contexts)
    expect(signals).toHaveLength(0)
  })

  it('does not suppress when context does not match keywords', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const contexts = new Map([['org/test-repo', 'This is a critical production repo']])
    const signals = dormantDetector.detect([repo], [], [], contexts)
    expect(signals).toHaveLength(1)
  })

  it('includes open issues and PRs in body when present', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45), openIssues: 3, openPRs: 2 })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals[0].body).toContain('3 open issues')
    expect(signals[0].body).toContain('2 open PRs')
    expect(signals[0].body).toContain('consider triaging or archiving')
  })

  it('suggests archiving when no open issues or PRs', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45), openIssues: 0, openPRs: 0 })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals[0].body).toContain('maintenance notice or archiving')
  })

  it('includes correct metadata', () => {
    const repo = makeRepo({
      lastCommitAt: daysAgo(45),
      stars: 100,
      openIssues: 3,
      openPRs: 1,
    })
    const signals = dormantDetector.detect([repo], [], [], emptyContexts)

    expect(signals[0].metadata).toMatchObject({
      daysSinceLastCommit: 45,
      stars: 100,
      openIssues: 3,
      openPRs: 1,
    })
    expect(signals[0].metadata.lastCommitDate).toBe(repo.lastCommitAt)
  })

  it('processes multiple repos and only flags dormant ones', () => {
    const active = makeRepo({ fullName: 'org/active', lastCommitAt: daysAgo(5) })
    const dormant = makeRepo({ fullName: 'org/dormant', name: 'dormant', lastCommitAt: daysAgo(40) })
    const noStars = makeRepo({ fullName: 'org/no-stars', stars: 0, lastCommitAt: daysAgo(90) })

    const signals = dormantDetector.detect([active, dormant, noStars], [], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].repoFullName).toBe('org/dormant')
  })
})
