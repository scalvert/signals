'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter'
import type { SourceRepoSelection } from '@/types/workspace'

interface PickerRepo {
  name: string
  fullName: string
  stars: number
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
}

interface SourceRepoSelectorProps {
  owner: string
  type: 'org' | 'user'
  selection: SourceRepoSelection
  onChange: (selection: SourceRepoSelection) => void
}

export function SourceRepoSelector({ owner, type, selection, onChange }: SourceRepoSelectorProps) {
  const [repos, setRepos] = useState<PickerRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<Set<string>>(new Set())
  const [forkFilter, setForkFilter] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/github/repos?owner=${encodeURIComponent(owner)}&type=${type}`)
      .then((r) => r.json())
      .then((data) => {
        setRepos(data.repos ?? [])
        setLoading(false)
      })
  }, [owner, type])

  const filteredRepos = useMemo(() => {
    let result = repos
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) => r.name.toLowerCase().includes(q))
    }
    if (visibilityFilter.size > 0) {
      result = result.filter((r) => {
        if (visibilityFilter.has('public') && !r.isPrivate) return true
        if (visibilityFilter.has('private') && r.isPrivate) return true
        if (visibilityFilter.has('archived') && r.isArchived) return true
        return false
      })
    }
    if (forkFilter.size > 0) {
      result = result.filter((r) => {
        if (forkFilter.has('fork') && r.isFork) return true
        if (forkFilter.has('owned') && !r.isFork) return true
        return false
      })
    }
    return result.sort((a, b) => b.stars - a.stars)
  }, [repos, search, visibilityFilter, forkFilter])

  const selectedSet = useMemo(() => new Set(selection.selected), [selection.selected])

  function isRepoSelected(name: string): boolean {
    if (selection.mode === 'all') {
      return !selectedSet.has(name)
    }
    return selectedSet.has(name)
  }

  function toggleRepo(name: string) {
    const newSelected = new Set(selectedSet)
    if (selection.mode === 'all') {
      if (newSelected.has(name)) {
        newSelected.delete(name)
      } else {
        newSelected.add(name)
      }
    } else {
      if (newSelected.has(name)) {
        newSelected.delete(name)
      } else {
        newSelected.add(name)
      }
    }
    onChange({ ...selection, selected: Array.from(newSelected) })
  }

  function selectAll() {
    onChange({ ...selection, mode: 'all', selected: [] })
  }

  function clearAll() {
    onChange({ ...selection, mode: 'selected', selected: [] })
  }

  const selectedCount = selection.mode === 'all'
    ? repos.length - selectedSet.size
    : selectedSet.size

  const visibilityOptions = useMemo(() => {
    const counts = { public: 0, private: 0, archived: 0 }
    for (const r of repos) {
      if (r.isArchived) counts.archived++
      else if (r.isPrivate) counts.private++
      else counts.public++
    }
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, count }))
  }, [repos])

  const forkOptions = useMemo(() => {
    const counts = { owned: 0, fork: 0 }
    for (const r of repos) {
      if (r.isFork) counts.fork++
      else counts.owned++
    }
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, count }))
  }, [repos])

  if (loading) {
    return <div className="p-3 text-[11px] text-muted-foreground">Loading repos...</div>
  }

  return (
    <div className="p-3 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold">{selectedCount} of {repos.length} selected</span>
          <button type="button" onClick={selectAll} className="text-[11px] font-medium text-primary hover:underline">Select all</button>
          <span className="text-[11px] text-muted-foreground">&middot;</span>
          <button type="button" onClick={clearAll} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos..."
            className="h-7 w-full pl-7 pr-2 text-[11px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <MultiSelectFilter label="Visibility" options={visibilityOptions} selected={visibilityFilter} onChange={setVisibilityFilter} />
        {type === 'user' && (
          <MultiSelectFilter label="Forks" options={forkOptions} selected={forkFilter} onChange={setForkFilter} />
        )}
      </div>

      <div className="max-h-[200px] overflow-y-auto border border-border rounded-md">
        {filteredRepos.map((repo) => {
          const checked = isRepoSelected(repo.name)
          return (
            <label
              key={repo.name}
              className="flex items-center gap-2.5 px-2.5 py-1.5 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
              style={{ opacity: checked ? 1 : 0.5 }}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleRepo(repo.name)}
              />
              <span className="flex-1 text-[12px] font-medium truncate">{repo.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{repo.stars > 0 ? `★ ${repo.stars}` : ''}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground shrink-0">
                {repo.isFork ? 'fork' : repo.isArchived ? 'archived' : repo.isPrivate ? 'private' : 'public'}
              </span>
            </label>
          )
        })}
        {filteredRepos.length === 0 && (
          <div className="py-4 text-center text-[11px] text-muted-foreground">No repos match filters</div>
        )}
      </div>
    </div>
  )
}
