import { notFound, redirect } from 'next/navigation'
import { getWorkspacesForUser, getLatestSync, getTasks } from '@/lib/db/queries'
import { getAllUsers } from '@/lib/auth/users'
import { AccessError, requireWorkspaceAccessBySlug } from '@/lib/auth/access'
import { WorkspaceShell } from './workspace-shell'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  let access
  try {
    access = await requireWorkspaceAccessBySlug(slug)
  } catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect('/setup')
    notFound()
  }
  const { workspace, userId } = access

  const allWorkspaces = getWorkspacesForUser(userId)
  const syncStatus = getLatestSync(workspace.id)
  const hasAiKey = !!process.env.ANTHROPIC_API_KEY
  const pendingTaskCount = getTasks(workspace.id, { status: 'pending' }).length

  const allUsers = getAllUsers()
  const currentUser = allUsers.find((u) => u.id === userId) ?? null

  const workspaceCounts: Record<number, number> = {}
  for (const ws of allWorkspaces) {
    const userId = ws.userId ?? 0
    workspaceCounts[userId] = (workspaceCounts[userId] ?? 0) + 1
  }

  return (
    <WorkspaceShell
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      syncStatus={syncStatus}
      hasAiKey={hasAiKey}
      pendingTaskCount={pendingTaskCount}
      currentUser={currentUser}
      allUsers={allUsers}
      workspaceCounts={workspaceCounts}
    >
      {children}
    </WorkspaceShell>
  )
}
