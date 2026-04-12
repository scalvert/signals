'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Building2, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceSource } from '@/types/workspace'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [sources, setSources] = useState<WorkspaceSource[]>([])
  const [sourceInput, setSourceInput] = useState('')
  const [sourceType, setSourceType] = useState<'org' | 'repo'>('org')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function addSource() {
    const value = sourceInput.trim()
    if (!value) return
    if (sources.some((s) => s.type === sourceType && s.value === value)) return
    setSources([...sources, { type: sourceType, value }])
    setSourceInput('')
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || sources.length === 0) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sources }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create workspace')
        setSubmitting(false)
        return
      }

      const workspace = await res.json()
      router.push(`/workspace/${workspace.slug}`)
    } catch {
      setError('Failed to create workspace')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">B</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome to Signals
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first workspace to start tracking your repositories.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-5">
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              Workspace name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My OSS Projects"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              Sources
            </label>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Add GitHub orgs or individual repos to track in this workspace.
            </p>

            <div className="mb-3 flex items-center gap-2">
              <div className="flex rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setSourceType('org')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors',
                    sourceType === 'org'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  Org
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('repo')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors',
                    sourceType === 'repo'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <GitBranch className="h-3 w-3" />
                  Repo
                </button>
              </div>
              <input
                type="text"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSource()
                  }
                }}
                placeholder={
                  sourceType === 'org'
                    ? 'e.g. gleanwork'
                    : 'e.g. vercel/next.js'
                }
                className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={addSource}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {sources.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {sources.map((source, i) => (
                  <div
                    key={`${source.type}-${source.value}`}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {source.type === 'org' ? (
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-[12px] font-medium text-foreground">
                        {source.value}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {source.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSource(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="mb-4 text-[12px] text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || sources.length === 0 || submitting}
            className="h-9 w-full rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  )
}
