import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { starSpikeDetector } from './star-spike'
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
    type: 'star-spike',
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

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

describe('starSpikeDetector', () => {
  const emptyContexts = new Map<string, string>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers with 5+ delta and 3x ratio', () => {
    const prev = makeRepo({ stars: 2 })
    const current = makeRepo({ stars: 8 }) // delta=6, ratio=3.0
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('star-spike')
    expect(signals[0].metadata.delta).toBe(6)
  })

  it('triggers with 20+ absolute delta regardless of ratio', () => {
    const prev = makeRepo({ stars: 1000 })
    const current = makeRepo({ stars: 1025 }) // delta=25, ratio=0.025
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.delta).toBe(25)
  })

  it('does not trigger when delta is below 5', () => {
    const prev = makeRepo({ stars: 1 })
    const current = makeRepo({ stars: 5 }) // delta=4
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when delta >= 5 but ratio < 3 and delta < 20', () => {
    const prev = makeRepo({ stars: 100 })
    const current = makeRepo({ stars: 110 }) // delta=10, ratio=0.1
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('boundary: exactly 5 delta with exactly 3x ratio does not trigger (ratio must be >= 3 and delta < 20 check)', () => {
    // delta=5, prev.stars must be such that 5/prev >= 3 => prev <= 1.67
    const prev = makeRepo({ stars: 1 })
    const current = makeRepo({ stars: 6 }) // delta=5, ratio=5.0
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not trigger when delta is exactly 5 but ratio is below 3 and delta below 20', () => {
    const prev = makeRepo({ stars: 50 })
    const current = makeRepo({ stars: 55 }) // delta=5, ratio=0.1
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('triggers at exactly 20 delta with low ratio', () => {
    const prev = makeRepo({ stars: 500 })
    const current = makeRepo({ stars: 520 }) // delta=20, ratio=0.04
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not trigger at 19 delta with low ratio', () => {
    const prev = makeRepo({ stars: 500 })
    const current = makeRepo({ stars: 519 }) // delta=19, ratio=0.038
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('handles prev.stars of 0 (ratio = delta)', () => {
    const prev = makeRepo({ stars: 0 })
    const current = makeRepo({ stars: 6 }) // delta=6, ratio=6 (since prev=0)
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not trigger when no previous repo exists', () => {
    const current = makeRepo({ stars: 100 })
    const signals = starSpikeDetector.detect([current], [], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when stars decrease', () => {
    const prev = makeRepo({ stars: 100 })
    const current = makeRepo({ stars: 90 })
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('sets severity to info for delta < 20', () => {
    const prev = makeRepo({ stars: 2 })
    const current = makeRepo({ stars: 10 }) // delta=8, ratio=4
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('info')
  })

  it('sets severity to warning for delta >= 20', () => {
    const prev = makeRepo({ stars: 100 })
    const current = makeRepo({ stars: 120 }) // delta=20
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('warning')
  })

  it('deduplicates when existing signal within 24 hours', () => {
    const prev = makeRepo({ stars: 2 })
    const current = makeRepo({ stars: 10 })
    const existing = makeSignal({
      type: 'star-spike',
      repoFullName: 'org/test-repo',
      detectedAt: hoursAgo(12),
    })
    const signals = starSpikeDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate when existing signal is older than 24 hours', () => {
    const prev = makeRepo({ stars: 2 })
    const current = makeRepo({ stars: 10 })
    const existing = makeSignal({
      type: 'star-spike',
      repoFullName: 'org/test-repo',
      detectedAt: hoursAgo(25),
    })
    const signals = starSpikeDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('does not deduplicate signals from different repo', () => {
    const prev = makeRepo({ stars: 2 })
    const current = makeRepo({ stars: 10 })
    const existing = makeSignal({
      type: 'star-spike',
      repoFullName: 'org/other-repo',
      detectedAt: hoursAgo(1),
    })
    const signals = starSpikeDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('includes correct metadata', () => {
    const prev = makeRepo({ stars: 10 })
    const current = makeRepo({ stars: 40 }) // delta=30, ratio=3.0
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].metadata).toMatchObject({
      delta: 30,
      previous: 10,
      current: 40,
      ratio: 3,
    })
  })

  it('body mentions the star transition', () => {
    const prev = makeRepo({ stars: 10 })
    const current = makeRepo({ stars: 40 })
    const signals = starSpikeDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].body).toContain('+30')
    expect(signals[0].body).toContain('10')
    expect(signals[0].body).toContain('40')
  })
})
