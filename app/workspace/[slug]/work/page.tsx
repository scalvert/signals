import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getTasks } from '@/lib/db/queries'
import { Work } from '@/components/screens/Work'

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const tasks = getTasks(workspace.id)
  return <Work tasks={tasks} />
}
