import { describe, it, expect } from 'vitest'
import { issueFlood } from './issue-flood'
import { makeContext, makeRepo } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return issueFlood.evaluate(ctx) as EventSignalResult | null
}

describe('issue-flood', () => {
  it('fires when 5+ new issues and ratio >= 1.5x', () => {
    const result = evaluate({
      repo: makeRepo({ openIssues: 15 }),
      previousRepo: makeRepo({ openIssues: 10 }),
    })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
  })

  it('does not fire with fewer than 5 new issues', () => {
    const result = evaluate({
      repo: makeRepo({ openIssues: 14 }),
      previousRepo: makeRepo({ openIssues: 10 }),
    })
    expect(result).toBeNull()
  })

  it('does not fire when ratio is below 1.5x', () => {
    const result = evaluate({
      repo: makeRepo({ openIssues: 105 }),
      previousRepo: makeRepo({ openIssues: 100 }),
    })
    expect(result).toBeNull()
  })

  it('does not fire without previousRepo', () => {
    const result = evaluate({
      repo: makeRepo({ openIssues: 20 }),
    })
    expect(result).toBeNull()
  })

  it('includes correct metadata', () => {
    const result = evaluate({
      repo: makeRepo({ openIssues: 20 }),
      previousRepo: makeRepo({ openIssues: 10 }),
    })
    expect(result!.metadata).toMatchObject({
      newCount: 10,
      previousTotal: 10,
      currentTotal: 20,
      ratio: 2,
    })
  })

  it('handles zero previous issues (uses delta as ratio)', () => {
    const result = evaluate({
      repo: makeRepo({ openIssues: 10 }),
      previousRepo: makeRepo({ openIssues: 0 }),
    })
    expect(result).not.toBeNull()
    expect(result!.metadata.ratio).toBe(10)
  })

  it('has correct meta properties', () => {
    expect(issueFlood.meta.id).toBe('issue-flood')
    expect(issueFlood.meta.mode).toBe('event')
    expect(issueFlood.meta.dedupDays).toBe(7)
  })
})
