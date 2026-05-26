import { notFound } from 'next/navigation'
import { getDispatchTargetForWorkspace, getRepos } from '@/lib/db/queries'
import { requireWorkspaceAccessBySlug } from '@/lib/auth/access'
import { SettingsView } from './settings-view'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const access = await requireWorkspaceAccessBySlug(slug).catch(() => null)
  if (!access) notFound()
  const { workspace, membership } = access

  const repos = getRepos(workspace.id)
  const allRepoNames = repos.map((r) => r.fullName).sort()
  const agentOrchestratorTarget = getDispatchTargetForWorkspace(workspace.id, 'agent-orchestrator')

  return (
    <SettingsView
      workspace={workspace}
      allRepoNames={allRepoNames}
      canEdit={membership.role === 'owner'}
      agentOrchestratorTarget={agentOrchestratorTarget}
    />
  )
}
