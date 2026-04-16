import { redirect } from 'next/navigation'
import { getWorkspaces } from '@/lib/db/queries'

export default function Home() {
  const workspaces = getWorkspaces()

  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0].slug}`)
  }

  // No workspaces — setup handles auth state and workspace creation
  redirect('/setup')
}
