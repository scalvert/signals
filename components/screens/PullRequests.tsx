'use client'

import { useState, useMemo } from 'react'
import { GitMerge, Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import { isBot } from '@/lib/signals/definitions/utils'
import type { PullRequest } from '@/types/workspace'

const tagColors: Record<string, string> = {
  External: 'bg-muted text-foreground border-border',
  Stale: 'bg-[var(--health-c)]/10 text-[var(--health-c)] border-[var(--health-c)]/25',
  'CI failing': 'bg-[var(--health-d)]/10 text-[var(--health-d)] border-[var(--health-d)]/25',
}

const filterOptions = ['All', 'External', 'Stale', 'CI failing', 'Draft', 'Bot']

function getTags(pr: PullRequest): string[] {
  const tags: string[] = []
  if (pr.isExternal) tags.push('External')
  if (pr.isStale) tags.push('Stale')
  if (pr.ciState === 'failing') tags.push('CI failing')
  return tags
}

function getAttentionBorder(pr: PullRequest): string {
  if (pr.ciState === 'failing') return 'border-l-3 border-l-health-d'
  if (pr.isStale) return 'border-l-3 border-l-health-c'
  return 'border-l-3 border-l-health-a'
}

function getGroupBorder(prs: PullRequest[]): string {
  if (prs.some((pr) => pr.ciState === 'failing')) return 'border-l-3 border-l-health-d'
  if (prs.some((pr) => pr.isStale)) return 'border-l-3 border-l-health-c'
  return 'border-l-3 border-l-health-a'
}

function getGroupStats(prs: PullRequest[]) {
  const failing = prs.filter((pr) => pr.ciState === 'failing').length
  const stale = prs.filter((pr) => pr.isStale).length
  return { failing, stale }
}

function PRRow({ pr }: { pr: PullRequest }) {
  const tags = getTags(pr)
  const initials = pr.authorLogin.slice(0, 2).toUpperCase()
  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer', getAttentionBorder(pr))}>
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground truncate">{pr.title}</span>
          {pr.isDraft && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border text-muted-foreground">Draft</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/70">{pr.repoFullName.split('/')[1]}</span>
            {' · '}@{pr.authorLogin}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {tags.map((tag) => (
          <span key={tag} className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', tagColors[tag])}>
            {tag}
          </span>
        ))}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12px] text-muted-foreground">{formatRelativeDate(pr.updatedAt)}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground justify-end">
          <GitMerge className="w-3 h-3" />#{pr.number}
        </div>
      </div>
    </div>
  )
}

function BotGroupRow({ author, prs, isExpanded, onToggle }: {
  author: string
  prs: PullRequest[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const { failing, stale } = getGroupStats(prs)
  const Chevron = isExpanded ? ChevronDown : ChevronRight

  return (
    <>
      <div
        onClick={onToggle}
        className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer', getGroupBorder(prs))}>
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">{author}</span>
            <span className="text-[11px] text-muted-foreground">· {prs.length} PR{prs.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {failing > 0 && (
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', tagColors['CI failing'])}>
              CI failing: {failing}
            </span>
          )}
          {stale > 0 && (
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', tagColors['Stale'])}>
              Stale: {stale}
            </span>
          )}
        </div>
        <Chevron className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      {isExpanded && prs.map((pr) => (
        <div key={`${pr.repoFullName}#${pr.number}`} className="bg-muted/10">
          <PRRow pr={pr} />
        </div>
      ))}
    </>
  )
}

export function PullRequests({ prs }: { prs: PullRequest[] }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set())

  const filtered = prs.filter((pr) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Draft') return pr.isDraft
    if (activeFilter === 'Bot') return isBot(pr.authorLogin)
    return getTags(pr).includes(activeFilter)
  })

  const { humanPRs, botGroups } = useMemo(() => {
    const human: PullRequest[] = []
    const bots = new Map<string, PullRequest[]>()

    for (const pr of filtered) {
      if (isBot(pr.authorLogin)) {
        const group = bots.get(pr.authorLogin) ?? []
        group.push(pr)
        bots.set(pr.authorLogin, group)
      } else {
        human.push(pr)
      }
    }

    return { humanPRs: human, botGroups: bots }
  }, [filtered])

  const toggleBot = (author: string) => {
    setExpandedBots((prev) => {
      const next = new Set(prev)
      if (next.has(author)) next.delete(author)
      else next.add(author)
      return next
    })
  }

  const totalCount = humanPRs.length + Array.from(botGroups.values()).reduce((sum, g) => sum + g.length, 0)

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-[12px] font-medium border transition-colors',
              activeFilter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">{totalCount} PRs</span>
      </div>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {humanPRs.map((pr) => (
          <PRRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} />
        ))}
        {Array.from(botGroups.entries()).map(([author, groupPrs]) => (
          <BotGroupRow
            key={author}
            author={author}
            prs={groupPrs}
            isExpanded={expandedBots.has(author)}
            onToggle={() => toggleBot(author)}
          />
        ))}
        {totalCount === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No pull requests match this filter.</div>
        )}
      </div>
    </div>
  )
}
