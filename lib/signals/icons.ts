import {
  TrendingUp,
  UserPlus,
  TrendingDown,
  AlertCircle,
  Star,
  GitPullRequest,
  Activity,
  type LucideIcon,
} from 'lucide-react'

export interface SignalVisual {
  icon: LucideIcon
  color: string
  bg: string
}

const defaultVisual: SignalVisual = {
  icon: AlertCircle,
  color: 'text-muted-foreground',
  bg: 'bg-muted/10',
}

const registry: Record<string, SignalVisual> = {
  'star-spike': { icon: TrendingUp, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  'star-milestone': { icon: Star, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  'new-contributor': { icon: UserPlus, color: 'text-[var(--health-a)]', bg: 'bg-[var(--health-a)]/10' },
  'health-drop': { icon: TrendingDown, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
  'issue-flood': { icon: AlertCircle, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'stale-prs': { icon: GitPullRequest, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'stale-bot-prs': { icon: GitPullRequest, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'dormant-repo': { icon: Activity, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
  'pr-stale': { icon: GitPullRequest, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  milestone: { icon: Star, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  dormant: { icon: Activity, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
}

export function getSignalVisual(type: string): SignalVisual {
  return registry[type] ?? defaultVisual
}

export const severityBorder: Record<string, string> = {
  info: 'border-border',
  warning: 'border-[var(--health-c)]/30',
  critical: 'border-[var(--health-d)]/30',
}

export const severityBg: Record<string, string> = {
  info: '',
  warning: 'bg-[var(--health-c)]/3',
  critical: 'bg-[var(--health-d)]/3',
}
