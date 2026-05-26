import { notFound } from 'next/navigation'
import { getDispatchTargetForWorkspace, getRepoDashboardRows } from '@/lib/db/queries'
import { requireWorkspaceAccessBySlug } from '@/lib/auth/access'
import { applyRepoPermissionsToDashboardRows } from '@/lib/github/permissions'
import { InstallationRequired } from '@/components/workspace/InstallationRequired'
import { Dashboard } from '@/components/screens/Dashboard'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const access = await requireWorkspaceAccessBySlug(slug).catch(() => null)
  if (!access) notFound()
  const { workspace, userId, githubLogin } = access

  if (!workspace.githubInstallationId) {
    return <InstallationRequired workspace={workspace} />
  }

  const rows = await applyRepoPermissionsToDashboardRows(
    getRepoDashboardRows(workspace.id),
    workspace.id,
    userId,
    githubLogin,
  )
  const agentOrchestratorTarget = getDispatchTargetForWorkspace(workspace.id, 'agent-orchestrator')

  return (
    <Dashboard
      rows={rows}
      workspaceId={workspace.id}
      dispatchTarget={agentOrchestratorTarget}
    />
  )
}
