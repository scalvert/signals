'use client'

import { usePathname } from 'next/navigation'
import { RefreshCw, Check, AlertCircle } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import type { SyncStatus } from '@/types/workspace'

const screenTitles: Record<string, { title: string; subtitle: string }> = {
  '': { title: 'Dashboard', subtitle: 'Overview of your workspace' },
  '/repos': { title: 'Repositories', subtitle: 'All repositories across your workspace' },
  '/prs': { title: 'Pull Requests', subtitle: 'Open PRs across all repositories' },
  '/signals': { title: 'Signal Feed', subtitle: 'Events and anomalies worth your attention' },
  '/insights': { title: 'Insights', subtitle: 'Charts and trends across your workspace' },
  '/settings': { title: 'Settings', subtitle: 'Manage workspace configuration' },
}

interface TopBarProps {
  workspaceSlug: string
  syncStatus: SyncStatus | null
  onSync?: () => void
  syncing?: boolean
}

export function TopBar({ workspaceSlug, syncStatus, onSync, syncing }: TopBarProps) {
  const pathname = usePathname()
  const basePath = `/workspace/${workspaceSlug}`
  const segment = pathname.replace(basePath, '') || ''
  const meta = screenTitles[segment] || screenTitles['']

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card shrink-0">
      <div>
        <h1 className="text-[15px] font-semibold text-foreground leading-tight">{meta.title}</h1>
        <p className="text-[12px] text-muted-foreground leading-tight">{meta.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {syncStatus && !syncing && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {syncStatus.status === 'success' ? (
              <Check className="w-3.5 h-3.5 text-[var(--health-a)]" />
            ) : syncStatus.status === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-[var(--health-d)]" />
            ) : null}
            <span>
              {syncStatus.completedAt
                ? `Synced ${formatRelativeDate(syncStatus.completedAt)}`
                : 'Not synced'}
            </span>
          </div>
        )}
        <button
          onClick={onSync}
          disabled={syncing}
          className="h-8 px-3 flex items-center gap-1.5 text-[12px] font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
    </header>
  )
}
