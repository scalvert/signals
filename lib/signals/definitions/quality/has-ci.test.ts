import { describe, it, expect } from 'vitest'
import { hasCI } from './has-ci'
import { makeContext, makeRepo } from '../test-helpers'
import type { MetricSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return hasCI.evaluate(ctx) as MetricSignalResult
}

describe('has-ci', () => {
  it('scores 1 when CI configured', () => {
    const result = evaluate({ repo: makeRepo({ hasCI: true }) })
    expect(result.score).toBe(1)
    expect(result.label).toContain('workflows found')
  })

  it('scores 0 when CI missing', () => {
    const result = evaluate({ repo: makeRepo({ hasCI: false }) })
    expect(result.score).toBe(0)
    expect(result.actionable).toContain('workflow')
  })

  it('applies to all repos', () => {
    expect(hasCI.applies(makeRepo())).toBe(true)
  })

  it('is fixable', () => {
    expect(hasCI.meta.fixable).toBe(true)
  })
})
