'use client'

import { WorkspaceDialog } from '@/components/workspace/WorkspaceDialog'

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <img
          src="/signals-icon.png"
          alt="Signals"
          className="w-12 h-12 mx-auto mb-4"
        />
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome to Signals
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first workspace to start tracking your repositories.
        </p>
      </div>
      <WorkspaceDialog open onClose={() => {}} />
    </div>
  )
}
