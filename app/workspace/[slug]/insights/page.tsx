import { notFound } from 'next/navigation'
import { getRepos, getPullRequests, getScoreHistory } from '@/lib/db/queries'
import { requireWorkspaceAccessBySlug } from '@/lib/auth/access'
import { InstallationRequired } from '@/components/workspace/InstallationRequired'
import { Insights } from '@/components/screens/Insights'

export default async function InsightsPage({
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

  const repos = getRepos(workspace.id)
  const prs = getPullRequests(workspace.id)
  const history = getScoreHistory(workspace.id)
  return <Insights repos={repos} prs={prs} scoreHistory={history} />
}
