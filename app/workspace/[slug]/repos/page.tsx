import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getRepos } from '@/lib/db/queries'
import { Repositories } from '@/components/screens/Repositories'

export default async function ReposPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const repos = getRepos(workspace.id)
  return <Repositories repos={repos} workspaceId={workspace.id} />
}
