import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { releaseCadence } from './release-cadence'
import { makeContext, makeRepo, daysAgoISO } from '../test-helpers'
import type { MetricSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return releaseCadence.evaluate(ctx) as MetricSignalResult | null
}

describe('release-cadence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not apply to repos that have never released', () => {
    expect(releaseCadence.applies(makeRepo({ lastReleaseAt: null }))).toBe(false)
  })

  it('applies to repos with a release', () => {
    expect(releaseCadence.applies(makeRepo({ lastReleaseAt: daysAgoISO(10) }))).toBe(true)
  })

  it('returns null when lastReleaseAt is null', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: null }) })
    expect(result).toBeNull()
  })

  it('scores 1.0 for releases within 30 days', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: daysAgoISO(15) }) })
    expect(result!.score).toBe(1.0)
  })

  it('scores 0.8 for releases 31-60 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: daysAgoISO(45) }) })
    expect(result!.score).toBe(0.8)
  })

  it('scores 0.6 for releases 61-90 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: daysAgoISO(75) }) })
    expect(result!.score).toBe(0.6)
  })

  it('scores 0.3 for releases 91-180 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: daysAgoISO(120) }) })
    expect(result!.score).toBe(0.3)
  })

  it('scores 0.1 for releases over 180 days ago', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: daysAgoISO(200) }) })
    expect(result!.score).toBe(0.1)
  })

  it('provides actionable advice when score is low', () => {
    const result = evaluate({ repo: makeRepo({ lastReleaseAt: daysAgoISO(120) }) })
    expect(result!.actionable).toContain('release')
  })
})
