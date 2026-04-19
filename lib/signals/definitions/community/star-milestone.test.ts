import { describe, it, expect } from 'vitest'
import { starMilestone } from './star-milestone'
import { makeContext, makeRepo, makeSignal } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return starMilestone.evaluate(ctx) as EventSignalResult | null
}

describe('star-milestone', () => {
  it('fires when crossing a milestone', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 110 }),
      previousRepo: makeRepo({ stars: 95 }),
    })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
    expect(result!.metadata.milestone).toBe(100)
  })

  it('picks the highest crossed milestone', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 260 }),
      previousRepo: makeRepo({ stars: 45 }),
    })
    expect(result!.metadata.milestone).toBe(250)
  })

  it('does not fire when no milestone crossed', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 95 }),
      previousRepo: makeRepo({ stars: 90 }),
    })
    expect(result).toBeNull()
  })

  it('does not fire without previousRepo', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 100 }),
    })
    expect(result).toBeNull()
  })

  it('deduplicates by milestone value', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 110 }),
      previousRepo: makeRepo({ stars: 95 }),
      existingSignals: [
        makeSignal({
          type: 'milestone',
          repoFullName: 'org/test-repo',
          metadata: { milestone: 100 },
        }),
      ],
    })
    expect(result).toBeNull()
  })

  it('does not deduplicate different milestones', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 260 }),
      previousRepo: makeRepo({ stars: 95 }),
      existingSignals: [
        makeSignal({
          type: 'milestone',
          repoFullName: 'org/test-repo',
          metadata: { milestone: 100 },
        }),
      ],
    })
    expect(result).not.toBeNull()
    expect(result!.metadata.milestone).toBe(250)
  })

  it('formats large milestones with k suffix', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 1050 }),
      previousRepo: makeRepo({ stars: 950 }),
    })
    expect(result!.title).toContain('1k stars')
  })

  it('severity is always info', () => {
    const result = evaluate({
      repo: makeRepo({ stars: 110 }),
      previousRepo: makeRepo({ stars: 95 }),
    })
    expect(result!.severity).toBe('info')
  })

  it('has correct meta properties', () => {
    expect(starMilestone.meta.id).toBe('star-milestone')
    expect(starMilestone.meta.mode).toBe('event')
    expect(starMilestone.meta.fixable).toBe(false)
  })
})
