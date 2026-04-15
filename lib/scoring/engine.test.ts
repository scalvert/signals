import { describe, it, expect } from 'vitest'
import { scoreRepo } from './engine'
import { ALL_CHECKS } from './checks'
import type { RepoSnapshot } from './types'

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

const QUALITY_CHECK_IDS = ALL_CHECKS
  .filter((c) => c.pillar === 'quality')
  .map((c) => c.id)

const ACTIVITY_CHECK_IDS = ALL_CHECKS
  .filter((c) => c.pillar === 'activity')
  .map((c) => c.id)

const COMMUNITY_CHECK_IDS = ALL_CHECKS
  .filter((c) => c.pillar === 'community')
  .map((c) => c.id)

const SECURITY_CHECK_IDS = ALL_CHECKS
  .filter((c) => c.pillar === 'security')
  .map((c) => c.id)

const ALL_CHECK_IDS = ALL_CHECKS.map((c) => c.id)

describe('scoreRepo with dismissedChecks', () => {
  it('scores with no dismissed checks (baseline)', () => {
    const snapshot = makeSnapshot()
    const result = scoreRepo(snapshot)
    const resultExplicit = scoreRepo(snapshot, new Set())

    expect(result.score).toBe(resultExplicit.score)
    expect(result.grade).toBe(resultExplicit.grade)
    expect(result.triage).toBe(resultExplicit.triage)
    expect(Object.keys(result.checkResults)).toEqual(
      Object.keys(resultExplicit.checkResults),
    )
  })

  it('dismissing one check removes it from results and changes the score', () => {
    const snapshot = makeSnapshot({
      hasLicense: false,
      hasCI: true,
      hasContributing: true,
    })
    const baseline = scoreRepo(snapshot)
    const dismissed = scoreRepo(snapshot, new Set(['has-license']))

    expect(baseline.checkResults['has-license']).toBeDefined()
    expect(dismissed.checkResults['has-license']).toBeUndefined()
    expect(dismissed.results['has-license']).toBeUndefined()

    // Dismissing a failing check (score 0) should raise the pillar score
    // because the 0-scoring check no longer drags down the weighted average
    expect(dismissed.pillars.quality).toBeGreaterThan(baseline.pillars.quality)
  })

  it('dismissed checks do not appear in checkResults or results', () => {
    const snapshot = makeSnapshot()
    const dismissedSet = new Set(['has-ci', 'commit-frequency'])
    const result = scoreRepo(snapshot, dismissedSet)

    for (const id of dismissedSet) {
      expect(result.checkResults[id]).toBeUndefined()
      expect(result.results[id]).toBeUndefined()
    }

    const remaining = ALL_CHECK_IDS.filter((id) => !dismissedSet.has(id))
    for (const id of remaining) {
      expect(result.checkResults[id]).toBeDefined()
      expect(result.results[id]).toBeDefined()
    }
  })

  it('dismissing all checks in quality pillar sets that pillar score to 0', () => {
    const snapshot = makeSnapshot()
    const result = scoreRepo(snapshot, new Set(QUALITY_CHECK_IDS))

    expect(result.pillars.quality).toBe(0)
    expect(result.pillars.activity).toBeGreaterThan(0)
  })

  it('dismissing all checks in activity pillar sets that pillar score to 0', () => {
    const snapshot = makeSnapshot()
    const result = scoreRepo(snapshot, new Set(ACTIVITY_CHECK_IDS))

    expect(result.pillars.activity).toBe(0)
    expect(result.pillars.quality).toBeGreaterThan(0)
  })

  it('dismissing all checks in community pillar sets that pillar score to 0', () => {
    const snapshot = makeSnapshot()
    const result = scoreRepo(snapshot, new Set(COMMUNITY_CHECK_IDS))

    expect(result.pillars.community).toBe(0)
  })

  it('dismissing all checks in security pillar sets that pillar score to 0', () => {
    const snapshot = makeSnapshot()
    const result = scoreRepo(snapshot, new Set(SECURITY_CHECK_IDS))

    expect(result.pillars.security).toBe(0)
  })

  it('dismissing an invalid check ID has no effect', () => {
    const snapshot = makeSnapshot()
    const baseline = scoreRepo(snapshot)
    const result = scoreRepo(snapshot, new Set(['not-a-real-check']))

    expect(result.score).toBe(baseline.score)
    expect(result.grade).toBe(baseline.grade)
    expect(result.triage).toBe(baseline.triage)
    expect(Object.keys(result.checkResults).sort()).toEqual(
      Object.keys(baseline.checkResults).sort(),
    )
  })

  it('grade and triage reflect adjusted score when checks are dismissed', () => {
    const snapshot = makeSnapshot({
      hasCI: false,
      hasLicense: false,
      hasContributing: false,
      lastCommitAt: null,
      lastReleaseAt: null,
      openPRs: 20,
      stars: 2,
    })

    const withoutDismissals = scoreRepo(snapshot)
    expect(['C', 'D', 'F']).toContain(withoutDismissals.grade)

    const allButSecurity = [
      ...QUALITY_CHECK_IDS,
      ...ACTIVITY_CHECK_IDS,
      ...COMMUNITY_CHECK_IDS,
    ]
    const withDismissals = scoreRepo(snapshot, new Set(allButSecurity))

    expect(withDismissals.pillars.quality).toBe(0)
    expect(withDismissals.pillars.activity).toBe(0)
    expect(withDismissals.pillars.community).toBe(0)
    expect(withDismissals.grade).toBe(
      withDismissals.score >= 80
        ? 'A'
        : withDismissals.score >= 65
          ? 'B'
          : withDismissals.score >= 50
            ? 'C'
            : withDismissals.score >= 35
              ? 'D'
              : 'F',
    )
  })

  it('dismissing all checks results in score 0 and grade F', () => {
    const snapshot = makeSnapshot()
    const result = scoreRepo(snapshot, new Set(ALL_CHECK_IDS))

    expect(result.score).toBe(0)
    expect(result.grade).toBe('F')
    expect(result.triage).toBe('critical')
    expect(Object.keys(result.checkResults)).toHaveLength(0)
    expect(Object.keys(result.results)).toHaveLength(0)
  })
})
