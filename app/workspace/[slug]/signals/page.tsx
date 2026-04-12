import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getSignals } from '@/lib/db/queries'
import { SignalFeed } from '@/components/screens/SignalFeed'

export default async function SignalsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const signals = getSignals(workspace.id)
  return <SignalFeed signals={signals} />
}
