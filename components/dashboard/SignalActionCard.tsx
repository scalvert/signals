'use client'

import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Loader2, AlertTriangle, CheckCircle2, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getSignalVisual,
  severityBorder,
  severityBg,
} from '@/lib/signals/icons'
import type { DispatchTarget, Signal, Task } from '@/types/workspace'

const RESOLVED_STATUSES = new Set(['completed', 'failed', 'needs-attention'])
const POLL_INTERVAL_MS = 2000

interface Props {
  signal: Signal
  initialTask?: Task
  workspaceId: number
  canDispatch: boolean
  permissionReason?: string
  dispatchTarget?: DispatchTarget
  onChange?: () => void
}

export function SignalActionCard({
  signal,
  initialTask,
  workspaceId,
  canDispatch,
  permissionReason,
  dispatchTarget,
  onChange,
}: Props) {
  const visual = getSignalVisual(signal.type)
  const Icon = visual.icon
  const displayBody = signal.enrichedBody ?? signal.body

  const [task, setTask] = useState<Task | undefined>(initialTask)
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDismissForm, setShowDismissForm] = useState(false)
  const [dismissReason, setDismissReason] = useState('')
  const [selectedRunner, setSelectedRunner] = useState(
    dispatchTarget?.config.defaultRunner ?? 'codex',
  )

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (dispatchTarget?.config.defaultRunner) {
      setSelectedRunner(dispatchTarget.config.defaultRunner)
    }
  }, [dispatchTarget?.config.defaultRunner])

  useEffect(() => {
    if (!task) return
    if (task.status !== 'active') return
    if (RESOLVED_STATUSES.has(task.status)) return
    if (pollingRef.current) return

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}`)
        if (!res.ok) return
        const data = await res.json()
        setTask(data.task)
        if (RESOLVED_STATUSES.has(data.task.status) && pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          onChange?.()
        }
      } catch {
        /* keep polling */
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [task, onChange])

  async function handleDispatch() {
    setWorking(true)
    setError(null)
    setConfirming(false)
    try {
      let activeTask = task
      if (!activeTask) {
        const createRes = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            repoFullName: signal.repoFullName,
            title: signal.title,
            description: signal.enrichedBody ?? signal.body,
            sourceType: 'signal',
            sourceId: String(signal.id),
          }),
        })
        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}))
          if (createRes.status === 409 && body.task) {
            activeTask = body.task
          } else {
            throw new Error(body.error ?? `Failed to create task (${createRes.status})`)
          }
        } else {
          const body = await createRes.json()
          activeTask = body.task
        }
      }

      if (!activeTask) throw new Error('Could not create task')
      setTask(activeTask)

      const payload = dispatchTarget?.enabled
        ? JSON.stringify({ runner: selectedRunner })
        : undefined
      const dispatchRes = await fetch(`/api/tasks/${activeTask.id}/dispatch`, {
        method: 'POST',
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload,
      })
      if (!dispatchRes.ok) {
        const body = await dispatchRes.json().catch(() => ({}))
        throw new Error(body.error ?? `Dispatch failed (${dispatchRes.status})`)
      }
      const dispatched = await dispatchRes.json()
      setTask(dispatched.task ?? activeTask)
      onChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed')
    } finally {
      setWorking(false)
    }
  }

  async function handleDismiss() {
    if (!dismissReason.trim()) return
    await fetch(`/api/signals/${signal.id}/dismiss`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: dismissReason.trim() }),
    })
    setShowDismissForm(false)
    onChange?.()
  }

  const isPending = task?.status === 'pending'
  const isInFlight = task?.status === 'active'
  const isCompleted = task?.status === 'completed'
  const isFailed = task?.status === 'failed' || task?.status === 'needs-attention'
  const dispatchState = task?.dispatchState as {
    orchestrator?: string
    runner?: string
    executedByIdentity?: string
    externalId?: string
  } | null | undefined
  const runners = dispatchTarget?.enabled ? dispatchTarget.config.allowedRunners : []
  const showRunnerSelector = runners.length > 0

  return (
    <div
      className={cn(
        'border rounded-lg px-4 py-3 flex items-start gap-3',
        severityBorder[signal.severity],
        severityBg[signal.severity],
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5',
          visual.bg,
        )}
      >
        <Icon className={cn('w-4 h-4', visual.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[13px] font-semibold text-foreground leading-tight">
            {signal.title}
          </div>
          <div className="text-[11px] text-muted-foreground shrink-0">
            {new Date(signal.detectedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground leading-relaxed mt-1">
          {displayBody}
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {isInFlight && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--health-b)]">
              <Loader2 className="w-3 h-3 animate-spin" />
              {task?.statusLine ?? 'Dispatching…'}
            </span>
          )}
          {isPending && !working && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              Ready to dispatch
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--health-a)]">
              <CheckCircle2 className="w-3 h-3" />
              {task?.statusLine ?? 'Completed'}
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--health-d)]">
              <AlertTriangle className="w-3 h-3" />
              {task?.statusLine ?? 'Failed'}
            </span>
          )}
          {task?.resultRef && (
            <a
              href={task.resultRef}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </a>
          )}
          {dispatchState?.runner && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Rocket className="w-3 h-3" />
              {dispatchState.runner}
              {dispatchState.executedByIdentity ? ` as ${dispatchState.executedByIdentity}` : ''}
            </span>
          )}
          {(!task || isPending) && signal.fixable && !canDispatch && (
            <span className="text-[11px] text-muted-foreground">
              {permissionReason ?? 'Dispatch unavailable'}
            </span>
          )}
          {(!task || isPending) && signal.fixable && canDispatch && !confirming && !working && (
            <button
              onClick={() => setConfirming(true)}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Dispatch
            </button>
          )}
          {confirming && (
            <div className="inline-flex items-center gap-2 text-[11px] flex-wrap">
              <span className="text-muted-foreground">Run dispatch?</span>
              {showRunnerSelector && (
                <select
                  value={selectedRunner}
                  onChange={(e) => setSelectedRunner(e.target.value)}
                  className="h-6 rounded border border-border bg-background px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label="Agent runner"
                >
                  {runners.map((runner) => (
                    <option key={runner} value={runner}>
                      {runner}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleDispatch}
                className="font-medium text-primary hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
          {working && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Dispatching…
            </span>
          )}
          {isFailed && !working && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Retry
            </button>
          )}
          {!showDismissForm && !task && (
            <button
              onClick={() => setShowDismissForm(true)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          )}
        </div>

        {error && (
          <div className="mt-2 text-[11px] text-[var(--health-d)] bg-[var(--health-d)]/8 border border-[var(--health-d)]/20 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        {showDismissForm && (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Why is this signal not useful?"
              className="flex-1 h-7 px-2 text-[12px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleDismiss}
              disabled={!dismissReason.trim()}
              className="h-7 px-3 text-[11px] font-medium rounded bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              onClick={() => setShowDismissForm(false)}
              className="h-7 px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
