import type { WorkspaceSource } from '@/types/workspace'

interface FilterableRepo {
  name: string
  fullName: string
  isFork: boolean
  isPrivate: boolean
}

export function filterReposBySourceSelection<T extends FilterableRepo>(
  repos: T[],
  sources: WorkspaceSource[],
): T[] {
  const included = new Set<string>()

  for (const source of sources) {
    if (source.type === 'repo') {
      included.add(source.value)
      continue
    }

    const prefix = source.value + '/'
    const sourceRepos = repos.filter((r) => r.fullName.startsWith(prefix))
    const selection = source.repos

    for (const repo of sourceRepos) {
      if (selection?.visibility === 'public' && repo.isPrivate) continue
      if (selection?.visibility === 'private' && !repo.isPrivate) continue
      if (selection?.excludeForks && repo.isFork) continue

      if (selection?.mode === 'selected') {
        if (!selection.selected.includes(repo.name)) continue
      } else if (selection?.mode === 'all' && selection.selected.length > 0) {
        if (selection.selected.includes(repo.name)) continue
      }

      included.add(repo.fullName)
    }
  }

  return repos.filter((r) => included.has(r.fullName))
}

export function filterReposForWorkspace<T extends FilterableRepo>(
  repos: T[],
  sources: WorkspaceSource[],
  excludedRepos: string[],
): T[] {
  const excluded = new Set(excludedRepos)
  return filterReposBySourceSelection(repos, sources).filter(
    (repo) => !excluded.has(repo.fullName),
  )
}
