'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TrendingUp, UserPlus, TrendingDown, AlertCircle, Star, GitPullRequest, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Signal, SignalType } from '@/types/workspace'

const signalMeta: Record<SignalType, {
  icon: React.ElementType
  color: string
  whyItMatters: string
  whatToDo: string
}> = {
  'star-spike': {
    icon: TrendingUp,
    color: 'text-[var(--health-b)]',
    whyItMatters: 'A sudden increase in stars often indicates external attention — a blog post, HN mention, or newsletter feature. This is a growth opportunity.',
    whatToDo: 'Check referral sources (GitHub traffic analytics). Ensure README, contributing guide, and issues are welcoming for new visitors.',
  },
  'new-contributor': {
    icon: UserPlus,
    color: 'text-[var(--health-a)]',
    whyItMatters: 'First-time contributors are the lifeblood of OSS. A positive first experience increases the chance they come back.',
    whatToDo: 'Review and respond to their PR promptly. Leave encouraging feedback. Consider adding a "good first issue" label to related issues.',
  },
  'health-drop': {
    icon: TrendingDown,
    color: 'text-[var(--health-d)]',
    whyItMatters: 'A declining health score means the repo is losing momentum or quality signals. Left unchecked, this leads to stale issues, contributor churn, and user attrition.',
    whatToDo: 'Check which health pillars declined (activity, community, quality, security). Focus on the lowest-scoring checks first.',
  },
  'issue-flood': {
    icon: AlertCircle,
    color: 'text-[var(--health-c)]',
    whyItMatters: 'A spike in issues can indicate a breaking release, a security vulnerability disclosure, or sudden popularity. Triaging quickly prevents backlog buildup.',
    whatToDo: 'Scan for patterns — are issues about the same topic? Label and categorize. Consider a pinned issue or discussion if it is a known problem.',
  },
  'pr-stale': {
    icon: GitPullRequest,
    color: 'text-[var(--health-c)]',
    whyItMatters: 'Stale PRs signal slow review processes. External contributor PRs left unreviewed discourage future contributions.',
    whatToDo: 'Review or close stale PRs. If you cannot review immediately, leave a comment acknowledging the contribution and set a timeline.',
  },
  'milestone': {
    icon: Star,
    color: 'text-[var(--health-b)]',
    whyItMatters: 'Star milestones are community recognition moments. They are great opportunities for celebration and promotion.',
    whatToDo: 'Consider a celebratory tweet, changelog entry, or thank-you to contributors. Update the README if it showcases star count.',
  },
  'dormant': {
    icon: Activity,
    color: 'text-[var(--health-d)]',
    whyItMatters: 'Repos without commits appear abandoned to users and potential contributors. Open issues and PRs go unanswered.',
    whatToDo: 'If the repo is stable and intentionally quiet, add a maintenance notice to the README. If it needs work, schedule a triage session for open issues.',
  },
}

interface SignalPanelProps {
  signal: Signal | null
  open: boolean
  onClose: () => void
}

export function SignalPanel({ signal, open, onClose }: SignalPanelProps) {
  if (!signal) return null

  const meta = signalMeta[signal.type]
  const Icon = meta.icon
  const metadata = signal.metadata as Record<string, unknown>

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto p-6">
        <SheetHeader className="mb-5">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', `bg-${meta.color.replace('text-', '')}/10`)}>
              <Icon className={cn('w-4 h-4', meta.color)} />
            </div>
            <SheetTitle className="text-[15px] leading-tight">{signal.title}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5">
          <Section title="What happened">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {signal.enrichedBody ?? signal.body}
            </p>
            <div className="mt-2">
              <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
                {signal.repoFullName}
              </span>
              <span className="text-[11px] text-muted-foreground ml-2">
                {new Date(signal.detectedAt).toLocaleDateString()}
              </span>
            </div>
          </Section>

          {Object.keys(metadata).length > 0 && (() => {
            const simpleEntries = Object.entries(metadata).filter(
              ([, v]) => typeof v !== 'object' || v === null,
            )
            if (simpleEntries.length === 0) return null
            return (
              <Section title="Details">
                <div className="grid grid-cols-2 gap-2">
                  {simpleEntries.map(([key, value]) => (
                    <div key={key} className="bg-muted/50 rounded px-2.5 py-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{formatKey(key)}</div>
                      <div className="text-[13px] font-semibold text-foreground mt-0.5">{formatValue(value)}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )
          })()}

          <Section title="Why it matters">
            <p className="text-[12px] text-muted-foreground leading-relaxed">{meta.whyItMatters}</p>
          </Section>

          <Section title="What to do">
            <p className="text-[12px] text-muted-foreground leading-relaxed">{meta.whatToDo}</p>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  )
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length.toString()
  return String(value)
}
