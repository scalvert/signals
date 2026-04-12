import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getRepos } from '@/lib/db/queries'
import { Insights } from '@/components/screens/Insights'

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const repos = getRepos(workspace.id)
  return <Insights repos={repos} />
}
