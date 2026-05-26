import { NextResponse } from 'next/server'
import { AccessError, requireSession, accessErrorResponse } from '@/lib/auth/access'
import { listVisibleInstallations } from '@/lib/github/installations'
import { getSetting } from '@/lib/db/queries'

function getInstallUrl() {
  const slug = getSetting('github.app.slug')
  return slug
    ? `https://github.com/apps/${slug}/installations/new`
    : null
}

export async function GET() {
  try {
    const { githubLogin } = await requireSession()
    const installations = await listVisibleInstallations(githubLogin)
    const installUrl = getInstallUrl()

    return NextResponse.json({ installations, installUrl })
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error)
    if (error instanceof Error && error.message.includes('private key')) {
      return NextResponse.json(
        { error: error.message, installations: [], installUrl: null, setupUrl: '/setup' },
        { status: 409 },
      )
    }
    console.error('[signals] Failed to load GitHub App installations:', error)
    return NextResponse.json(
      {
        error: 'Failed to load GitHub App installations.',
        installations: [],
        installUrl: getInstallUrl(),
      },
      { status: 502 },
    )
  }
}

export async function POST() {
  return GET()
}
