'use client'

import { useState, useMemo, useEffect } from 'react'
import { Star, AlertCircle, GitPullRequest, ChevronUp, ChevronDown, Search, X, CheckCircle2, XCircle, AlertTriangle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import { HealthBadge } from '@/components/shared/HealthBadge'
import { PillarBar } from '@/components/shared/PillarBar'
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter'
import { languagePillColors } from '@/lib/constants'
import type { Repo } from '@/types/workspace'

type SortKey = 'name' | 'org' | 'score' | 'stars' | 'openIssues' | 'openPRs' | 'lastCommitAt'
type SortDir = 'asc' | 'desc'

const pillarLabels: Record<string, string> = {
  activity: 'Activity',
  community: 'Community',
  quality: 'Quality',
  security: 'Security',
}

function CheckResultItem({ checkId, result, isDismissed, onToggleDismiss, onFix }: {
  checkId: string
  result: Repo['checkResults'][string]
  isDismissed?: boolean
  onToggleDismiss?: () => void
  onFix?: () => void
}) {
  const passed = result.score >= 0.7
  const partial = result.score >= 0.4 && result.score < 0.7
  return (
    <div className={cn('flex items-start gap-2.5 py-2', isDismissed && 'opacity-40')}>
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
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">{Math.round(result.score * 100)}%</span>
            {!isDismissed && onFix && (
              <button
                onClick={onFix}
                className="text-[10px] font-medium text-primary hover:underline transition-colors"
              >
                Fix
              </button>
            )}
            {onToggleDismiss && (
              <button
                onClick={onToggleDismiss}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isDismissed ? 'Restore' : 'Dismiss'}
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{result.label}</p>
        {!isDismissed && result.actionable && (
          <p className="text-[11px] text-foreground mt-1 bg-muted/50 rounded px-2 py-1.5 leading-relaxed">
            {result.actionable}
          </p>
        )}
      </div>
    </div>
  )
}

function RepoContextEditor({ workspaceId, repoFullName }: { workspaceId: number; repoFullName: string }) {
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

function RepoDetailPanel({ repo, workspaceId, onClose }: { repo: Repo; workspaceId: number; onClose: () => void }) {
  const [dismissedChecks, setDismissedChecks] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/repo-context?workspaceId=${workspaceId}&repo=${encodeURIComponent(repo.fullName)}`)
      .then((r) => r.json())
      .then((data) => {
        setDismissedChecks(new Set(data.context?.dismissedChecks ?? []))
      })
  }, [workspaceId, repo.fullName])

  async function toggleCheck(checkId: string) {
    const res = await fetch('/api/repo-context/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, repoFullName: repo.fullName, checkId }),
    })
    const data = await res.json()
    setDismissedChecks(new Set(data.dismissedChecks))
  }

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

  const failingChecks = Object.entries(checks).filter(([id, r]) => r.score < 0.7 && !dismissedChecks.has(id))
  const dismissedFailingChecks = Object.entries(checks).filter(([id, r]) => r.score < 0.7 && dismissedChecks.has(id))

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

        <RepoContextEditor workspaceId={workspaceId} repoFullName={repo.fullName} />

        {(failingChecks.length > 0 || dismissedFailingChecks.length > 0) && (
          <div>
            <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-2">
              Actions Needed ({failingChecks.length})
            </h3>
            <div className="divide-y divide-border">
              {failingChecks
                .sort(([, a], [, b]) => a.score - b.score)
                .map(([id, result]) => (
                  <CheckResultItem key={id} checkId={id} result={result} onToggleDismiss={() => toggleCheck(id)} onFix={result.fixable ? async () => {
                    await fetch('/api/tasks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        workspaceId,
                        repoFullName: repo.fullName,
                        title: `${result.checkName} on ${repo.name}`,
                        description: result.actionable ?? result.label,
                        sourceType: 'check',
                        sourceId: id,
                      }),
                    })
                  } : undefined} />
                ))}
              {dismissedFailingChecks
                .sort(([, a], [, b]) => a.score - b.score)
                .map(([id, result]) => (
                  <CheckResultItem key={id} checkId={id} result={result} isDismissed onToggleDismiss={() => toggleCheck(id)} />
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

function getOrg(repo: Repo): string {
  return repo.fullName.split('/')[0]
}

export function Repositories({ repos, workspaceId }: { repos: Repo[]; workspaceId: number }) {
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState<Set<string>>(new Set())
  const [langFilter, setLangFilter] = useState<Set<string>>(new Set())
  const [healthFilter, setHealthFilter] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)

  const orgOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of repos) {
      const org = getOrg(r)
      counts.set(org, (counts.get(org) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [repos])

  const langOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of repos) {
      const lang = r.language ?? 'Unknown'
      counts.set(lang, (counts.get(lang) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [repos])

  const healthColors: Record<string, string> = {
    healthy: 'var(--health-a)',
    watch: 'var(--health-c)',
    critical: 'var(--health-d)',
  }

  const healthOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of repos) {
      counts.set(r.triage, (counts.get(r.triage) ?? 0) + 1)
    }
    return ['healthy', 'watch', 'critical']
      .filter((t) => counts.has(t))
      .map((value) => ({ value, count: counts.get(value) ?? 0, color: healthColors[value] }))
  }, [repos])

  const filteredRepos = useMemo(() => {
    let result = repos
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
      )
    }
    if (orgFilter.size > 0) result = result.filter((r) => orgFilter.has(getOrg(r)))
    if (langFilter.size > 0) result = result.filter((r) => langFilter.has(r.language ?? 'Unknown'))
    if (healthFilter.size > 0) result = result.filter((r) => healthFilter.has(r.triage))

    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'org') cmp = getOrg(a).localeCompare(getOrg(b))
      else if (sortKey === 'lastCommitAt') {
        const aDate = a.lastCommitAt ? new Date(a.lastCommitAt).getTime() : 0
        const bDate = b.lastCommitAt ? new Date(b.lastCommitAt).getTime() : 0
        cmp = aDate - bDate
      } else cmp = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [repos, search, orgFilter, langFilter, healthFilter, sortKey, sortDir])

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
          <div className="ml-auto flex items-center gap-2">
            <MultiSelectFilter label="Org" options={orgOptions} selected={orgFilter} onChange={setOrgFilter} />
            <MultiSelectFilter label="Language" options={langOptions} selected={langFilter} onChange={setLangFilter} />
            <MultiSelectFilter label="Health" options={healthOptions} selected={healthFilter} onChange={setHealthFilter} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {([['name', 'Repository'], ['org', 'Org'], ['score', 'Health'], ['stars', 'Stars'], ['openIssues', 'Issues'], ['openPRs', 'PRs'], ['lastCommitAt', 'Last updated']] as const).map(([key, label]) => (
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
                      <div className="font-semibold text-foreground text-[13px] flex items-center gap-1.5">
                        {repo.name}
                        {repo.isPrivate && <Lock className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{repo.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
                        {getOrg(repo)}
                      </span>
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
      {selectedRepo && <RepoDetailPanel repo={selectedRepo} workspaceId={workspaceId} onClose={() => setSelectedRepo(null)} />}
    </div>
  )
}
