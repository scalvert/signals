import { redirect } from 'next/navigation'
import { getSetting, getWorkspaces } from '@/lib/db/queries'
import { getAuth } from '@/lib/auth/config'
import { SetupConnect } from './setup-connect'
import { SignInButton } from './sign-in-button'
import { CreateWorkspace } from './create-workspace'

export default async function SetupPage() {
  // Step 1: No GitHub App credentials → manifest setup (always first)
  const clientId = getSetting('github.app.clientId')
  if (!clientId) {
    return <SetupConnect />
  }

  // Step 2: Has credentials — check session
  const { auth } = getAuth()
  const session = await auth()

  if (session?.user) {
    // Step 3: Authenticated — check workspaces
    const workspaces = getWorkspaces()
    if (workspaces.length > 0) {
      redirect(`/workspace/${workspaces[0].slug}`)
    }

    // Step 4: Authenticated but no workspaces → create first workspace
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="/signals-icon-black-128px.png" alt="Signals" className="w-16 h-16 dark:hidden" />
            <img src="/signals-icon-white-128px.png" alt="Signals" className="w-16 h-16 hidden dark:block" />
          </div>
          <h1 className="text-[24px] font-bold text-foreground mb-2">Create your first workspace</h1>
          <p className="text-[14px] text-muted-foreground mb-4 leading-relaxed">
            Add GitHub orgs and repos to start monitoring.
          </p>
        </div>
        <CreateWorkspace />
      </div>
    )
  }

  // Step 5: Has credentials but not signed in → sign in
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <img src="/signals-icon-black-128px.png" alt="Signals" className="w-16 h-16 dark:hidden" />
          <img src="/signals-icon-white-128px.png" alt="Signals" className="w-16 h-16 hidden dark:block" />
        </div>
        <h1 className="text-[24px] font-bold text-foreground mb-2">Welcome to Signals</h1>
        <p className="text-[14px] text-muted-foreground mb-8 leading-relaxed">
          Sign in with your GitHub account to get started.
        </p>
        <SignInButton />
      </div>
    </div>
  )
}
