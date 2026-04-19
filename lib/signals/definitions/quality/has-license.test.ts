import { describe, it, expect } from 'vitest'
import { hasLicense } from './has-license'
import { makeContext, makeRepo } from '../test-helpers'
import type { MetricSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return hasLicense.evaluate(ctx) as MetricSignalResult
}

describe('has-license', () => {
  it('scores 1 when LICENSE present', () => {
    const result = evaluate({ repo: makeRepo({ hasLicense: true }) })
    expect(result.score).toBe(1)
    expect(result.label).toContain('present')
  })

  it('scores 0 when LICENSE missing', () => {
    const result = evaluate({ repo: makeRepo({ hasLicense: false }) })
    expect(result.score).toBe(0)
    expect(result.actionable).toContain('LICENSE')
  })

  it('applies to all repos', () => {
    expect(hasLicense.applies(makeRepo())).toBe(true)
  })

  it('is fixable', () => {
    expect(hasLicense.meta.fixable).toBe(true)
  })
})
