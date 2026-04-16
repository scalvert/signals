'use client'

import { useState } from 'react'

export function SetupConnect() {
  const [loading, setLoading] = useState(false)

  function handleConnect() {
    setLoading(true)
    const origin = window.location.origin

    const manifest = {
      name: `Signals (${window.location.hostname})`,
      url: origin,
      logo_url: 'https://raw.githubusercontent.com/scalvert/signals/main/public/signals-icon-black-512px.png',
      hook_attributes: { url: 'https://example.com/no-op' },
      redirect_url: `${origin}/api/github/setup-callback`,
      callback_urls: [`${origin}/api/auth/callback/github`],
      public: false,
      default_permissions: {
        contents: 'read',
        issues: 'read',
        pull_requests: 'read',
        members: 'read',
        metadata: 'read',
      },
      default_events: [],
    }

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = 'https://github.com/settings/apps/new?state=signals-setup'
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'manifest'
    input.value = JSON.stringify(manifest)
    form.appendChild(input)
    document.body.appendChild(form)
    form.submit()
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <img src="/signals-icon-black-128px.png" alt="Signals" className="w-16 h-16 dark:hidden" />
          <img src="/signals-icon-white-128px.png" alt="Signals" className="w-16 h-16 hidden dark:block" />
        </div>
        <h1 className="text-[24px] font-bold text-foreground mb-2">Welcome to Signals</h1>
        <p className="text-[14px] text-muted-foreground mb-8 leading-relaxed">
          Connect your GitHub account to start monitoring your repositories.
          This will create a GitHub App for authentication.
        </p>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="h-11 px-6 rounded-lg bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Redirecting to GitHub...' : 'Connect to GitHub'}
        </button>
        <p className="text-[11px] text-muted-foreground mt-4">
          This creates a GitHub App on your account for secure OAuth access.
          No manual configuration required.
        </p>
      </div>
    </div>
  )
}
