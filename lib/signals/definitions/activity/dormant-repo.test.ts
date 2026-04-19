import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dormantRepo } from './dormant-repo'
import { makeContext, makeRepo, daysAgoISO } from '../test-helpers'
import type { EventSignalResult } from '../../types'

function evaluate(overrides = {}) {
  const ctx = makeContext(overrides)
  return dormantRepo.evaluate(ctx) as EventSignalResult | null
}

describe('dormant-repo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires when repo has no commits in 30+ days', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(35) }),
    })
    expect(result).not.toBeNull()
    expect(result!.detected).toBe(true)
    expect(result!.metadata.daysSinceLastCommit).toBe(35)
  })

  it('does not fire when last commit is within 30 days', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(29) }),
    })
    expect(result).toBeNull()
  })

  it('fires at exactly 30 days', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(30) }),
    })
    expect(result).not.toBeNull()
  })

  it('does not apply when repo has zero stars', () => {
    expect(dormantRepo.applies(makeRepo({ stars: 0 }))).toBe(false)
  })

  it('does not apply when lastCommitAt is null', () => {
    expect(dormantRepo.applies(makeRepo({ lastCommitAt: null }))).toBe(false)
  })

  it('returns null when lastCommitAt is null', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: null, stars: 50 }),
    })
    expect(result).toBeNull()
  })

  it('sets severity to warning at 30-60 days', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(45) }),
    })
    expect(result!.severity).toBe('warning')
  })

  it('sets severity to critical at 60+ days', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(61) }),
    })
    expect(result!.severity).toBe('critical')
  })

  it('severity at exactly 60 days is warning', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(60) }),
    })
    expect(result!.severity).toBe('warning')
  })

  it('includes open issues and PRs in body', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(45), openIssues: 3, openPRs: 2 }),
    })
    expect(result!.body).toContain('3 open issues')
    expect(result!.body).toContain('2 open PRs')
  })

  it('suggests archiving when no open issues or PRs', () => {
    const result = evaluate({
      repo: makeRepo({ lastCommitAt: daysAgoISO(45), openIssues: 0, openPRs: 0 }),
    })
    expect(result!.body).toContain('maintenance notice or archiving')
  })

  it('includes correct metadata', () => {
    const repo = makeRepo({
      lastCommitAt: daysAgoISO(45),
      stars: 100,
      openIssues: 3,
      openPRs: 1,
    })
    const result = evaluate({ repo })
    expect(result!.metadata).toMatchObject({
      daysSinceLastCommit: 45,
      stars: 100,
      openIssues: 3,
      openPRs: 1,
    })
  })

  it('has correct meta properties', () => {
    expect(dormantRepo.meta.id).toBe('dormant-repo')
    expect(dormantRepo.meta.mode).toBe('event')
    expect(dormantRepo.meta.dedupDays).toBe(30)
    expect(dormantRepo.meta.suppressionKeywords).toContain('maintenance mode')
  })
})
