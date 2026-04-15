'use client'

import { useState } from 'react'
import { TrendingUp, UserPlus, TrendingDown, AlertCircle, Star, GitPullRequest, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
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

export function SignalCard({
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
                onClick={(e) => { e.stopPropagation(); setShowDismissForm(true) }}
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
                onClick={async (e) => {
                  e.stopPropagation()
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
          <div onClick={(e) => e.stopPropagation()}>
            <DismissForm
              signalId={signal.id}
              onDismissed={() => {
                setShowDismissForm(false)
                onDismissed?.()
              }}
              onCancel={() => setShowDismissForm(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
