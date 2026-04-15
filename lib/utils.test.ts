import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cn,
  formatRelativeDate,
  slugify,
  gradeFromScore,
  triageFromGrade,
} from './utils'

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
    expect(cn('base', true && 'active')).toBe('base active')
  })

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })
})

describe('formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "today" for the current date', () => {
    expect(formatRelativeDate('2025-06-15T10:00:00Z')).toBe('today')
  })

  it('returns "1d ago" for yesterday', () => {
    expect(formatRelativeDate('2025-06-14T12:00:00Z')).toBe('1d ago')
  })

  it('returns days ago for dates within 30 days', () => {
    expect(formatRelativeDate('2025-06-10T12:00:00Z')).toBe('5d ago')
    expect(formatRelativeDate('2025-05-17T12:00:00Z')).toBe('29d ago')
  })

  it('returns months ago for dates between 30 and 365 days', () => {
    expect(formatRelativeDate('2025-05-15T12:00:00Z')).toBe('1mo ago')
    expect(formatRelativeDate('2025-03-15T12:00:00Z')).toBe('3mo ago')
    expect(formatRelativeDate('2024-08-15T12:00:00Z')).toBe('10mo ago')
  })

  it('returns years ago for dates over 365 days', () => {
    expect(formatRelativeDate('2024-06-14T12:00:00Z')).toBe('1y ago')
    expect(formatRelativeDate('2023-06-15T12:00:00Z')).toBe('2y ago')
  })
})

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('Hello')).toBe('hello')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(slugify('hello@world!')).toBe('hello-world')
  })

  it('collapses consecutive non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world')
    expect(slugify('a--b')).toBe('a-b')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
    expect(slugify('!hello!')).toBe('hello')
  })

  it('handles already-valid slugs', () => {
    expect(slugify('already-valid')).toBe('already-valid')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })
})

describe('gradeFromScore', () => {
  it('returns A for scores >= 80', () => {
    expect(gradeFromScore(80)).toBe('A')
    expect(gradeFromScore(100)).toBe('A')
    expect(gradeFromScore(95)).toBe('A')
  })

  it('returns B for scores >= 65 and < 80', () => {
    expect(gradeFromScore(65)).toBe('B')
    expect(gradeFromScore(79)).toBe('B')
    expect(gradeFromScore(70)).toBe('B')
  })

  it('returns C for scores >= 50 and < 65', () => {
    expect(gradeFromScore(50)).toBe('C')
    expect(gradeFromScore(64)).toBe('C')
    expect(gradeFromScore(55)).toBe('C')
  })

  it('returns D for scores >= 35 and < 50', () => {
    expect(gradeFromScore(35)).toBe('D')
    expect(gradeFromScore(49)).toBe('D')
    expect(gradeFromScore(42)).toBe('D')
  })

  it('returns F for scores < 35', () => {
    expect(gradeFromScore(34)).toBe('F')
    expect(gradeFromScore(0)).toBe('F')
    expect(gradeFromScore(10)).toBe('F')
  })

  it('handles exact boundary values', () => {
    expect(gradeFromScore(80)).toBe('A')
    expect(gradeFromScore(79)).toBe('B')
    expect(gradeFromScore(65)).toBe('B')
    expect(gradeFromScore(64)).toBe('C')
    expect(gradeFromScore(50)).toBe('C')
    expect(gradeFromScore(49)).toBe('D')
    expect(gradeFromScore(35)).toBe('D')
    expect(gradeFromScore(34)).toBe('F')
  })
})

describe('triageFromGrade', () => {
  it('returns "healthy" for grade A', () => {
    expect(triageFromGrade('A')).toBe('healthy')
  })

  it('returns "healthy" for grade B', () => {
    expect(triageFromGrade('B')).toBe('healthy')
  })

  it('returns "watch" for grade C', () => {
    expect(triageFromGrade('C')).toBe('watch')
  })

  it('returns "critical" for grade D', () => {
    expect(triageFromGrade('D')).toBe('critical')
  })

  it('returns "critical" for grade F', () => {
    expect(triageFromGrade('F')).toBe('critical')
  })
})
