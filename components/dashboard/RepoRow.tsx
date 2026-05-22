'use client'

import { ChevronDown, ChevronRight, Star, AlertCircle, GitPullRequest, Loader2, Lock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import { HealthBadge } from '@/components/shared/HealthBadge'
import { PillarBar } from '@/components/shared/PillarBar'
import { SignalActionCard } from './SignalActionCard'
import { TaskTimeline } from './TaskTimeline'
import { RepoContextEditor } from './RepoContextEditor'
import type { RepoDashboardRow } from '@/lib/db/queries'
import type { TriageStatus } from '@/types/workspace'

const triageBorderLeft: Record<TriageStatus, string> = {
  healthy: 'border-l-3 border-l-health-a',
  watch: 'border-l-3 border-l-health-c',
  critical: 'border-l-3 border-l-health-d',
}

const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1 }

function worstSeverityColor(row: RepoDashboardRow): string | null {
  if (row.signals.length === 0) return null
  const worst = row.signals.reduce(
    (acc, s) => ((severityRank[s.severity] ?? 0) > (severityRank[acc] ?? 0) ? s.severity : acc),
    'info' as string,
  )
  if (worst === 'critical') return 'text-[var(--health-d)] bg-[var(--health-d)]/10 border-[var(--health-d)]/30'
  if (worst === 'warning') return 'text-[var(--health-c)] bg-[var(--health-c)]/10 border-[var(--health-c)]/30'
  return 'text-muted-foreground bg-muted border-border'
}

export function getActivePillarMax(row: Pick<RepoDashboardRow, 'repo'>): number {
  const categories = new Set(
    Object.values(row.repo.checkResults).map((result) => result.pillar),
  )
  const activeCount = ['activity', 'community', 'quality', 'security']
    .filter((category) => categories.has(category))
    .length
  return activeCount > 0 ? 100 / activeCount : 25
}

interface Props {
  row: RepoDashboardRow
  expanded: boolean
  onToggle: () => void
  workspaceId: number
  onChange: () => void
}

export function RepoRow({ row, expanded, onToggle, workspaceId, onChange }: Props) {
  const { repo, signals, signalTasks, recentTasks, activeTaskCount } = row
  const severityClass = worstSeverityColor(row)
  const Chevron = expanded ? ChevronDown : ChevronRight
  const maxPillarValue = getActivePillarMax(row)

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden', triageBorderLeft[repo.triage])}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Chevron className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
              {repo.fullName}
              {repo.isPrivate && <Lock className="w-3 h-3 text-muted-foreground" />}
            </div>
            {repo.description && (
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[420px]">
                {repo.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <HealthBadge grade={repo.grade} score={repo.score} />
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Star className="w-3 h-3" />
            {repo.stars}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            {repo.openIssues}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <GitPullRequest className="w-3 h-3" />
            {repo.openPRs}
          </span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap min-w-[80px] text-right">
            {repo.lastCommitAt ? formatRelativeDate(repo.lastCommitAt) : '—'}
          </span>
          {signals.length > 0 && severityClass && (
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', severityClass)}>
              <Activity className="w-3 h-3" />
              {signals.length}
            </span>
          )}
          {activeTaskCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--health-b)] bg-[var(--health-b)]/10 border border-[var(--health-b)]/30 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              {activeTaskCount}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/10 px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Health Breakdown</h3>
              <div className="flex flex-col gap-2.5">
                <PillarBar label="Activity" value={repo.pillars.activity} max={maxPillarValue} />
                <PillarBar label="Community" value={repo.pillars.community} max={maxPillarValue} />
                <PillarBar label="Quality" value={repo.pillars.quality} max={maxPillarValue} />
                <PillarBar label="Security" value={repo.pillars.security} max={maxPillarValue} />
              </div>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Recent tasks ({recentTasks.length})
              </h3>
              <TaskTimeline tasks={recentTasks} />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Signals ({signals.length})
              </h3>
              {signals.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">No active signals.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {signals.map((signal) => (
                    <SignalActionCard
                      key={signal.id}
                      signal={signal}
                      initialTask={signalTasks[String(signal.id)]}
                      workspaceId={workspaceId}
                      canDispatch={row.canDispatch}
                      permissionReason={row.permissionReason}
                      onChange={onChange}
                    />
                  ))}
                </div>
              )}
            </div>
            <RepoContextEditor workspaceId={workspaceId} repoFullName={repo.fullName} />
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground hover:text-foreground underline self-start"
            >
              View on GitHub →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
