'use client'

import { useState } from 'react'
import { ChevronDown, Building2, User, GitBranch, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SourceRepoSelector } from './SourceRepoSelector'
import type { WorkspaceSource, SourceRepoSelection } from '@/types/workspace'

interface SourceCardProps {
  source: WorkspaceSource
  onRemove: () => void
  onChange: (source: WorkspaceSource) => void
}

const defaultSelection: SourceRepoSelection = {
  mode: 'all',
  selected: [],
  visibility: 'all',
}

export function SourceCard({ source, onRemove, onChange }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [hasExpanded, setHasExpanded] = useState(false)
  const isExpandable = source.type === 'org' || source.type === 'user'
  const selection = source.repos ?? defaultSelection

  function handleSelectionChange(newSelection: SourceRepoSelection) {
    onChange({ ...source, repos: newSelection })
  }

  const TypeIcon = source.type === 'org' ? Building2 : source.type === 'user' ? User : GitBranch

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 bg-muted/50',
          isExpandable && 'cursor-pointer',
        )}
        onClick={() => { if (isExpandable) { setExpanded(!expanded); setHasExpanded(true) } }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpandable && (
            <ChevronDown className={cn(
              'w-3 h-3 text-muted-foreground transition-transform shrink-0',
              !expanded && '-rotate-90',
            )} />
          )}
          <TypeIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[13px] font-semibold truncate">{source.value}</span>
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
            {source.type}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="p-0.5 hover:bg-muted rounded transition-colors shrink-0 ml-2"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      {isExpandable && hasExpanded && (
        <div className={expanded ? '' : 'hidden'}>
          <SourceRepoSelector
            owner={source.value}
            type={source.type as 'org' | 'user'}
            selection={selection}
            onChange={handleSelectionChange}
          />
        </div>
      )}
    </div>
  )
}
