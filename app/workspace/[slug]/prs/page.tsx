import { notFound } from 'next/navigation'
import { getPullRequests } from '@/lib/db/queries'
import { requireWorkspaceAccessBySlug } from '@/lib/auth/access'
import { InstallationRequired } from '@/components/workspace/InstallationRequired'
import { PullRequests } from '@/components/screens/PullRequests'

export default async function PRsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const access = await requireWorkspaceAccessBySlug(slug).catch(() => null)
  if (!access) notFound()
  const { workspace } = access

  if (!workspace.githubInstallationId) {
    return <InstallationRequired workspace={workspace} />
  }

  const prs = getPullRequests(workspace.id)
  return <PullRequests prs={prs} />
}
