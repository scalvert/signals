'use client'

import { CheckCircle2, Loader2, AlertTriangle, Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types/workspace'

const statusConfig: Record<TaskStatus, { icon: typeof CheckCircle2; color: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground' },
  active: { icon: Loader2, color: 'text-[var(--health-b)]' },
  completed: { icon: CheckCircle2, color: 'text-[var(--health-a)]' },
  failed: { icon: AlertTriangle, color: 'text-[var(--health-d)]' },
  'needs-attention': { icon: AlertTriangle, color: 'text-[var(--health-c)]' },
}

export function TaskTimeline({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground italic">No recent tasks.</div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => {
        const config = statusConfig[task.status]
        const Icon = config.icon
        const animate = task.status === 'active'
        const subtitle = task.statusLine ?? task.title
        const timeRef = task.completedAt ?? task.dispatchedAt ?? task.createdAt
        return (
          <div key={task.id} className="flex items-start gap-2 text-[11px]">
            <Icon className={cn('w-3 h-3 mt-0.5 shrink-0', config.color, animate && 'animate-spin')} />
            <div className="flex-1 min-w-0">
              <div className="text-foreground truncate">{task.title}</div>
              {task.statusLine && task.statusLine !== task.title && (
                <div className="text-muted-foreground truncate">{subtitle}</div>
              )}
            </div>
            {task.resultRef && (
              <a
                href={task.resultRef}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <span className="text-muted-foreground shrink-0 whitespace-nowrap">
              {formatRelativeDate(timeRef)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
