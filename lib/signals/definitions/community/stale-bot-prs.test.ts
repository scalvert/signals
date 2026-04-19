import { describe, it, expect } from 'vitest'
import { staleBotPRs } from './stale-bot-prs'
import { makeContext, makePR } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return staleBotPRs.evaluate(ctx) as EventSignalResult | null
}

describe('stale-bot-prs', () => {
  it('fires when 5+ bot PRs pile up', () => {
    const prs = Array.from({ length: 6 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: 'dependabot[bot]' }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
    expect(result!.metadata.botPRCount).toBe(6)
  })

  it('does not fire with fewer than 5 bot PRs', () => {
    const prs = Array.from({ length: 4 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: 'dependabot[bot]' }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result).toBeNull()
  })

  it('only counts bot PRs, not human PRs', () => {
    const prs = [
      ...Array.from({ length: 3 }, (_, i) =>
        makePR({ number: i + 1, authorLogin: 'dependabot[bot]' }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePR({ number: i + 10, authorLogin: `human-${i}` }),
      ),
    ]
    const result = evaluate({ pullRequests: prs })
    expect(result).toBeNull()
  })

  it('excludes draft bot PRs', () => {
    const prs = Array.from({ length: 6 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: 'dependabot[bot]', isDraft: true }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result).toBeNull()
  })

  it('identifies unique bot authors', () => {
    const prs = [
      ...Array.from({ length: 3 }, (_, i) =>
        makePR({ number: i + 1, authorLogin: 'dependabot[bot]' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makePR({ number: i + 10, authorLogin: 'renovate[bot]' }),
      ),
    ]
    const result = evaluate({ pullRequests: prs })
    expect(result).not.toBeNull()
    expect(result!.metadata.bots).toEqual(
      expect.arrayContaining(['dependabot[bot]', 'renovate[bot]']),
    )
  })

  it('severity is always warning', () => {
    const prs = Array.from({ length: 10 }, (_, i) =>
      makePR({ number: i + 1, authorLogin: 'dependabot[bot]' }),
    )
    const result = evaluate({ pullRequests: prs })
    expect(result!.severity).toBe('warning')
  })

  it('has correct meta properties', () => {
    expect(staleBotPRs.meta.id).toBe('stale-bot-prs')
    expect(staleBotPRs.meta.fixable).toBe(true)
    expect(staleBotPRs.meta.dedupDays).toBe(14)
  })
})
