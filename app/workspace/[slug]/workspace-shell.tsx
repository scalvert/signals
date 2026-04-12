'use client'

import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { Workspace, SyncStatus } from '@/types/workspace'

interface WorkspaceShellProps {
  workspace: Workspace
  syncStatus: SyncStatus | null
  children: React.ReactNode
}

export function WorkspaceShell({
  workspace,
  syncStatus,
  children,
}: WorkspaceShellProps) {
  const router = useRouter()

  async function handleSync() {
    await fetch(`/api/sync?slug=${workspace.slug}`, { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans">
      <Sidebar workspace={workspace} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          workspaceSlug={workspace.slug}
          syncStatus={syncStatus}
          onSync={handleSync}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
