import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getWorkspacesForUser } from '@/lib/db/queries'
import { getAuth } from '@/lib/auth/config'

export default async function Home() {
  await connection()

  const { auth } = getAuth()
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/setup')
  }

  const workspaces = getWorkspacesForUser(Number(session.user.id))

  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0].slug}`)
  }

  // No workspaces — setup handles auth state and workspace creation
  redirect('/setup')
}
