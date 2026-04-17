import { notFound } from 'next/navigation'
import {
  getWorkspaceBySlug,
  getRepos,
  getWorkspaceStats,
  getTasks,
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

  const repos = getRepos(workspace.id)
  const stats = getWorkspaceStats(workspace.id)
  const tasks = getTasks(workspace.id)

  return <CommandCenter repos={repos} stats={stats} tasks={tasks} workspaceSlug={slug} />
}
