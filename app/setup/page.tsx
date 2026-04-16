import { redirect } from 'next/navigation'
import { getSetting } from '@/lib/db/queries'
import { getAuth } from '@/lib/auth/config'
import { SetupConnect } from './setup-connect'
import { SignInButton } from './sign-in-button'

export default async function SetupPage() {
  const { auth } = getAuth()
  const session = await auth()

  if (session?.user) {
    redirect('/')
  }

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
          <SignInButton />
        </div>
      </div>
    )
  }

  return <SetupConnect />
}
