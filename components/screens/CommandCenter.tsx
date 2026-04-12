'use client'

import { GitBranch, GitPullRequest, Activity, Star } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { RepoCard } from '@/components/shared/RepoCard'
import { cn } from '@/lib/utils'
import { triageHeaderColors } from '@/lib/constants'
import type { Repo, WorkspaceStats, TriageStatus } from '@/types/workspace'

interface CommandCenterProps {
  repos: Repo[]
  stats: WorkspaceStats
}

const triageSections: { status: TriageStatus; label: string }[] = [
  { status: 'healthy', label: 'Healthy' },
  { status: 'watch', label: 'Watch' },
  { status: 'critical', label: 'Critical' },
]

export function CommandCenter({ repos, stats }: CommandCenterProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Repos"
          value={stats.totalRepos}
          icon={GitBranch}
          color="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Open PRs"
          value={stats.openPRs}
          sub="across all repos"
          icon={GitPullRequest}
          color="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Avg Health Score"
          value={stats.avgHealthScore}
          icon={Activity}
          color="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Total Stars"
          value={stats.starsLast30d.toLocaleString()}
          sub="across all repos"
          icon={Star}
          color="bg-muted text-muted-foreground"
        />
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-foreground mb-3">
          Triage Board
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {triageSections.map(({ status, label }) => {
            const sectionRepos = repos.filter((r) => r.triage === status)
            return (
              <div key={status} className="flex flex-col gap-2 min-h-[280px]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'text-[12px] font-semibold uppercase tracking-wide',
                      triageHeaderColors[status],
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-full">
                    {sectionRepos.length}
                  </span>
                </div>
                {sectionRepos.map((repo) => (
                  <RepoCard key={repo.id} repo={repo} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
