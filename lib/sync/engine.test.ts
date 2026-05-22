import { describe, expect, it } from 'vitest'
import { filterReposForWorkspace } from './engine'

const repos = [
  { name: 'core', fullName: 'org/core', isFork: false, isPrivate: false },
  { name: 'private', fullName: 'org/private', isFork: false, isPrivate: true },
  { name: 'fork', fullName: 'org/fork', isFork: true, isPrivate: false },
  { name: 'other', fullName: 'other/other', isFork: false, isPrivate: false },
]

describe('filterReposForWorkspace', () => {
  it('applies source selection and excluded repos', () => {
    const filtered = filterReposForWorkspace(
      repos,
      [
        {
          type: 'org',
          value: 'org',
          repos: {
            mode: 'all',
            selected: [],
            visibility: 'all',
            excludeForks: true,
          },
        },
      ],
      ['org/private'],
    )

    expect(filtered.map((repo) => repo.fullName)).toEqual(['org/core'])
  })
})
