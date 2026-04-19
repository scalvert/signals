import { describe, it, expect } from 'vitest'
import { starSpike } from './star-spike'
import { makeContext, makeRepo } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return starSpike.evaluate(ctx) as EventSignalResult | null
}

describe('star-spike', () => {
  it('fires when delta >= 5 and ratio >= 3x', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 20 }),
      previousRepo: makeRepo({ stars: 5 }),
    })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
  })

  it('fires when delta >= 20 regardless of ratio', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 120 }),
      previousRepo: makeRepo({ stars: 100 }),
    })
    expect(result).not.toBeNull()
  })

  it('does not fire when delta < 5', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 54 }),
      previousRepo: makeRepo({ stars: 50 }),
    })
    expect(result).toBeNull()
  })

  it('does not fire when ratio < 3x and delta < 20', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 55 }),
      previousRepo: makeRepo({ stars: 50 }),
    })
    expect(result).toBeNull()
  })

  it('does not fire without previousRepo', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 100 }),
    })
    expect(result).toBeNull()
  })

  it('severity is info for delta < 20', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 15 }),
      previousRepo: makeRepo({ stars: 3 }),
    })
    expect(result!.severity).toBe('info')
  })

  it('severity is warning for delta >= 20', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 125 }),
      previousRepo: makeRepo({ stars: 100 }),
    })
    expect(result!.severity).toBe('warning')
  })

  it('includes correct metadata', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 25 }),
      previousRepo: makeRepo({ stars: 5 }),
    })
    expect(result!.metadata).toMatchObject({
      delta: 20,
      previous: 5,
      current: 25,
    })
  })

  it('has correct meta properties', () => {
    expect(starSpike.meta.id).toBe('star-spike')
    expect(starSpike.meta.dedupDays).toBe(1)
  })
})
