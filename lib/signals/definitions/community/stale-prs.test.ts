import { describe, it, expect } from 'vitest'
import { stalePRs } from './stale-prs'
import { makeContext, makeRepo, makePR, makeSignal } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return stalePRs.evaluate(ctx) as EventSignalResult | null
}

describe('stale-prs', () => {
  it('fires for external human PRs stale 7+ days', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: true, daysSinceUpdate: 8 })],
    })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
  })

  it('does not fire for external PRs stale less than 7 days', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: true, daysSinceUpdate: 6 })],
    })
    expect(result).toBeNull()
  })

  it('fires for internal human PRs stale 14+ days', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: false, daysSinceUpdate: 15 })],
    })
    expect(result).not.toBeNull()
  })

  it('does not fire for internal PRs stale less than 14 days', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: false, daysSinceUpdate: 13 })],
    })
    expect(result).toBeNull()
  })

  it('excludes draft PRs', () => {
    const result = evaluate({
      pullRequests: [makePR({ isDraft: true, isExternal: true, daysSinceUpdate: 30 })],
    })
    expect(result).toBeNull()
  })

  it('excludes bot PRs (dependabot)', () => {
    const result = evaluate({
      pullRequests: [
        makePR({ authorLogin: 'dependabot[bot]', isExternal: true, daysSinceUpdate: 30 }),
      ],
    })
    expect(result).toBeNull()
  })

  it('excludes bot PRs (renovate)', () => {
    const result = evaluate({
      pullRequests: [
        makePR({ authorLogin: 'renovate[bot]', isExternal: true, daysSinceUpdate: 30 }),
      ],
    })
    expect(result).toBeNull()
  })

  it('counts only human PRs in the signal', () => {
    const result = evaluate({
      pullRequests: [
        makePR({ number: 1, authorLogin: 'human', isExternal: true, daysSinceUpdate: 10 }),
        makePR({ number: 2, authorLogin: 'dependabot[bot]', isExternal: true, daysSinceUpdate: 30 }),
      ],
    })
    expect(result).not.toBeNull()
    expect(result!.title).toContain('1 stale PR')
    expect(result!.metadata.prNumbers).toEqual([1])
  })

  it('sets severity to critical for external PRs stale > 14 days', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: true, daysSinceUpdate: 15 })],
    })
    expect(result!.severity).toBe('critical')
  })

  it('sets severity to warning for external PRs stale <= 14 days', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: true, daysSinceUpdate: 10 })],
    })
    expect(result!.severity).toBe('warning')
  })

  it('deduplicates when existing signal covers same PR numbers', () => {
    const result = evaluate({
      pullRequests: [makePR({ number: 42, isExternal: true, daysSinceUpdate: 10 })],
      existingSignals: [
        makeSignal({
          type: 'pr-stale',
          repoFullName: 'org/test-repo',
          metadata: { prNumbers: [42] },
        }),
      ],
    })
    expect(result).toBeNull()
  })

  it('does not deduplicate when PR numbers differ', () => {
    const result = evaluate({
      pullRequests: [makePR({ number: 99, isExternal: true, daysSinceUpdate: 10 })],
      existingSignals: [
        makeSignal({
          type: 'pr-stale',
          repoFullName: 'org/test-repo',
          metadata: { prNumbers: [42] },
        }),
      ],
    })
    expect(result).not.toBeNull()
  })

  it('body includes PR details', () => {
    const result = evaluate({
      pullRequests: [
        makePR({ number: 42, authorLogin: 'alice', isExternal: true, daysSinceUpdate: 10 }),
      ],
    })
    expect(result!.body).toContain('#42')
    expect(result!.body).toContain('@alice')
    expect(result!.body).toContain('10d')
  })

  it('boundary: external PR at exactly 7 days fires', () => {
    const result = evaluate({
      pullRequests: [makePR({ isExternal: true, daysSinceUpdate: 7 })],
    })
    expect(result).not.toBeNull()
  })

  it('has correct meta properties', () => {
    expect(stalePRs.meta.id).toBe('stale-prs')
    expect(stalePRs.meta.fixable).toBe(true)
    expect(stalePRs.meta.suppressionKeywords).toContain('slow review')
  })
})
