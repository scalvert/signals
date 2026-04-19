import { describe, it, expect } from 'vitest'
import { hasContributing } from './has-contributing'
import { makeContext, makeRepo } from '../test-helpers'
import type { MetricSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return hasContributing.evaluate(ctx) as MetricSignalResult
}

describe('has-contributing', () => {
  it('scores 1 when CONTRIBUTING.md present', () => {
    const result = evaluate({ repo: makeRepo({ hasContributing: true }) })
    expect(result.score).toBe(1)
    expect(result.label).toContain('present')
  })

  it('scores 0 when CONTRIBUTING.md missing', () => {
    const result = evaluate({ repo: makeRepo({ hasContributing: false }) })
    expect(result.score).toBe(0)
    expect(result.actionable).toContain('CONTRIBUTING.md')
  })

  it('applies to all repos', () => {
    expect(hasContributing.applies(makeRepo())).toBe(true)
  })

  it('is fixable', () => {
    expect(hasContributing.meta.fixable).toBe(true)
  })
})
