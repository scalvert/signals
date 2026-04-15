import { describe, it, expect } from 'vitest'
import { milestoneDetector } from './milestone'
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
    type: 'milestone',
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

describe('milestoneDetector', () => {
  const emptyContexts = new Map<string, string>()

  it('triggers when crossing the 10-star milestone', () => {
    const prev = makeRepo({ stars: 8 })
    const current = makeRepo({ stars: 12 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('milestone')
    expect(signals[0].metadata.milestone).toBe(10)
  })

  it('triggers when crossing the 100-star milestone', () => {
    const prev = makeRepo({ stars: 90 })
    const current = makeRepo({ stars: 105 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.milestone).toBe(100)
  })

  it('triggers when crossing the 1000-star milestone and formats as 1k', () => {
    const prev = makeRepo({ stars: 950 })
    const current = makeRepo({ stars: 1050 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.milestone).toBe(1000)
    expect(signals[0].title).toContain('1k')
  })

  it('uses the highest crossed milestone when multiple are crossed at once', () => {
    const prev = makeRepo({ stars: 8 })
    const current = makeRepo({ stars: 60 }) // crosses 10, 25, 50
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.milestone).toBe(50)
  })

  it('does not trigger when no milestone is crossed', () => {
    const prev = makeRepo({ stars: 12 })
    const current = makeRepo({ stars: 20 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not trigger when stars decrease', () => {
    const prev = makeRepo({ stars: 110 })
    const current = makeRepo({ stars: 90 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('triggers when exactly reaching a milestone', () => {
    const prev = makeRepo({ stars: 9 })
    const current = makeRepo({ stars: 10 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.milestone).toBe(10)
  })

  it('does not trigger when staying at a milestone', () => {
    const prev = makeRepo({ stars: 10 })
    const current = makeRepo({ stars: 10 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('treats missing previous repo as 0 stars', () => {
    const current = makeRepo({ stars: 30 }) // crosses 10 and 25
    const signals = milestoneDetector.detect([current], [], [], emptyContexts)

    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.milestone).toBe(25)
  })

  it('deduplicates based on milestone value per repo', () => {
    const prev = makeRepo({ stars: 8 })
    const current = makeRepo({ stars: 12 })
    const existing = makeSignal({
      type: 'milestone',
      repoFullName: 'org/test-repo',
      metadata: { milestone: 10 },
    })
    const signals = milestoneDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(0)
  })

  it('does not deduplicate a different milestone for the same repo', () => {
    const prev = makeRepo({ stars: 90 })
    const current = makeRepo({ stars: 105 })
    const existing = makeSignal({
      type: 'milestone',
      repoFullName: 'org/test-repo',
      metadata: { milestone: 50 },
    })
    const signals = milestoneDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
    expect(signals[0].metadata.milestone).toBe(100)
  })

  it('does not deduplicate the same milestone for a different repo', () => {
    const prev = makeRepo({ stars: 8 })
    const current = makeRepo({ stars: 12 })
    const existing = makeSignal({
      type: 'milestone',
      repoFullName: 'org/other-repo',
      metadata: { milestone: 10 },
    })
    const signals = milestoneDetector.detect([current], [prev], [existing], emptyContexts)
    expect(signals).toHaveLength(1)
  })

  it('always sets severity to info', () => {
    const prev = makeRepo({ stars: 9000 })
    const current = makeRepo({ stars: 10001 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].severity).toBe('info')
  })

  it('includes currentStars in metadata', () => {
    const prev = makeRepo({ stars: 8 })
    const current = makeRepo({ stars: 15 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].metadata.currentStars).toBe(15)
  })

  it('body includes repo name and star count', () => {
    const prev = makeRepo({ stars: 8, name: 'cool-project' })
    const current = makeRepo({ stars: 15, name: 'cool-project' })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].body).toContain('cool-project')
    expect(signals[0].body).toContain('15')
  })

  it('formats milestones >= 1000 with k suffix', () => {
    const prev = makeRepo({ stars: 4500 })
    const current = makeRepo({ stars: 5200 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].title).toContain('5k')
    expect(signals[0].body).toContain('5k')
  })

  it('formats milestones < 1000 as plain numbers', () => {
    const prev = makeRepo({ stars: 200 })
    const current = makeRepo({ stars: 260 })
    const signals = milestoneDetector.detect([current], [prev], [], emptyContexts)

    expect(signals[0].title).toContain('250')
  })
})
