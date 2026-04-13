import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getRepos } from '@/lib/db/queries'
import { SettingsView } from './settings-view'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const repos = getRepos(workspace.id)
  const allRepoNames = repos.map((r) => r.fullName).sort()

  return (
    <SettingsView
      workspace={workspace}
      allRepoNames={allRepoNames}
    />
  )
}
