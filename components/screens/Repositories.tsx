'use client'

import { useState, useMemo } from 'react'
import { Star, AlertCircle, GitPullRequest, ChevronUp, ChevronDown, Search, X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import { HealthBadge } from '@/components/shared/HealthBadge'
import { PillarBar } from '@/components/shared/PillarBar'
import { languagePillColors } from '@/lib/constants'
import type { Repo, TriageStatus } from '@/types/workspace'

type SortKey = 'name' | 'score' | 'stars' | 'openIssues' | 'openPRs' | 'lastCommitAt'
type SortDir = 'asc' | 'desc'

const healthFilters: { label: string; value: TriageStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Healthy', value: 'healthy' },
  { label: 'Watch', value: 'watch' },
  { label: 'Critical', value: 'critical' },
]

const pillarLabels: Record<string, string> = {
  activity: 'Activity',
  community: 'Community',
  quality: 'Quality',
  security: 'Security',
}

function CheckResultItem({ checkId, result }: { checkId: string; result: Repo['checkResults'][string] }) {
  const passed = result.score >= 0.7
  const partial = result.score >= 0.4 && result.score < 0.7
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="mt-0.5 shrink-0">
        {passed ? (
          <CheckCircle2 className="w-4 h-4 text-[var(--health-a)]" />
        ) : partial ? (
          <AlertTriangle className="w-4 h-4 text-[var(--health-c)]" />
        ) : (
          <XCircle className="w-4 h-4 text-[var(--health-d)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-foreground">{result.checkName}</span>
          <span className="text-[11px] text-muted-foreground font-mono">{Math.round(result.score * 100)}%</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{result.label}</p>
        {result.actionable && (
          <p className="text-[11px] text-foreground mt-1 bg-muted/50 rounded px-2 py-1.5 leading-relaxed">
            {result.actionable}
          </p>
        )}
      </div>
    </div>
  )
}

function RepoDetailPanel({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const checks = repo.checkResults ?? {}
  const groupedChecks = Object.entries(checks).reduce<Record<string, [string, Repo['checkResults'][string]][]>>(
    (acc, [id, result]) => {
      const pillar = result.pillar
      if (!acc[pillar]) acc[pillar] = []
      acc[pillar].push([id, result])
      return acc
    },
    {},
  )

  const failingChecks = Object.entries(checks).filter(([, r]) => r.score < 0.7)

  return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground truncate">{repo.name}</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{repo.description}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors shrink-0 ml-2">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <HealthBadge grade={repo.grade} score={repo.score} />
          <span className={cn(
            'inline-flex px-2 py-0.5 rounded text-[11px] font-medium',
            languagePillColors[repo.language ?? ''] ?? 'text-muted-foreground bg-muted',
          )}>
            {repo.language ?? 'Unknown'}
          </span>
          <a href={repo.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline">
            GitHub
          </a>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Stars', value: repo.stars },
            { label: 'Issues', value: repo.openIssues },
            { label: 'PRs', value: repo.openPRs },
            { label: 'Updated', value: repo.lastCommitAt ? formatRelativeDate(repo.lastCommitAt) : '—' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[18px] font-bold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-3">Health Breakdown</h3>
          <div className="flex flex-col gap-3">
            <PillarBar label="Activity" value={repo.pillars.activity} />
            <PillarBar label="Community" value={repo.pillars.community} />
            <PillarBar label="Quality" value={repo.pillars.quality} />
            <PillarBar label="Security" value={repo.pillars.security} />
          </div>
        </div>

        {failingChecks.length > 0 && (
          <div>
            <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-2">
              Actions Needed ({failingChecks.length})
            </h3>
            <div className="divide-y divide-border">
              {failingChecks
                .sort(([, a], [, b]) => a.score - b.score)
                .map(([id, result]) => (
                  <CheckResultItem key={id} checkId={id} result={result} />
                ))}
            </div>
          </div>
        )}

        {Object.entries(groupedChecks).map(([pillar, checks]) => (
          <div key={pillar}>
            <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {pillarLabels[pillar] ?? pillar}
            </h3>
            <div className="divide-y divide-border">
              {checks.map(([id, result]) => (
                <CheckResultItem key={id} checkId={id} result={result} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Repositories({ repos }: { repos: Repo[] }) {
  const [search, setSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState<TriageStatus | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)

  const languages = useMemo(() => {
    const langs = new Set(repos.map((r) => r.language).filter(Boolean))
    return ['All', ...Array.from(langs)] as string[]
  }, [repos])
  const [langFilter, setLangFilter] = useState('All')

  const filteredRepos = useMemo(() => {
    let result = repos
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
      )
    }
    if (langFilter !== 'All') result = result.filter((r) => r.language === langFilter)
    if (healthFilter) result = result.filter((r) => r.triage === healthFilter)

    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'lastCommitAt') {
        const aDate = a.lastCommitAt ? new Date(a.lastCommitAt).getTime() : 0
        const bDate = b.lastCommitAt ? new Date(b.lastCommitAt).getTime() : 0
        cmp = aDate - bDate
      } else cmp = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [repos, search, langFilter, healthFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 p-6 gap-4 h-full">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories..."
              className="h-8 pl-8 pr-3 text-[12px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-64"
            />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Language:</span>
              {languages.slice(0, 6).map((lang) => (
                <button key={lang} onClick={() => setLangFilter(lang)}
                  className={cn('px-2 py-1 rounded text-[11px] font-medium transition-colors',
                    langFilter === lang ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}>
                  {lang}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Health:</span>
              {healthFilters.map((h) => (
                <button key={h.label} onClick={() => setHealthFilter(h.value)}
                  className={cn('px-2 py-1 rounded text-[11px] font-medium transition-colors',
                    healthFilter === h.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {([['name', 'Repository'], ['score', 'Health'], ['stars', 'Stars'], ['openIssues', 'Issues'], ['openPRs', 'PRs'], ['lastCommitAt', 'Last updated']] as const).map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key)}
                      className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none">
                      {label} <SortIcon col={key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRepos.map((repo) => (
                  <tr key={repo.id} onClick={() => setSelectedRepo(repo)}
                    className={cn('hover:bg-muted/30 transition-colors cursor-pointer', selectedRepo?.id === repo.id && 'bg-muted/50')}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground text-[13px]">{repo.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{repo.description}</div>
                    </td>
                    <td className="px-4 py-3"><HealthBadge grade={repo.grade} score={repo.score} /></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-muted-foreground"><Star className="w-3 h-3" />{repo.stars}</span></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-muted-foreground"><AlertCircle className="w-3 h-3" />{repo.openIssues}</span></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-muted-foreground"><GitPullRequest className="w-3 h-3" />{repo.openPRs}</span></td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {repo.lastCommitAt ? formatRelativeDate(repo.lastCommitAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedRepo && <RepoDetailPanel repo={selectedRepo} onClose={() => setSelectedRepo(null)} />}
    </div>
  )
}
