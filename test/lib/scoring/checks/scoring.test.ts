import { describe, it, expect } from 'vitest'
import { hasLicenseCheck } from '@/lib/scoring/checks/quality/has-license'
import { hasCICheck } from '@/lib/scoring/checks/quality/has-ci'
import { hasContributingCheck } from '@/lib/scoring/checks/quality/has-contributing'
import { commitFrequencyCheck } from '@/lib/scoring/checks/activity/commit-frequency'
import { releaseCadenceCheck } from '@/lib/scoring/checks/activity/release-cadence'
import { prMergeVelocityCheck } from '@/lib/scoring/checks/activity/pr-merge-velocity'
import { securityPlaceholderCheck } from '@/lib/scoring/checks/security/security-placeholder'
import { scoreRepo } from '@/lib/scoring/engine'
import type { RepoSnapshot } from '@/lib/scoring/types'

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

describe('has-license check', () => {
  it('scores 1 when license present', () => {
    const result = hasLicenseCheck.run(makeSnapshot({ hasLicense: true }))
    expect(result.score).toBe(1)
    expect(result.actionable).toBeUndefined()
  })

  it('scores 0 with actionable when missing', () => {
    const result = hasLicenseCheck.run(makeSnapshot({ hasLicense: false }))
    expect(result.score).toBe(0)
    expect(result.actionable).toBeDefined()
    expect(result.evidence).toHaveLength(1)
  })
})

describe('has-ci check', () => {
  it('scores 1 when CI present', () => {
    const result = hasCICheck.run(makeSnapshot({ hasCI: true }))
    expect(result.score).toBe(1)
  })

  it('scores 0 when CI missing', () => {
    const result = hasCICheck.run(makeSnapshot({ hasCI: false }))
    expect(result.score).toBe(0)
    expect(result.actionable).toBeDefined()
  })
})

describe('has-contributing check', () => {
  it('scores 1 when CONTRIBUTING.md present', () => {
    const result = hasContributingCheck.run(
      makeSnapshot({ hasContributing: true }),
    )
    expect(result.score).toBe(1)
  })

  it('scores 0 when CONTRIBUTING.md missing', () => {
    const result = hasContributingCheck.run(
      makeSnapshot({ hasContributing: false }),
    )
    expect(result.score).toBe(0)
    expect(result.actionable).toBeDefined()
  })
})

describe('commit-frequency check', () => {
  it('scores 1.0 for commit today', () => {
    const result = commitFrequencyCheck.run(
      makeSnapshot({ lastCommitAt: new Date().toISOString() }),
    )
    expect(result.score).toBe(1.0)
  })

  it('scores 0 for null lastCommitAt', () => {
    const result = commitFrequencyCheck.run(
      makeSnapshot({ lastCommitAt: null }),
    )
    expect(result.score).toBe(0)
    expect(result.actionable).toBeDefined()
  })

  it('scores lower for older commits', () => {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString()
    const result = commitFrequencyCheck.run(
      makeSnapshot({ lastCommitAt: thirtyDaysAgo }),
    )
    expect(result.score).toBeLessThanOrEqual(0.6)
    expect(result.score).toBeGreaterThan(0)
  })
})

describe('release-cadence check', () => {
  it('scores 1.0 for recent release', () => {
    const result = releaseCadenceCheck.run(
      makeSnapshot({ lastReleaseAt: new Date().toISOString() }),
    )
    expect(result.score).toBe(1.0)
  })

  it('scores 0.1 for no release', () => {
    const result = releaseCadenceCheck.run(
      makeSnapshot({ lastReleaseAt: null }),
    )
    expect(result.score).toBe(0.1)
    expect(result.actionable).toBeDefined()
  })
})

describe('pr-merge-velocity check', () => {
  it('scores 1.0 for no open PRs', () => {
    const result = prMergeVelocityCheck.run(makeSnapshot({ openPRs: 0 }))
    expect(result.score).toBe(1.0)
  })

  it('scores lower for many open PRs on small repo', () => {
    const result = prMergeVelocityCheck.run(
      makeSnapshot({ openPRs: 10, stars: 5 }),
    )
    expect(result.score).toBeLessThan(0.5)
  })

  it('scores higher for many PRs on large repo', () => {
    const result = prMergeVelocityCheck.run(
      makeSnapshot({ openPRs: 10, stars: 5000 }),
    )
    expect(result.score).toBeGreaterThanOrEqual(0.7)
  })
})

describe('security-placeholder check', () => {
  it('always returns 0.5', () => {
    const result = securityPlaceholderCheck.run(makeSnapshot())
    expect(result.score).toBe(0.5)
  })
})

describe('scoreRepo engine', () => {
  it('returns score between 0 and 100', () => {
    const result = scoreRepo(makeSnapshot())
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns grade A for high-scoring repo', () => {
    const result = scoreRepo(makeSnapshot())
    expect(['A', 'B']).toContain(result.grade)
  })

  it('returns lower grade for unhealthy repo', () => {
    const result = scoreRepo(
      makeSnapshot({
        lastCommitAt: null,
        lastReleaseAt: null,
        hasCI: false,
        hasLicense: false,
        hasContributing: false,
        openPRs: 20,
        stars: 2,
      }),
    )
    expect(['C', 'D', 'F']).toContain(result.grade)
    expect(result.triage).not.toBe('healthy')
  })

  it('returns all four pillar scores', () => {
    const result = scoreRepo(makeSnapshot())
    expect(result.pillars.activity).toBeGreaterThanOrEqual(0)
    expect(result.pillars.activity).toBeLessThanOrEqual(25)
    expect(result.pillars.community).toBeGreaterThanOrEqual(0)
    expect(result.pillars.quality).toBeGreaterThanOrEqual(0)
    expect(result.pillars.security).toBeGreaterThanOrEqual(0)
  })

  it('includes results for each check', () => {
    const result = scoreRepo(makeSnapshot())
    expect(result.results['has-license']).toBeDefined()
    expect(result.results['has-ci']).toBeDefined()
    expect(result.results['commit-frequency']).toBeDefined()
  })
})
