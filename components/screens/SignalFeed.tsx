'use client'

import { useState } from 'react'
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

function DismissForm({ signalId, onDismissed, onCancel }: { signalId: number; onDismissed: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    await fetch(`/api/signals/${signalId}/dismiss`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    onDismissed()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this signal not useful?"
        className="flex-1 h-7 px-2 text-[12px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <button
        type="submit"
        disabled={submitting || !reason.trim()}
        className="h-7 px-3 text-[11px] font-medium rounded bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        Dismiss
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-7 px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </form>
  )
}

function SignalCard({
  signal,
  showDismissAction,
  showRestoreAction,
  onDismissed,
  onRestored,
}: {
  signal: Signal
  showDismissAction: boolean
  showRestoreAction: boolean
  onDismissed?: () => void
  onRestored?: () => void
}) {
  const [showDismissForm, setShowDismissForm] = useState(false)
  const config = signalIcons[signal.type] ?? signalIcons['health-drop']
  const Icon = config.icon
  const displayBody = signal.enrichedBody ?? signal.body

  return (
    <div
      className={cn(
        'bg-card border rounded-lg px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow',
        severityBorder[signal.severity],
        severityBg[signal.severity],
      )}
    >
      <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[13px] font-semibold text-foreground leading-tight">{signal.title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[11px] text-muted-foreground">
              {new Date(signal.detectedAt).toLocaleDateString()}
            </div>
            {showDismissAction && !showDismissForm && (
              <button
                onClick={() => setShowDismissForm(true)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground leading-relaxed mt-1">{displayBody}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
            {signal.repoFullName}
          </span>
        </div>
        {signal.dismissedReason && (
          <div className="mt-2 text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5 flex items-center justify-between gap-2">
            <span>Dismissed: {signal.dismissedReason}</span>
            {showRestoreAction && (
              <button
                onClick={async () => {
                  await fetch(`/api/signals/${signal.id}/restore`, { method: 'PATCH' })
                  onRestored?.()
                }}
                className="text-[11px] font-medium text-foreground hover:underline shrink-0"
              >
                Restore
              </button>
            )}
          </div>
        )}
        {showDismissForm && (
          <DismissForm
            signalId={signal.id}
            onDismissed={() => {
              setShowDismissForm(false)
              onDismissed?.()
            }}
            onCancel={() => setShowDismissForm(false)}
          />
        )}
      </div>
    </div>
  )
}

export function SignalFeed({
  activeSignals,
  dismissedSignals,
}: {
  activeSignals: Signal[]
  dismissedSignals: Signal[]
}) {
  const [tab, setTab] = useState<'active' | 'dismissed'>('active')
  const signals = tab === 'active' ? activeSignals : dismissedSignals
  const totalCount = activeSignals.length + dismissedSignals.length

  if (totalCount === 0) {
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

  function handleDismissed() {
    window.location.reload()
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab('active')}
            className={cn(
              'text-[13px] font-semibold px-2 py-1 rounded transition-colors',
              tab === 'active' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Active ({activeSignals.length})
          </button>
          <button
            onClick={() => setTab('dismissed')}
            className={cn(
              'text-[13px] font-semibold px-2 py-1 rounded transition-colors',
              tab === 'dismissed' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Dismissed ({dismissedSignals.length})
          </button>
        </div>
        {tab === 'active' && (
          <div className="flex items-center gap-2">
            {(['info', 'warning', 'critical'] as const).map((s) => (
              <span
                key={s}
                className={cn(
                  'text-[11px] font-medium px-2 py-1 rounded-full border',
                  s === 'info' && 'border-border text-muted-foreground',
                  s === 'warning' && 'border-[var(--health-c)]/30 text-[var(--health-c)] bg-[var(--health-c)]/8',
                  s === 'critical' && 'border-[var(--health-d)]/30 text-[var(--health-d)] bg-[var(--health-d)]/8',
                )}
              >
                {activeSignals.filter((e) => e.severity === s).length} {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {signals.length === 0 ? (
          <div className="text-[13px] text-muted-foreground text-center py-8">
            {tab === 'active' ? 'No active signals.' : 'No dismissed signals.'}
          </div>
        ) : (
          signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              showDismissAction={tab === 'active'}
              showRestoreAction={tab === 'dismissed'}
              onDismissed={handleDismissed}
              onRestored={handleDismissed}
            />
          ))
        )}
      </div>
    </div>
  )
}
