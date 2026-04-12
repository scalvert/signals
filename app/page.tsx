import { redirect } from 'next/navigation'
import { getWorkspaces } from '@/lib/db/queries'

export default function Home() {
  const workspaces = getWorkspaces()

  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0].slug}`)
  }

  redirect('/setup')
}
