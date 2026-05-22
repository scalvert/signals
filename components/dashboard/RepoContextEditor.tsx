'use client'

import { useState, useEffect } from 'react'

interface Props {
  workspaceId: number
  repoFullName: string
}

export function RepoContextEditor({ workspaceId, repoFullName }: Props) {
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/repo-context?workspaceId=${workspaceId}&repo=${encodeURIComponent(repoFullName)}`)
      .then((r) => r.json())
      .then((data) => {
        setContext(data.context?.context ?? '')
        setLoading(false)
      })
  }, [workspaceId, repoFullName])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/repo-context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, repoFullName, context }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div>
      <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-2">
        Context
      </h3>
      <p className="text-[11px] text-muted-foreground mb-2">
        Describe this repo&apos;s expected behavior. This shapes signal detection and feed generation.
      </p>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={3}
        className="w-full text-[12px] rounded border border-border bg-background text-foreground px-2 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        placeholder="e.g., Low cadence repo — only updated when upstream API changes."
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-7 px-3 text-[11px] font-medium rounded bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && <span className="text-[11px] text-[var(--health-a)]">Saved</span>}
      </div>
    </div>
  )
}
