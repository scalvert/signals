'use client'

import Link from 'next/link'
import { GitBranch, GitPullRequest, Activity, Star, Hammer } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { RepoCard } from '@/components/shared/RepoCard'
import { cn } from '@/lib/utils'
import { triageHeaderColors } from '@/lib/constants'
import type { Repo, WorkspaceStats, TriageStatus, Task } from '@/types/workspace'

const taskStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-muted', text: 'text-muted-foreground' },
  dispatched: { bg: 'bg-[var(--health-b)]/10', text: 'text-[var(--health-b)]' },
  completed: { bg: 'bg-[var(--health-a)]/10', text: 'text-[var(--health-a)]' },
  verified: { bg: 'bg-[var(--health-a)]/20', text: 'text-[var(--health-a)]' },
  failed: { bg: 'bg-[var(--health-d)]/10', text: 'text-[var(--health-d)]' },
}

interface CommandCenterProps {
  repos: Repo[]
  stats: WorkspaceStats
  tasks: Task[]
  workspaceSlug: string
}

const triageSections: { status: TriageStatus; label: string }[] = [
  { status: 'healthy', label: 'Healthy' },
  { status: 'watch', label: 'Watch' },
  { status: 'critical', label: 'Critical' },
]

export function CommandCenter({ repos, stats, tasks, workspaceSlug }: CommandCenterProps) {
  const base = `/workspace/${workspaceSlug}`

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          label="Total Repos"
          value={stats.totalRepos}
          icon={GitBranch}
          color="bg-muted text-muted-foreground"
          href={`${base}/repos`}
        />
        <StatCard
          label="Open PRs"
          value={stats.openPRs}
          sub="across all repos"
          icon={GitPullRequest}
          color="bg-muted text-muted-foreground"
          href={`${base}/prs`}
        />
        <StatCard
          label="Avg Health Score"
          value={stats.avgHealthScore}
          icon={Activity}
          color="bg-muted text-muted-foreground"
          href={`${base}/repos`}
        />
        <StatCard
          label="Total Stars"
          value={stats.starsLast30d.toLocaleString()}
          sub="across all repos"
          icon={Star}
          color="bg-muted text-muted-foreground"
          href={`${base}/insights`}
        />
        <StatCard
          label="Pending Tasks"
          value={tasks.filter((t) => t.status === 'pending').length}
          sub={`${tasks.filter((t) => t.status === 'dispatched').length} in flight`}
          icon={Hammer}
          color="bg-muted text-muted-foreground"
          href={`${base}/work`}
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
                  <Link key={repo.id} href={`${base}/repos`}>
                    <RepoCard repo={repo} />
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {tasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-foreground">
              Recent Tasks
            </h2>
            <Link href={`${base}/work`} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </div>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {tasks.slice(0, 5).map((task) => {
              const colors = taskStatusColors[task.status] ?? taskStatusColors.pending
              return (
                <div key={task.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">{task.title}</div>
                    <span className="text-[11px] text-muted-foreground font-mono">{task.repoFullName}</span>
                  </div>
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-3', colors.bg, colors.text)}>
                    {task.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
