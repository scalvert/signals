'use client'

import { TrendingUp, UserPlus, TrendingDown, AlertCircle, Star, GitPullRequest, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Signal, SignalType } from '@/types/workspace'

const signalIcons: Record<SignalType, { icon: React.ElementType; color: string; bg: string }> = {
  'star-spike': { icon: TrendingUp, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  'new-contributor': { icon: UserPlus, color: 'text-[var(--health-a)]', bg: 'bg-[var(--health-a)]/10' },
  'health-drop': { icon: TrendingDown, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
  'issue-flood': { icon: AlertCircle, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'pr-stale': { icon: GitPullRequest, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'milestone': { icon: Star, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  'dormant': { icon: Activity, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
}

const severityBorder: Record<string, string> = {
  info: 'border-border',
  warning: 'border-[var(--health-c)]/30',
  critical: 'border-[var(--health-d)]/30',
}

const severityBg: Record<string, string> = {
  info: '',
  warning: 'bg-[var(--health-c)]/3',
  critical: 'bg-[var(--health-d)]/3',
}

export function SignalFeed({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          title="No signals yet"
          description="Signals will appear after your first sync detects events like star spikes, health drops, or new contributors."
        />
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-foreground">{signals.length} signals</h2>
        <div className="flex items-center gap-2">
          {(['info', 'warning', 'critical'] as const).map((s) => (
            <span key={s} className={cn(
              'text-[11px] font-medium px-2 py-1 rounded-full border',
              s === 'info' && 'border-border text-muted-foreground',
              s === 'warning' && 'border-[var(--health-c)]/30 text-[var(--health-c)] bg-[var(--health-c)]/8',
              s === 'critical' && 'border-[var(--health-d)]/30 text-[var(--health-d)] bg-[var(--health-d)]/8',
            )}>
              {signals.filter((e) => e.severity === s).length} {s}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {signals.map((signal) => {
          const config = signalIcons[signal.type] ?? signalIcons['health-drop']
          const Icon = config.icon
          return (
            <div key={signal.id}
              className={cn('bg-card border rounded-lg px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow',
                severityBorder[signal.severity], severityBg[signal.severity])}>
              <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
                <Icon className={cn('w-4 h-4', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-[13px] font-semibold text-foreground leading-tight">{signal.title}</div>
                  <div className="text-[11px] text-muted-foreground shrink-0">{new Date(signal.detectedAt).toLocaleDateString()}</div>
                </div>
                <div className="text-[12px] text-muted-foreground leading-relaxed mt-1">{signal.body}</div>
                <div className="mt-1.5">
                  <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
                    {signal.repoFullName}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
