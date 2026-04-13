import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getWorkspaces, getLatestSync } from '@/lib/db/queries'
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

  return (
    <WorkspaceShell workspace={workspace} allWorkspaces={allWorkspaces} syncStatus={syncStatus}>
      {children}
    </WorkspaceShell>
  )
}
