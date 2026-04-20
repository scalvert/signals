import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getRepos } from '@/lib/db/queries'
import { Repositories } from '@/components/screens/Repositories'

export default async function ReposPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ repo?: string }>
}) {
  const { slug } = await params
  const { repo } = await searchParams
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const repos = getRepos(workspace.id)
  return <Repositories repos={repos} workspaceId={workspace.id} initialSelectedRepo={repo} />
}
