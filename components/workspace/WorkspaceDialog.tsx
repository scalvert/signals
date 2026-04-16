'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { GitHubSourceSearch } from './GitHubSourceSearch'
import { SourceCard } from './SourceCard'
import type { Workspace, WorkspaceSource } from '@/types/workspace'

interface WorkspaceDialogProps {
  open: boolean
  onClose: () => void
  workspace?: Workspace
  dismissable?: boolean
}

export function WorkspaceDialog({ open, onClose, workspace, dismissable = true }: WorkspaceDialogProps) {
  const router = useRouter()
  const isEditing = !!workspace
  const [name, setName] = useState('')
  const [sources, setSources] = useState<WorkspaceSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(workspace?.name ?? '')
      setSources(workspace?.sources ?? [])
      setError(null)
    }
  }, [open, workspace])

  function addSource(source: WorkspaceSource) {
    if (sources.some((s) => s.type === source.type && s.value === source.value)) return
    setSources([...sources, source])
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  function updateSource(index: number, source: WorkspaceSource) {
    setSources(sources.map((s, i) => (i === index ? source : s)))
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
        fetch(`/api/sync?slug=${created.slug}`, { method: 'POST' })
      }
    } catch {
      setError(isEditing ? 'Failed to update workspace' : 'Failed to create workspace')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={dismissable ? onClose : undefined} />
      <div className="relative w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl max-h-[85vh] flex flex-col overflow-visible">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold text-foreground">
            {isEditing ? 'Edit Workspace' : 'Create Workspace'}
          </h2>
          {dismissable && (
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 flex-1">
          <div>
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

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              Sources
            </label>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Search for GitHub orgs, users, or repos to track.
            </p>

            <div className="mb-3">
              <GitHubSourceSearch existingSources={sources} onAdd={addSource} />
            </div>

            {sources.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
                {sources.map((source, i) => (
                  <SourceCard
                    key={`${source.type}-${source.value}`}
                    source={source}
                    onRemove={() => removeSource(i)}
                    onChange={(updated) => updateSource(i, updated)}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-[12px] text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-md text-[13px] font-medium border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            )}
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
