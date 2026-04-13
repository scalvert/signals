'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, GitBranch, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Workspace } from '@/types/workspace'

interface AddMenuProps {
  workspace: Workspace
}

export function AddMenu({ workspace }: AddMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'org' | 'repo' | null>(null)
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!value.trim()) return
    setSubmitting(true)
    setError(null)

    const source = {
      type: dialog!,
      value: value.trim(),
    }

    const res = await fetch(`/api/workspaces/${workspace.id}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to add source')
      setSubmitting(false)
      return
    }

    setValue('')
    setDialog(null)
    setOpen(false)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setDialog(null); setError(null) }}
        className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
        title="Add new..."
      >
        <Plus className="w-4 h-4" />
      </button>

      {open && !dialog && (
        <div className="absolute right-0 top-10 z-50 w-56 bg-popover border border-border rounded-lg shadow-lg py-1">
          <button
            onClick={() => router.push('/setup')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left"
          >
            <Layers className="w-4 h-4 text-muted-foreground" />
            New workspace
          </button>
          <div className="h-px bg-border my-1" />
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Add to {workspace.name}
            </span>
          </div>
          <button
            onClick={() => { setDialog('org'); setError(null); setValue('') }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left"
          >
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Add organization
          </button>
          <button
            onClick={() => { setDialog('repo'); setError(null); setValue('') }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left"
          >
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            Add repository
          </button>
        </div>
      )}

      {open && dialog && (
        <div className="absolute right-0 top-10 z-50 w-72 bg-popover border border-border rounded-lg shadow-lg p-3">
          <div className="text-[12px] font-semibold text-foreground mb-2">
            {dialog === 'org' ? 'Add Organization' : 'Add Repository'}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setDialog(null); setOpen(false) }
            }}
            placeholder={dialog === 'org' ? 'e.g. facebook' : 'e.g. vercel/next.js'}
            autoFocus
            className="h-8 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring mb-2"
          />
          {error && (
            <p className="text-[11px] text-destructive mb-2">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setDialog(null); setOpen(false) }}
              className="h-7 px-2.5 text-[11px] font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!value.trim() || submitting}
              className="h-7 px-3 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setOpen(false); setDialog(null) }}
        />
      )}
    </div>
  )
}
