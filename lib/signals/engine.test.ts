import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scoreRepo, detectEvents } from './engine'
import type { RepoSnapshot } from './types'
import type { PullRequest, Repo, Signal } from '@/types/workspace'

function makeSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    name: 'test-repo',
    fullName: 'org/test-repo',
    stars: 50,
    forks: 10,
    openIssues: 5,
    openPRs: 2,
    lastCommitAt: new Date().toISOString(),
    lastReleaseAt: new Date().toISOString(),
    hasCI: true,
    hasLicense: true,
    hasContributing: true,
    language: 'TypeScript',
    ...overrides,
  }
}

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
    grade: 'B',
    triage: 'healthy',
    pillars: { activity: 20, community: 15, quality: 25, security: 15 },
    checkResults: {},
    workspaceId: 1,
    syncedAt: new Date().toISOString(),
    ...overrides,
  }
}

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
    type: 'dormant',
    severity: 'warning',
    title: 'test',
    body: 'test',
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

describe('scoreRepo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('scores a healthy repo near 100', () => {
    const snapshot = makeSnapshot({
      lastCommitAt: daysAgo(2),
      lastReleaseAt: daysAgo(10),
    })
    const result = scoreRepo(snapshot, [])
    expect(result.score).toBeGreaterThanOrEqual(90)
    expect(result.grade).toBe('A')
    expect(result.triage).toBe('healthy')
  })

  it('scores a neglected repo low', () => {
    const snapshot = makeSnapshot({
      lastCommitAt: daysAgo(120),
      lastReleaseAt: daysAgo(200),
      hasCI: false,
      hasLicense: false,
      hasContributing: false,
    })
    const result = scoreRepo(snapshot, [])
    expect(result.score).toBeLessThan(30)
    expect(result.grade).toBe('F')
    expect(result.triage).toBe('critical')
  })

  it('returns checkResults with signal metadata', () => {
    const snapshot = makeSnapshot({ lastCommitAt: daysAgo(5) })
    const result = scoreRepo(snapshot, [])
    expect(result.checkResults['commit-frequency']).toBeDefined()
    expect(result.checkResults['commit-frequency'].pillar).toBe('activity')
    expect(result.checkResults['commit-frequency'].checkName).toBe('Commit frequency')
  })

  it('respects dismissed checks', () => {
    const snapshot = makeSnapshot({
      lastCommitAt: daysAgo(5),
      lastReleaseAt: daysAgo(10),
    })
    const dismissed = new Set(['commit-frequency'])
    const withDismiss = scoreRepo(snapshot, [], dismissed)
    const without = scoreRepo(snapshot, [])
    expect(withDismiss.checkResults['commit-frequency']).toBeUndefined()
    expect(without.checkResults['commit-frequency']).toBeDefined()
  })

  it('dynamic scaling: 2 active pillars scale to 100', () => {
    const snapshot = makeSnapshot({
      lastCommitAt: daysAgo(2),
      lastReleaseAt: null,
      hasCI: true,
      hasLicense: true,
      hasContributing: true,
    })
    const result = scoreRepo(snapshot, [])

    expect(result.pillars.community).toBe(0)
    expect(result.pillars.security).toBe(0)

    const activePillarSum = result.pillars.activity + result.pillars.quality
    expect(activePillarSum).toBeGreaterThan(80)
    expect(result.score).toBe(activePillarSum)
  })

  it('dynamic scaling: all quality checks passing gives full pillar share', () => {
    const snapshot = makeSnapshot({
      lastCommitAt: null,
      lastReleaseAt: null,
      hasCI: true,
      hasLicense: true,
      hasContributing: true,
    })
    const result = scoreRepo(snapshot, [])

    expect(result.pillars.quality).toBeGreaterThan(0)
    expect(result.pillars.security).toBe(0)
    expect(result.pillars.community).toBe(0)
  })

  it('includes PR data in scoring via pr-merge-velocity', () => {
    const snapshot = makeSnapshot({ lastCommitAt: daysAgo(2) })
    const manyPRs = Array.from({ length: 20 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}`, repoFullName: 'org/test-repo' }),
    )
    const result = scoreRepo(snapshot, manyPRs)
    expect(result.checkResults['pr-merge-velocity']).toBeDefined()
    expect(result.checkResults['pr-merge-velocity'].score).toBeLessThan(1.0)
  })

  it('filters PRs to correct repo', () => {
    const snapshot = makeSnapshot({ lastCommitAt: daysAgo(2) })
    const otherRepoPRs = Array.from({ length: 20 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}`, repoFullName: 'org/other-repo' }),
    )
    const result = scoreRepo(snapshot, otherRepoPRs)
    expect(result.checkResults['pr-merge-velocity'].score).toBe(1.0)
  })
})

