import { describe, it, expect } from 'vitest'
import { shouldSuppressSignal } from './context-match'

describe('shouldSuppressSignal', () => {
  it('returns true when context contains a matching keyword', () => {
    expect(shouldSuppressSignal('dormant', 'This repo has low cadence updates')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(shouldSuppressSignal('dormant', 'LOW CADENCE expected')).toBe(true)
  })

  it('returns false when context has no matching keywords', () => {
    expect(shouldSuppressSignal('dormant', 'This repo is important')).toBe(false)
  })

  it('returns false when context is empty', () => {
    expect(shouldSuppressSignal('dormant', '')).toBe(false)
  })

  it('matches health-drop keywords', () => {
    expect(shouldSuppressSignal('health-drop', 'Expected decline during migration')).toBe(true)
  })

  it('matches pr-stale keywords', () => {
    expect(shouldSuppressSignal('pr-stale', 'This repo has long-lived PRs by design')).toBe(true)
  })

  it('returns false for signal types with no suppression rules', () => {
    expect(shouldSuppressSignal('star-spike', 'low cadence')).toBe(false)
    expect(shouldSuppressSignal('milestone', 'stable')).toBe(false)
  })
})
