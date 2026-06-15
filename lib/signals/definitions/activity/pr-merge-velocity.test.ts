import { describe, it, expect } from 'vitest'
import { prMergeVelocity } from './pr-merge-velocity'
import { makeContext, makePR } from '../test-helpers'
import type { MetricSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return prMergeVelocity.evaluate(ctx) as MetricSignalResult
}

describe('pr-merge-velocity', () => {
  it('scores 1.0 when no open PRs', () => {
    const result = evaluate({ pullRequests: [] })
    expect(result.score).toBe(1.0)
  })

  it('scores 0.8 for 1-5 open human PRs', () => {
    const prs = Array.from({ length: 3 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}` }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result.score).toBe(0.8)
  })

  it('scores 0.6 for 6-15 open human PRs', () => {
    const prs = Array.from({ length: 10 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}` }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result.score).toBe(0.6)
  })

  it('scores 0.4 for 16-30 open human PRs', () => {
    const prs = Array.from({ length: 20 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}` }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result.score).toBe(0.4)
  })

  it('scores 0.2 for 30+ open human PRs', () => {
    const prs = Array.from({ length: 35 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}` }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result.score).toBe(0.2)
  })

  it('excludes bot PRs from the count', () => {
    const prs = [
      makePR({ number: 1, authorLogin: 'human-user' }),
      makePR({ number: 2, authorLogin: 'dependabot[bot]', isBot: true }),
      makePR({ number: 3, authorLogin: 'renovate[bot]', isBot: true }),
    ]
    const result = evaluate({ pullRequests: prs })
    expect(result.score).toBe(0.8)
    expect(result.label).toContain('1 open human PR')
  })

  it('scores 1.0 when all PRs are from bots', () => {
    const prs = [
      makePR({ number: 1, authorLogin: 'dependabot[bot]', isBot: true }),
      makePR({ number: 2, authorLogin: 'renovate[bot]', isBot: true }),
    ]
    const result = evaluate({ pullRequests: prs })
    expect(result.score).toBe(1.0)
    expect(result.label).toContain('No open human PRs')
  })

  it('includes bot exclusion count in evidence', () => {
    const prs = [
      makePR({ number: 1, authorLogin: 'user' }),
      makePR({ number: 2, authorLogin: 'dependabot[bot]', isBot: true }),
    ]
    const result = evaluate({ pullRequests: prs })
    expect(result.evidence).toContain('botPRsExcluded: 1')
  })

  it('provides actionable advice when score is low', () => {
    const prs = Array.from({ length: 20 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: `user-${i}` }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result.actionable).toContain('review sprint')
  })
})
