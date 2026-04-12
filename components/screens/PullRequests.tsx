'use client'

import { useState } from 'react'
import { GitMerge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import type { PullRequest } from '@/types/workspace'

const tagColors: Record<string, string> = {
  External: 'bg-muted text-foreground border-border',
  Stale: 'bg-[var(--health-c)]/10 text-[var(--health-c)] border-[var(--health-c)]/25',
  'CI failing': 'bg-[var(--health-d)]/10 text-[var(--health-d)] border-[var(--health-d)]/25',
}

const filterOptions = ['All', 'External', 'Stale', 'CI failing', 'Draft']

function getTags(pr: PullRequest): string[] {
  const tags: string[] = []
  if (pr.isExternal) tags.push('External')
  if (pr.isStale) tags.push('Stale')
  if (pr.ciState === 'failing') tags.push('CI failing')
  return tags
}

export function PullRequests({ prs }: { prs: PullRequest[] }) {
  const [activeFilter, setActiveFilter] = useState('All')

  const filtered = prs.filter((pr) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Draft') return pr.isDraft
    return getTags(pr).includes(activeFilter)
  })

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-[12px] font-medium border transition-colors',
              activeFilter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">{filtered.length} PRs</span>
      </div>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {filtered.map((pr) => {
          const tags = getTags(pr)
          const initials = pr.authorLogin.slice(0, 2).toUpperCase()
          return (
            <div key={`${pr.repoFullName}#${pr.number}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-foreground truncate">{pr.title}</span>
                  {pr.isDraft && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border text-muted-foreground">Draft</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">{pr.repoFullName.split('/')[1]}</span>
                    {' · '}@{pr.authorLogin}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {tags.map((tag) => (
                  <span key={tag} className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', tagColors[tag])}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] text-muted-foreground">{formatRelativeDate(pr.updatedAt)}</div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground justify-end">
                  <GitMerge className="w-3 h-3" />#{pr.number}
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No pull requests match this filter.</div>
        )}
      </div>
    </div>
  )
}
