'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink, RefreshCcw } from 'lucide-react'

interface InstallGitHubAppProps {
  installUrl: string | null
  error?: string
}

export function InstallGitHubApp({ installUrl, error }: InstallGitHubAppProps) {
  const router = useRouter()

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <img src="/signals-icon-black-128px.png" alt="Signals" className="h-16 w-16 dark:hidden" />
          <img src="/signals-icon-white-128px.png" alt="Signals" className="hidden h-16 w-16 dark:block" />
        </div>
        <h1 className="mb-2 text-[24px] font-bold text-foreground">Install Signals on GitHub</h1>
        <p className="mb-6 text-[14px] leading-relaxed text-muted-foreground">
          The GitHub App was created. Install it on your GitHub account or org so
          Signals can read repositories through the app installation.
        </p>
        <div className="flex justify-center gap-2">
          {installUrl && (
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-5 text-[14px] font-semibold text-background transition-colors hover:bg-foreground/90"
            >
              <ExternalLink className="h-4 w-4" />
              Install GitHub App
            </a>
          )}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </button>
        </div>
        {error && (
          <p className="mt-4 text-[12px] text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
