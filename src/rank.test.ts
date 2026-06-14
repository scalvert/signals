import { describe, it, expect } from 'vitest'
import { buildAttentionItems } from './rank'
import type { RawRepo } from '@/lib/github/fetch-repos'

const NOW = new Date().toISOString()
const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

function makeRepo(overrides: Partial<RawRepo> & { name: string }): RawRepo {
  return {
    fullName: `acme/${overrides.name}`,
    description: null,
    url: `https://github.com/acme/${overrides.name}`,
    language: 'TypeScript',
    stars: 10,
    forks: 0,
    openIssues: 0,
    openPRs: 0,
    lastCommitAt: daysAgoIso(5),
    lastReleaseAt: null,
    hasCI: true,
    hasLicense: true,
    hasContributing: true,
    isPrivate: false,
    isFork: false,
    ...overrides,
  }
}

function rankOf(items: ReturnType<typeof buildAttentionItems>, repo: string, type: string): number {
  const item = items.find((i) => i.repo === repo && i.type === type)
  if (!item) throw new Error(`no ${type} item for ${repo}`)
  return item.rank
}

describe('ranking', () => {
  it('decays dormancy: a recently-dormant repo outranks an ancient one', () => {
    const recent = makeRepo({ name: 'recent', stars: 13, lastCommitAt: daysAgoIso(60) })
    const ancient = makeRepo({ name: 'ancient', stars: 13, lastCommitAt: daysAgoIso(3000) })
    const items = buildAttentionItems([recent, ancient], [], NOW)

    expect(rankOf(items, 'acme/recent', 'dormant-repo')).toBeGreaterThan(
      rankOf(items, 'acme/ancient', 'dormant-repo'),
    )
  })

  it('applies liveness: the same fixable gap ranks higher on a live repo than a stale one', () => {
    const live = makeRepo({ name: 'live', hasLicense: false, lastCommitAt: daysAgoIso(10) })
    const stale = makeRepo({ name: 'stale', hasLicense: false, lastCommitAt: daysAgoIso(800) })
    const items = buildAttentionItems([live, stale], [], NOW)

    expect(rankOf(items, 'acme/live', 'has-license')).toBeGreaterThan(
      rankOf(items, 'acme/stale', 'has-license'),
    )
  })

  it('surfaces actionable work on live repos above ancient graveyards', () => {
    const live = makeRepo({ name: 'live', stars: 27, hasLicense: false, lastCommitAt: daysAgoIso(5) })
    const graveyard = makeRepo({ name: 'graveyard', stars: 13, lastCommitAt: daysAgoIso(3000) })
    const items = buildAttentionItems([live, graveyard], [], NOW)

    expect(rankOf(items, 'acme/live', 'has-license')).toBeGreaterThan(
      rankOf(items, 'acme/graveyard', 'dormant-repo'),
    )
  })
})
