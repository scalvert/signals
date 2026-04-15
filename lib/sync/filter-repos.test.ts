import { describe, it, expect } from 'vitest'
import { filterReposBySourceSelection } from './engine'
import type { WorkspaceSource } from '@/types/workspace'

interface TestRepo {
  name: string
  fullName: string
  isFork: boolean
  isPrivate: boolean
}

function makeRepo(overrides: Partial<TestRepo> & { name: string; fullName: string }): TestRepo {
  return {
    isFork: false,
    isPrivate: false,
    ...overrides,
  }
}

function names(repos: TestRepo[]): string[] {
  return repos.map((r) => r.fullName).sort()
}

const orgRepos: TestRepo[] = [
  makeRepo({ name: 'alpha', fullName: 'acme/alpha' }),
  makeRepo({ name: 'beta', fullName: 'acme/beta' }),
  makeRepo({ name: 'gamma', fullName: 'acme/gamma', isFork: true }),
  makeRepo({ name: 'delta', fullName: 'acme/delta', isPrivate: true }),
  makeRepo({ name: 'epsilon', fullName: 'acme/epsilon', isPrivate: true, isFork: true }),
]

describe('filterReposBySourceSelection', () => {
  describe('mode: all (no filters)', () => {
    it('returns all repos for that source when no selection is set', () => {
      const sources: WorkspaceSource[] = [
        { type: 'org', value: 'acme' },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(names(orgRepos))
    })

    it('returns all repos when mode is all with empty selected array', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: [] },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(names(orgRepos))
    })
  })

  describe('mode: all with opt-out exclusions', () => {
    it('excludes repos in the selected array', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: ['alpha', 'beta'] },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(
        names(orgRepos.filter((r) => r.name !== 'alpha' && r.name !== 'beta')),
      )
    })
  })

  describe('mode: selected (opt-in)', () => {
    it('includes only repos in the selected array', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'selected', selected: ['alpha', 'gamma'] },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(['acme/alpha', 'acme/gamma'])
    })

    it('returns empty when selected list contains no matching repos', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'selected', selected: ['nonexistent'] },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(result).toHaveLength(0)
    })
  })

  describe('visibility filter', () => {
    it('visibility: public excludes private repos', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: [], visibility: 'public' },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      for (const repo of result) {
        expect(repo.isPrivate).toBe(false)
      }
      expect(result).toHaveLength(
        orgRepos.filter((r) => !r.isPrivate).length,
      )
    })

    it('visibility: private excludes public repos', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: [], visibility: 'private' },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      for (const repo of result) {
        expect(repo.isPrivate).toBe(true)
      }
      expect(result).toHaveLength(
        orgRepos.filter((r) => r.isPrivate).length,
      )
    })

    it('visibility: all includes everything', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: [], visibility: 'all' },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(names(orgRepos))
    })
  })

  describe('excludeForks filter', () => {
    it('excludeForks: true excludes forked repos', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: [], excludeForks: true },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      for (const repo of result) {
        expect(repo.isFork).toBe(false)
      }
      expect(result).toHaveLength(
        orgRepos.filter((r) => !r.isFork).length,
      )
    })

    it('excludeForks: false includes forked repos', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'all', selected: [], excludeForks: false },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(names(orgRepos))
    })
  })

  describe('combined filters', () => {
    it('visibility: public + excludeForks: true', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: {
            mode: 'all',
            selected: [],
            visibility: 'public',
            excludeForks: true,
          },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      const expected = orgRepos.filter((r) => !r.isPrivate && !r.isFork)
      expect(names(result)).toEqual(names(expected))
    })

    it('visibility: private + excludeForks: true', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: {
            mode: 'all',
            selected: [],
            visibility: 'private',
            excludeForks: true,
          },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      const expected = orgRepos.filter((r) => r.isPrivate && !r.isFork)
      expect(names(result)).toEqual(names(expected))
    })

    it('mode: selected + excludeForks filters within selected set', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: {
            mode: 'selected',
            selected: ['alpha', 'gamma'],
            excludeForks: true,
          },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(['acme/alpha'])
    })

    it('mode: all opt-out + visibility: public', () => {
      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: {
            mode: 'all',
            selected: ['alpha'],
            visibility: 'public',
          },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      const expected = orgRepos.filter(
        (r) => !r.isPrivate && r.name !== 'alpha',
      )
      expect(names(result)).toEqual(names(expected))
    })
  })

  describe('multiple sources', () => {
    it('repos from different orgs are filtered independently', () => {
      const otherRepos: TestRepo[] = [
        makeRepo({ name: 'zeta', fullName: 'other/zeta' }),
        makeRepo({ name: 'eta', fullName: 'other/eta', isPrivate: true }),
      ]
      const allRepos = [...orgRepos, ...otherRepos]

      const sources: WorkspaceSource[] = [
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'selected', selected: ['alpha'] },
        },
        {
          type: 'org',
          value: 'other',
          repos: { mode: 'all', selected: [], visibility: 'public' },
        },
      ]

      const result = filterReposBySourceSelection(allRepos, sources)
      expect(names(result)).toEqual(['acme/alpha', 'other/zeta'])
    })
  })

  describe('type: repo sources', () => {
    it('repo sources are always included by fullName', () => {
      const sources: WorkspaceSource[] = [
        { type: 'repo', value: 'acme/alpha' },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(['acme/alpha'])
    })

    it('repo sources mixed with org sources', () => {
      const sources: WorkspaceSource[] = [
        { type: 'repo', value: 'acme/alpha' },
        {
          type: 'org',
          value: 'acme',
          repos: { mode: 'selected', selected: ['beta'] },
        },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(names(result)).toEqual(['acme/alpha', 'acme/beta'])
    })

    it('repo source for non-existent repo returns empty', () => {
      const sources: WorkspaceSource[] = [
        { type: 'repo', value: 'acme/nonexistent' },
      ]
      const result = filterReposBySourceSelection(orgRepos, sources)
      expect(result).toHaveLength(0)
    })
  })

  describe('user type sources', () => {
    it('user sources filter the same as org sources', () => {
      const userRepos: TestRepo[] = [
        makeRepo({ name: 'my-repo', fullName: 'jdoe/my-repo' }),
        makeRepo({ name: 'my-fork', fullName: 'jdoe/my-fork', isFork: true }),
      ]
      const sources: WorkspaceSource[] = [
        {
          type: 'user',
          value: 'jdoe',
          repos: { mode: 'all', selected: [], excludeForks: true },
        },
      ]
      const result = filterReposBySourceSelection(userRepos, sources)
      expect(names(result)).toEqual(['jdoe/my-repo'])
    })
  })
})
