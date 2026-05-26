'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, RefreshCcw, X } from 'lucide-react'
import { GitHubSourceSearch } from './GitHubSourceSearch'
import { SourceCard } from './SourceCard'
import type { GitHubInstallation, Workspace, WorkspaceSource } from '@/types/workspace'

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
  const [installations, setInstallations] = useState<GitHubInstallation[]>([])
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null)
  const [installUrl, setInstallUrl] = useState<string | null>(null)
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [loadingInstallations, setLoadingInstallations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function suggestedNameForInstallation(installation: GitHubInstallation) {
    return installation.accountType === 'User' ? 'Personal' : installation.accountLogin
  }

  function suggestedNameForSource(source: WorkspaceSource) {
    if (source.type === 'user') return 'Personal'
    if (source.type === 'org') return source.value
    return source.value.split('/').pop() ?? source.value
  }

  function applyDefaultName(nextName: string) {
    if (isEditing) return
    setName((current) => current.trim() ? current : nextName)
  }

  function selectInstallation(installationId: number) {
    setSelectedInstallationId(installationId)
    const installation = installations.find((item) => item.installationId === installationId)
    if (installation) applyDefaultName(suggestedNameForInstallation(installation))
  }

  function loadInstallations() {
    setError(null)
    setLoadingInstallations(true)
    fetch('/api/github/installations')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok && !data.error) {
          throw new Error(`Failed to load GitHub App installations (${res.status})`)
        }
        return data
      })
      .then((data) => {
        const nextInstallations = data.installations ?? []
        setInstallations(nextInstallations)
        setInstallUrl(data.installUrl ?? null)
        setSetupUrl(data.setupUrl ?? null)
        setError(data.error ?? null)
        if (!workspace?.githubInstallationId && nextInstallations.length === 1) {
          setSelectedInstallationId(nextInstallations[0].installationId)
          applyDefaultName(suggestedNameForInstallation(nextInstallations[0]))
        }
      })
      .catch((err) => {
        setInstallations([])
        setError(err instanceof Error ? err.message : 'Failed to load GitHub App installations')
      })
      .finally(() => setLoadingInstallations(false))
  }

  useEffect(() => {
    if (open) {
      setName(workspace?.name ?? '')
      setSources(workspace?.sources ?? [])
      setSelectedInstallationId(workspace?.githubInstallationId ?? null)
      loadInstallations()
    }
    // loadInstallations intentionally reads latest workspace state on dialog open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace])

  function addSource(source: WorkspaceSource) {
    if (sources.some((s) => s.type === source.type && s.value === source.value)) return
    setSources([...sources, source])
    applyDefaultName(suggestedNameForSource(source))
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  function updateSource(index: number, source: WorkspaceSource) {
    setSources(sources.map((s, i) => (i === index ? source : s)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || sources.length === 0 || !selectedInstallationId) return

    setSubmitting(true)
    setError(null)

    try {
      if (isEditing) {
        const res = await fetch(`/api/workspaces/${workspace.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), sources, githubInstallationId: selectedInstallationId }),
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
          body: JSON.stringify({ name: name.trim(), sources, githubInstallationId: selectedInstallationId }),
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
      <div className="relative w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pt-6 pb-3 flex flex-col gap-5 shrink-0">
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
                GitHub App installation
              </label>
              {loadingInstallations ? (
                <div className="text-[12px] text-muted-foreground">Loading installations...</div>
              ) : installations.length > 0 ? (
                <select
                  value={selectedInstallationId ?? ''}
                  onChange={(e) => selectInstallation(Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" disabled>Select an installation</option>
                  {installations.map((installation) => (
                    <option key={installation.installationId} value={installation.installationId}>
                      {installation.accountLogin} ({installation.accountType})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[12px] font-medium text-foreground">
                    Install the GitHub App to continue
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    The app exists, but it is not installed on any GitHub account
                    this user can access.
                  </p>
                  {setupUrl ? (
                    <div className="mt-3">
                      <a
                        href={setupUrl}
                        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-muted"
                      >
                        Reconnect the GitHub App
                      </a>
                    </div>
                  ) : installUrl && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background hover:bg-foreground/90"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Install GitHub App
                      </a>
                      <button
                        type="button"
                        onClick={loadInstallations}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-muted"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                Sources
              </label>
              <p className="mb-3 text-[12px] text-muted-foreground">
                Search for GitHub orgs, users, or repos to track.
              </p>

              {selectedInstallationId ? (
                <GitHubSourceSearch
                  existingSources={sources}
                  installationId={selectedInstallationId}
                  onAdd={addSource}
                />
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
                  Install and select a GitHub App installation before adding sources.
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            {sources.length > 0 && (
              <div className="flex flex-col gap-2">
                {sources.map((source, i) => (
                  <SourceCard
                    key={`${source.type}-${source.value}`}
                    source={source}
                    installationId={selectedInstallationId}
                    onRemove={() => removeSource(i)}
                    onChange={(updated) => updateSource(i, updated)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-3 shrink-0">
            {error && (
              <div className="mb-3 flex items-center justify-between gap-3 text-[12px] text-destructive">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={loadInstallations}
                  className="font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
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
              disabled={!name.trim() || sources.length === 0 || !selectedInstallationId || submitting}
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
          </div>
        </form>
      </div>
    </div>
  )
}
