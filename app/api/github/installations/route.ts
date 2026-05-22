import { NextResponse } from 'next/server'
import { requireSession, accessErrorResponse } from '@/lib/auth/access'
import { syncGitHubInstallations, canUserAccessInstallation } from '@/lib/github/installations'
import { getSetting } from '@/lib/db/queries'

async function listVisibleInstallations(githubLogin: string) {
  const installations = await syncGitHubInstallations()
  const visible = []

  for (const installation of installations) {
    if (await canUserAccessInstallation(installation.installationId, githubLogin)) {
      visible.push(installation)
    }
  }

  return visible
}

export async function GET() {
  try {
    const { githubLogin } = await requireSession()
    const installations = await listVisibleInstallations(githubLogin)
    const slug = getSetting('github.app.slug')
    const installUrl = slug
      ? `https://github.com/apps/${slug}/installations/new`
      : null

    return NextResponse.json({ installations, installUrl })
  } catch (error) {
    if (error instanceof Error && error.message.includes('private key')) {
      return NextResponse.json(
        { error: error.message, installations: [], installUrl: null, setupUrl: '/setup' },
        { status: 409 },
      )
    }
    return accessErrorResponse(error)
  }
}

export async function POST() {
  return GET()
}
