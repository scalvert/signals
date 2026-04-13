import { notFound } from 'next/navigation'
import {
  getWorkspaceBySlug,
  getRepos,
  getWorkspaceStats,
} from '@/lib/db/queries'
import { CommandCenter } from '@/components/screens/CommandCenter'

export default async function CommandCenterPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const [repos, stats] = await Promise.all([
    getRepos(workspace.id),
    getWorkspaceStats(workspace.id),
  ])

  return <CommandCenter repos={repos} stats={stats} workspaceSlug={slug} />
}
