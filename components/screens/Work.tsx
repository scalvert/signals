'use client'

import { useState, useMemo } from 'react'
import { Hammer, ExternalLink, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter'
import type { Task, TaskStatus } from '@/types/workspace'

const statusColors: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-muted', text: 'text-muted-foreground' },
  dispatched: { label: 'In Flight', bg: 'bg-[var(--health-b)]/10', text: 'text-[var(--health-b)]' },
  completed: { label: 'Completed', bg: 'bg-[var(--health-a)]/10', text: 'text-[var(--health-a)]' },
  verified: { label: 'Verified', bg: 'bg-[var(--health-a)]/20', text: 'text-[var(--health-a)]' },
  failed: { label: 'Failed', bg: 'bg-[var(--health-d)]/10', text: 'text-[var(--health-d)]' },
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusColors[status]
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', config.bg, config.text)}>
      {config.label}
    </span>
  )
}

async function handleDispatch(taskId: number, provider?: string) {
  await fetch(`/api/tasks/${taskId}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  })
  window.location.reload()
}

export function Work({ tasks }: { tasks: Task[] }) {
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [repoFilter, setRepoFilter] = useState<Set<string>>(new Set())

  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
    }
    return ['pending', 'dispatched', 'completed', 'verified', 'failed']
      .filter((s) => counts.has(s))
      .map((value) => ({ value, count: counts.get(value) ?? 0 }))
  }, [tasks])

  const repoOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) {
      const org = t.repoFullName.split('/')[0]
      counts.set(org, (counts.get(org) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (statusFilter.size > 0) result = result.filter((t) => statusFilter.has(t.status))
    if (repoFilter.size > 0) result = result.filter((t) => repoFilter.has(t.repoFullName.split('/')[0]))
    return result
  }, [tasks, statusFilter, repoFilter])

  if (tasks.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Hammer}
          title="No tasks yet"
          description="Create tasks from signals or failing health checks using the 'Fix this' or 'Fix' buttons."
        />
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-foreground">{filteredTasks.length} tasks</h2>
        <div className="flex items-center gap-2">
          <MultiSelectFilter label="Status" options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
          <MultiSelectFilter label="Org" options={repoOptions} selected={repoFilter} onChange={setRepoFilter} />
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/95">
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Task</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Provider</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ref</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredTasks.map((task) => (
              <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground text-[13px]">{task.title}</div>
                  <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono mt-0.5 inline-block">
                    {task.repoFullName}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-muted-foreground">
                    {task.sourceType === 'signal' ? 'Signal' : 'Check'}: {task.sourceId}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} />
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleDispatch(task.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Dispatch
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground">
                  {task.provider ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {task.providerRef ? (
                    <a href={task.providerRef} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                  {new Date(task.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
