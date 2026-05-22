import Link from 'next/link'
import { PlugZap } from 'lucide-react'
import type { Workspace } from '@/types/workspace'

export function InstallationRequired({ workspace }: { workspace: Workspace }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <PlugZap className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-[16px] font-semibold text-foreground">
          GitHub App installation required
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          This workspace needs to be linked to a GitHub App installation before Signals can sync shared repository data.
        </p>
        <Link
          href={`/workspace/${workspace.slug}/settings`}
          className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open settings
        </Link>
      </div>
    </div>
  )
}

