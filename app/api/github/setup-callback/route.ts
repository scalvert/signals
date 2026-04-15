import { NextResponse } from 'next/server'
import { setSetting } from '@/lib/db/queries'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/setup', req.url))
  }

  try {
    const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[signals] Manifest conversion failed:', res.status)
      return NextResponse.redirect(new URL('/setup?error=manifest_failed', req.url))
    }

    const data = await res.json()

    setSetting('github.app.id', String(data.id))
    setSetting('github.app.clientId', data.client_id)
    setSetting('github.app.clientSecret', data.client_secret)
    setSetting('github.app.name', data.name)

    console.info('[signals] GitHub App created:', data.name)

    return NextResponse.redirect(new URL('/api/auth/signin/github', req.url))
  } catch (err) {
    console.error('[signals] Setup callback error:', err)
    return NextResponse.redirect(new URL('/setup?error=unknown', req.url))
  }
}
