'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, GitBranch, Eye, EyeOff, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Workspace } from '@/types/workspace'

interface SettingsViewProps {
  workspace: Workspace
  allRepoNames: string[]
}

export function SettingsView({ workspace, allRepoNames }: SettingsViewProps) {
  const router = useRouter()
  const [excluded, setExcluded] = useState<Set<string>>(
    new Set(workspace.excludedRepos),
  )
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const hasChanges =
    excluded.size !== workspace.excludedRepos.length ||
    [...excluded].some((r) => !workspace.excludedRepos.includes(r))

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/workspaces/${workspace.id}/excluded-repos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludedRepos: [...excluded] }),
    })
    setSaving(false)
    router.refresh()
  }

  function toggleRepo(fullName: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  const filteredRepos = allRepoNames.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Workspace Settings
      </h2>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="text-[13px] font-semibold text-foreground mb-2">
          Details
        </h3>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong className="text-foreground">Name:</strong>{' '}
            {workspace.name}
          </p>
          <p className="mb-2">
            <strong className="text-foreground">Sources:</strong>
          </p>
          <div className="flex flex-col gap-1.5 ml-1">
            {workspace.sources.map((s) => (
              <div
                key={`${s.type}-${s.value}`}
                className="flex items-center gap-2 text-[12px]"
              >
                {s.type === 'org' ? (
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-foreground">{s.value}</span>
                <span className="text-muted-foreground/60">({s.type})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-foreground">
            Repository Visibility
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {allRepoNames.length - excluded.size} of {allRepoNames.length} included
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground mb-3">
          Toggle repos to include or exclude them from this workspace.
          Excluded repos won't appear in dashboards or health scoring.
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repositories..."
            className="h-8 w-full pl-8 pr-3 text-[12px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto divide-y divide-border border border-border rounded-md">
          {filteredRepos.map((fullName) => {
            const isExcluded = excluded.has(fullName)
            const repoName = fullName.split('/')[1]
            return (
              <button
                key={fullName}
                onClick={() => toggleRepo(fullName)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                  isExcluded && 'opacity-50',
                )}
              >
                {isExcluded ? (
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-foreground">
                    {repoName}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    {fullName.split('/')[0]}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    isExcluded
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-[var(--health-a)]/10 text-[var(--health-a)]',
                  )}
                >
                  {isExcluded ? 'Excluded' : 'Included'}
                </span>
              </button>
            )
          })}
        </div>

        {hasChanges && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-[12px] text-muted-foreground">
              {excluded.size} repo{excluded.size !== 1 ? 's' : ''} excluded
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setExcluded(new Set(workspace.excludedRepos))}
                className="h-8 px-3 text-[12px] font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-8 px-4 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Re-sync'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
