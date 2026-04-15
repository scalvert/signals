'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AiChatPanel } from '@/components/layout/AiChatPanel'
import type { Workspace, SyncStatus } from '@/types/workspace'

interface WorkspaceShellProps {
  workspace: Workspace
  allWorkspaces: Workspace[]
  syncStatus: SyncStatus | null
  hasAiKey: boolean
  children: React.ReactNode
}

export function WorkspaceShell({
  workspace,
  allWorkspaces,
  syncStatus: initialSyncStatus,
  hasAiKey,
  children,
}: WorkspaceShellProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch(`/api/sync?slug=${workspace.slug}`, { method: 'POST' })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const effectiveSyncStatus: SyncStatus | null = syncing
    ? {
        id: 0,
        status: 'running',
        startedAt: new Date().toISOString(),
        completedAt: null,
        repoCount: null,
        error: null,
      }
    : initialSyncStatus

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans">
      <Sidebar workspace={workspace} allWorkspaces={allWorkspaces} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          workspace={workspace}
          syncStatus={effectiveSyncStatus}
          onSync={handleSync}
          syncing={syncing}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <AiChatPanel workspaceId={workspace.id} hasAiKey={hasAiKey} />
    </div>
  )
}
