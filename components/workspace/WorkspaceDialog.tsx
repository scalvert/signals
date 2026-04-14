'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Building2, GitBranch, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Workspace, WorkspaceSource } from '@/types/workspace'

interface WorkspaceDialogProps {
  open: boolean
  onClose: () => void
  workspace?: Workspace
}

export function WorkspaceDialog({ open, onClose, workspace }: WorkspaceDialogProps) {
  const router = useRouter()
  const isEditing = !!workspace
  const [name, setName] = useState('')
  const [sources, setSources] = useState<WorkspaceSource[]>([])
  const [sourceInput, setSourceInput] = useState('')
  const [sourceType, setSourceType] = useState<'org' | 'repo'>('org')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(workspace?.name ?? '')
      setSources(workspace?.sources ?? [])
      setSourceInput('')
      setError(null)
    }
  }, [open, workspace])

  function addSource() {
    const value = sourceInput.trim()
    if (!value) return
    if (sourceType === 'repo' && !value.includes('/')) {
      setError('Repo must be in owner/repo format (e.g. vercel/next.js)')
      return
    }
    if (sources.some((s) => s.type === sourceType && s.value === value)) return
    setError(null)
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
      if (isEditing) {
        const res = await fetch(`/api/workspaces/${workspace.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), sources }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to update workspace')
          setSubmitting(false)
          return
        }
        const updated = await res.json()
        onClose()
        router.push(`/workspace/${updated.slug}`)
        router.refresh()
      } else {
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
        const created = await res.json()
        onClose()
        router.push(`/workspace/${created.slug}`)
      }
    } catch {
      setError(isEditing ? 'Failed to update workspace' : 'Failed to create workspace')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">
            {isEditing ? 'Edit Workspace' : 'Create Workspace'}
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              Workspace name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My OSS Projects"
              autoFocus
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              Sources
            </label>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Add GitHub orgs or individual repos to track.
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
                  sourceType === 'org' ? 'e.g. gleanwork' : 'e.g. vercel/next.js'
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
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
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

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-md text-[13px] font-medium border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || sources.length === 0 || submitting}
              className="h-9 px-4 rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
