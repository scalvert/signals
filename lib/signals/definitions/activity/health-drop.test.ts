import { describe, it, expect } from 'vitest'
import { healthDrop } from './health-drop'
import { makeContext, makeRepo } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return healthDrop.evaluate(ctx) as EventSignalResult | null
}

describe('health-drop', () => {
  it('fires when score drops 4+ points', () => {
    const result = evaluate({
      repo: makeRepo({ score: 70 }),
      previousRepo: makeRepo({ score: 75 }),
    })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
    expect(result!.metadata.drop).toBe(5)
  })

  it('does not fire when drop is less than 4', () => {
    const result = evaluate({
      repo: makeRepo({ score: 73 }),
      previousRepo: makeRepo({ score: 75 }),
    })
    expect(result).toBeNull()
  })

  it('does not fire without previousRepo', () => {
    const result = evaluate({
      repo: makeRepo({ score: 70 }),
    })
    expect(result).toBeNull()
  })

  it('sets severity to warning for drops 4-8', () => {
    const result = evaluate({
      repo: makeRepo({ score: 70 }),
      previousRepo: makeRepo({ score: 76 }),
    })
    expect(result!.severity).toBe('warning')
  })

  it('sets severity to critical for drops over 8', () => {
    const result = evaluate({
      repo: makeRepo({ score: 60 }),
      previousRepo: makeRepo({ score: 75 }),
    })
    expect(result!.severity).toBe('critical')
  })

  it('includes declining pillars in body', () => {
    const result = evaluate({
      repo: makeRepo({
        score: 60,
        pillars: { activity: 10, community: 15, quality: 25, security: 10 },
      }),
      previousRepo: makeRepo({
        score: 75,
        pillars: { activity: 20, community: 15, quality: 25, security: 15 },
      }),
    })
    expect(result!.body).toContain('activity')
    expect(result!.body).toContain('security')
  })

  it('includes score metadata', () => {
    const result = evaluate({
      repo: makeRepo({ score: 65 }),
      previousRepo: makeRepo({ score: 75 }),
    })
    expect(result!.metadata).toMatchObject({
      scoreBefore: 75,
      scoreAfter: 65,
      drop: 10,
    })
  })

  it('has correct meta properties', () => {
    expect(healthDrop.meta.id).toBe('health-drop')
    expect(healthDrop.meta.mode).toBe('event')
    expect(healthDrop.meta.dedupDays).toBe(7)
  })
})
