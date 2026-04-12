import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getPullRequests } from '@/lib/db/queries'
import { PullRequests } from '@/components/screens/PullRequests'

export default async function PRsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const prs = getPullRequests(workspace.id)
  return <PullRequests prs={prs} />
}
