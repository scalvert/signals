import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getWorkspaces, getLatestSync } from '@/lib/db/queries'
import { getAllUsers } from '@/lib/auth/users'
import { getAuth } from '@/lib/auth/config'
import { WorkspaceShell } from './workspace-shell'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const allWorkspaces = getWorkspaces()
  const syncStatus = getLatestSync(workspace.id)
  const hasAiKey = !!process.env.ANTHROPIC_API_KEY

  const { auth } = getAuth()
  const session = await auth()
  const allUsers = getAllUsers()
  const currentUser = session?.user?.githubLogin
    ? allUsers.find((u) => u.githubLogin === session.user.githubLogin) ?? null
    : null

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
      currentUser={currentUser}
      allUsers={allUsers}
      workspaceCounts={workspaceCounts}
    >
      {children}
    </WorkspaceShell>
  )
}
