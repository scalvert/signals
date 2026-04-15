'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Building2, User, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceSource } from '@/types/workspace'

interface SearchResult {
  orgs: { login: string; avatarUrl: string; repoCount: number }[]
  users: { login: string; avatarUrl: string }[]
  repos: { fullName: string; stars: number; isPrivate: boolean }[]
}

interface GitHubSourceSearchProps {
  existingSources: WorkspaceSource[]
  onAdd: (source: WorkspaceSource) => void
}

export function GitHubSourceSearch({ existingSources, onAdd }: GitHubSourceSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setOpen(false)
      return
    }

    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/github/search?q=${encodeURIComponent(query.trim())}`)
        if (!res.ok) {
          setResults(null)
          setLoading(false)
          return
        }
        const data = await res.json()
        setResults(data)
        setOpen(true)
      } catch {
        setResults(null)
      }
      setLoading(false)
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const existingValues = new Set(existingSources.map((s) => `${s.type}:${s.value}`))

  function addSource(type: 'org' | 'user' | 'repo', value: string) {
    onAdd({
      type,
      value,
      ...(type !== 'repo' ? { repos: { mode: 'all', selected: [], visibility: 'all' } } : {}),
    })
    setQuery('')
    setOpen(false)
  }

  const hasResults = results && (results.orgs.length > 0 || results.users.length > 0 || results.repos.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search GitHub orgs, users, or repos..."
          className="h-9 w-full pl-8 pr-3 text-[13px] rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {open && (
        <div className="absolute top-10 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[280px] overflow-y-auto">
          {loading && (
            <div className="py-4 text-center text-[11px] text-muted-foreground">Searching...</div>
          )}

          {!loading && !hasResults && query.trim() && (
            <div className="py-4 text-center text-[11px] text-muted-foreground">No results found</div>
          )}

          {!loading && hasResults && (
            <div className="p-1">
              {results.orgs.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Organizations</div>
                  {results.orgs.map((org) => {
                    const exists = existingValues.has(`org:${org.login}`)
                    return (
                      <button
                        key={org.login}
                        disabled={exists}
                        onClick={() => addSource('org', org.login)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left hover:bg-muted transition-colors',
                          exists && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium">{org.login}</div>
                          <div className="text-[10px] text-muted-foreground">{org.repoCount} repos</div>
                        </div>
                        {exists && <span className="text-[10px] text-muted-foreground">Added</span>}
                      </button>
                    )
                  })}
                </>
              )}

              {results.users.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase mt-1">Users</div>
                  {results.users.map((user) => {
                    const exists = existingValues.has(`user:${user.login}`)
                    return (
                      <button
                        key={user.login}
                        disabled={exists}
                        onClick={() => addSource('user', user.login)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left hover:bg-muted transition-colors',
                          exists && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium">{user.login}</div>
                          <div className="text-[10px] text-muted-foreground">User</div>
                        </div>
                        {exists && <span className="text-[10px] text-muted-foreground">Added</span>}
                      </button>
                    )
                  })}
                </>
              )}

              {results.repos.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase mt-1">Repositories</div>
                  {results.repos.map((repo) => {
                    const exists = existingValues.has(`repo:${repo.fullName}`)
                    return (
                      <button
                        key={repo.fullName}
                        disabled={exists}
                        onClick={() => addSource('repo', repo.fullName)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left hover:bg-muted transition-colors',
                          exists && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium">{repo.fullName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {repo.isPrivate ? 'Private' : 'Public'} · ★ {repo.stars}
                          </div>
                        </div>
                        {exists && <span className="text-[10px] text-muted-foreground">Added</span>}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
