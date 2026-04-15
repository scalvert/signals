'use client'

import { useState } from 'react'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { SignalCard } from '@/components/shared/SignalCard'
import { SignalPanel } from '@/components/shared/SignalPanel'
import type { Signal } from '@/types/workspace'

export function SignalFeed({
  activeSignals,
  dismissedSignals,
}: {
  activeSignals: Signal[]
  dismissedSignals: Signal[]
}) {
  const [tab, setTab] = useState<'active' | 'dismissed'>('active')
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
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
            <div key={signal.id} onClick={() => setSelectedSignal(signal)} className="cursor-pointer">
              <SignalCard
                signal={signal}
                showDismissAction={tab === 'active'}
                showRestoreAction={tab === 'dismissed'}
                onDismissed={handleDismissed}
                onRestored={handleDismissed}
              />
            </div>
          ))
        )}
      </div>
      <SignalPanel
        signal={selectedSignal}
        open={!!selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </div>
  )
}
