import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { commitFrequency } from './commit-frequency'
import { makeContext, makeRepo, daysAgoISO } from '../test-helpers'
import type { MetricSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return commitFrequency.evaluate(ctx) as MetricSignalResult
}

describe('commit-frequency', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('scores 1.0 for commits within 7 days', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(3) }) })
    expect(result.score).toBe(1.0)
  })

  it('scores 0.8 for commits 8-14 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(10) }) })
    expect(result.score).toBe(0.8)
  })

  it('scores 0.6 for commits 15-30 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(20) }) })
    expect(result.score).toBe(0.6)
  })

  it('scores 0.4 for commits 31-60 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(45) }) })
    expect(result.score).toBe(0.4)
  })

  it('scores 0.2 for commits 61-90 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(75) }) })
    expect(result.score).toBe(0.2)
  })

  it('scores 0 for commits over 90 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(120) }) })
    expect(result.score).toBe(0)
  })

  it('scores 0 with actionable when no commits', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: null }) })
    expect(result.score).toBe(0)
    expect(result.actionable).toBeTruthy()
  })

  it('provides actionable advice when score is low', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(45) }) })
    expect(result.actionable).toContain('inactive')
  })

  it('applies to all repos', () => {
    expect(commitFrequency.applies(makeRepo())).toBe(true)
  })

  it('returns mode metric', () => {
    const result = evaluate({ repo: makeRepo({ lastCommitAt: daysAgoISO(5) }) })
    expect(result.mode).toBe('metric')
  })
})
