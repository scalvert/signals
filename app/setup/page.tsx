import { redirect } from 'next/navigation'
import { getSetting } from '@/lib/db/queries'
import { signIn, auth } from '@/lib/auth/config'
import { SetupConnect } from './setup-connect'

export default async function SetupPage() {
  const session = await auth()

  // Already logged in — go to workspace
  if (session?.user) {
    redirect('/')
  }

  // GitHub App already configured — show sign in
  const clientId = getSetting('github.app.clientId')
  if (clientId) {
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
          <form
            action={async () => {
              'use server'
              await signIn('github', { redirectTo: '/' })
            }}
          >
            <button
              type="submit"
              className="h-11 px-6 rounded-lg bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors"
            >
              Sign in with GitHub
            </button>
          </form>
        </div>
      </div>
    )
  }

  // No GitHub App — show manifest setup
  return <SetupConnect />
}