describe('detectEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('detects dormant repo', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const signals = detectEvents(repo, undefined, [], [])
    const dormant = signals.find((s) => s.type === 'dormant-repo')
    expect(dormant).toBeDefined()
    expect(dormant!.severity).toBe('warning')
  })

  it('detects health drop', () => {
    const repo = makeRepo({ score: 60, pillars: { activity: 10, community: 10, quality: 25, security: 15 } })
    const prev = makeRepo({ score: 75 })
    const signals = detectEvents(repo, prev, [], [])
    const drop = signals.find((s) => s.type === 'health-drop')
    expect(drop).toBeDefined()
  })

  it('detects star spike', () => {
    const repo = makeRepo({ stars: 120 })
    const prev = makeRepo({ stars: 100 })
    const signals = detectEvents(repo, prev, [], [])
    const spike = signals.find((s) => s.type === 'star-spike')
    expect(spike).toBeDefined()
  })

  it('detects stale human PRs and excludes bots', () => {
    const repo = makeRepo()
    const prs = [
      makePR({ number: 1, authorLogin: 'human', isExternal: true, daysSinceUpdate: 10 }),
      makePR({ number: 2, authorLogin: 'dependabot[bot]', isExternal: true, daysSinceUpdate: 30 }),
    ]
    const signals = detectEvents(repo, undefined, prs, [])
    const stale = signals.find((s) => s.type === 'stale-prs')
    expect(stale).toBeDefined()
    expect(stale!.metadata.prNumbers).toEqual([1])
  })

  it('detects stale bot PRs separately', () => {
    const repo = makeRepo()
    const prs = Array.from({ length: 6 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: 'dependabot[bot]' }),
    )
    const signals = detectEvents(repo, undefined, prs, [])
    const botSignal = signals.find((s) => s.type === 'stale-bot-prs')
    expect(botSignal).toBeDefined()
  })

  it('suppresses signals based on context keywords', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const signals = detectEvents(repo, undefined, [], [], 'This repo is in maintenance mode')
    const dormant = signals.find((s) => s.type === 'dormant-repo')
    expect(dormant).toBeUndefined()
  })

  it('deduplicates based on meta.dedupDays', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const existing = [
      makeSignal({
        type: 'dormant-repo' as Signal['type'],
        repoFullName: 'org/test-repo',
        detectedAt: daysAgo(10),
      }),
    ]
    const signals = detectEvents(repo, undefined, [], existing)
    const dormant = signals.find((s) => s.type === 'dormant-repo')
    expect(dormant).toBeUndefined()
  })

  it('does not deduplicate when existing signal is outside dedup window', () => {
    const repo = makeRepo({ lastCommitAt: daysAgo(45) })
    const existing = [
      makeSignal({
        type: 'dormant-repo' as Signal['type'],
        repoFullName: 'org/test-repo',
        detectedAt: daysAgo(31),
      }),
    ]
    const signals = detectEvents(repo, undefined, [], existing)
    const dormant = signals.find((s) => s.type === 'dormant-repo')
    expect(dormant).toBeDefined()
  })

  it('filters PRs to correct repo', () => {
    const repo = makeRepo()
    const otherRepoPRs = [
      makePR({
        number: 1,
        authorLogin: 'human',
        isExternal: true,
        daysSinceUpdate: 10,
        repoFullName: 'org/other-repo',
      }),
    ]
    const signals = detectEvents(repo, undefined, otherRepoPRs, [])
    const stale = signals.find((s) => s.type === 'stale-prs')
    expect(stale).toBeUndefined()
  })
})
