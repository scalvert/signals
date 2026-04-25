import { describe, it, expect } from 'vitest'
import { newContributor } from './new-contributor'
import { makeContext, makePR, makeSignal } from '../test-helpers'
import type { EventSignalResult, SignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return newContributor.evaluate(ctx) as SignalResult[] | null
}

describe('new-contributor', () => {
  it('fires for first-time contributors', () => {
    const results = evaluate({
      pullRequests: [
        makePR({ authorLogin: 'newbie', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' }),
      ],
    })
    expect(results).toHaveLength(1)
    const result = results![0] as EventSignalResult
    expect(result.detected).toBe(true)
    expect(result.body).toContain('@newbie')
  })

  it('fires for FIRST_TIMER association', () => {
    const results = evaluate({
      pullRequests: [
        makePR({ authorLogin: 'newbie', authorAssociation: 'FIRST_TIMER' }),
      ],
    })
    expect(results).toHaveLength(1)
  })

  it('does not fire for regular contributors', () => {
    const results = evaluate({
      pullRequests: [
        makePR({ authorLogin: 'regular', authorAssociation: 'CONTRIBUTOR' }),
      ],
    })
    expect(results).toBeNull()
  })

  it('excludes bot authors', () => {
    const results = evaluate({
      pullRequests: [
        makePR({
          authorLogin: 'dependabot[bot]',
          isBot: true,
          authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
        }),
      ],
    })
    expect(results).toBeNull()
  })

  it('deduplicates by author per repo', () => {
    const results = evaluate({
      pullRequests: [
        makePR({ authorLogin: 'newbie', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' }),
      ],
      existingSignals: [
        makeSignal({
          type: 'new-contributor',
          repoFullName: 'org/test-repo',
          metadata: { authorLogin: 'newbie' },
        }),
      ],
    })
    expect(results).toBeNull()
  })

  it('returns multiple results for multiple new contributors', () => {
    const results = evaluate({
      pullRequests: [
        makePR({ number: 1, authorLogin: 'alice', authorAssociation: 'FIRST_TIME_CONTRIBUTOR' }),
        makePR({ number: 2, authorLogin: 'bob', authorAssociation: 'FIRST_TIMER' }),
      ],
    })
    expect(results).toHaveLength(2)
  })

  it('has correct meta properties', () => {
    expect(newContributor.meta.id).toBe('new-contributor')
    expect(newContributor.meta.fixable).toBe(true)
    expect(newContributor.meta.mode).toBe('event')
  })
})
