import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { healthDropDetector } from './health-drop'
import type { Repo, Signal, RepoPillars } from '@/types/workspace'

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
    type: 'health-drop',
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

describe('healthDropDetector', () => {
  const emptyContexts = new Map<string, string>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers when score drops by 4+ points', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 76 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('health-drop')
    expect(signals[0].metadata.drop).toBe(4)
    expect(signals[0].metadata.scoreBefore).toBe(80)
    expect(signals[0].metadata.scoreAfter).toBe(76)
  })

  it('does not trigger when score drops by less than 4 points', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 77 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when score increases', () => {
    const prev = makeRepo({ score: 70 })
    const current = makeRepo({ score: 80 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when score stays the same', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 80 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when no previous repo exists', () => {
    const current = makeRepo({ score: 50 })
    const signals = healthDropDetector.detect([current], [], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('sets severity to warning for drops of 4-8 points', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 74 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('warning')
  })

  it('sets severity to critical for drops greater than 8 points', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 71 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('critical')
  })

  it('severity at exactly 8 point drop is warning (> 8 required for critical)', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 72 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('warning')
  })

  it('deduplicates when existing signal within 7 days', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const existing = makeSignal({
      type: 'health-drop',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(3),
    })
    const signals = healthDropDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate when existing signal is older than 7 days', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const existing = makeSignal({
      type: 'health-drop',
      repoFullName: 'org/test-repo',
      detectedAt: daysAgo(8),
    })
    const signals = healthDropDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate signals from a different repo', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const existing = makeSignal({
      type: 'health-drop',
      repoFullName: 'org/other-repo',
      detectedAt: daysAgo(1),
    })
    const signals = healthDropDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('suppresses when context matches suppression keywords', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const contexts = new Map([['org/test-repo', 'Expected decline during migration']])
    const signals = healthDropDetector.detect([current], [prev], [], contexts)
    expect(signals).toHaveLength(0)
  })

  it('suppresses with "winding down" context', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const contexts = new Map([['org/test-repo', 'This project is winding down']])
    const signals = healthDropDetector.detect([current], [prev], [], contexts)
    expect(signals).toHaveLength(0)
  })

  it('does not suppress when context has no matching keywords', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const contexts = new Map([['org/test-repo', 'Critical production service']])
    const signals = healthDropDetector.detect([current], [prev], [], contexts)
    expect(signals).toHaveLength(1)
  })

  it('includes declining pillars in body when pillar drops > 2', () => {
    const prevPillars: RepoPillars = { activity: 20, community: 15, quality: 25, security: 15 }
    const currentPillars: RepoPillars = { activity: 15, community: 15, quality: 20, security: 15 }
    const prev = makeRepo({ score: 80, pillars: prevPillars })
    const current = makeRepo({ score: 70, pillars: currentPillars })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].body).toContain('activity')
    expect(signals[0].body).toContain('quality')
  })

  it('shows generic message when no pillar drops more than 2', () => {
    const prevPillars: RepoPillars = { activity: 20, community: 15, quality: 25, security: 15 }
    const currentPillars: RepoPillars = { activity: 19, community: 14, quality: 24, security: 14 }
    const prev = makeRepo({ score: 80, pillars: prevPillars })
    const current = makeRepo({ score: 75, pillars: currentPillars })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].body).toContain('Check individual health checks for details')
  })

  it('includes pillar data in metadata', () => {
    const prevPillars: RepoPillars = { activity: 20, community: 15, quality: 25, security: 15 }
    const currentPillars: RepoPillars = { activity: 10, community: 15, quality: 25, security: 15 }
    const prev = makeRepo({ score: 80, pillars: prevPillars })
    const current = makeRepo({ score: 70, pillars: currentPillars })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].metadata.pillarsBefore).toEqual(prevPillars)
    expect(signals[0].metadata.pillarsAfter).toEqual(currentPillars)
  })

  it('body includes score transition', () => {
    const prev = makeRepo({ score: 80 })
    const current = makeRepo({ score: 70 })
    const signals = healthDropDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].body).toContain('80')
    expect(signals[0].body).toContain('70')
  })
})
