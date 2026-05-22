'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, Hammer } from 'lucide-react'
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter'
import { EmptyState } from '@/components/shared/EmptyState'
import { RepoRow } from '@/components/dashboard/RepoRow'
import type { RepoDashboardRow } from '@/lib/db/queries'

type FilterMode = 'all' | 'has-signal' | 'tasks'
type SortKey = 'health-desc' | 'health-asc' | 'name' | 'signals' | 'recent-activity'

const healthColors: Record<string, string> = {
  healthy: 'var(--health-a)',
  watch: 'var(--health-c)',
  critical: 'var(--health-d)',
}

interface Props {
  rows: RepoDashboardRow[]
  workspaceId: number
}

export function Dashboard({ rows, workspaceId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const initialFilter = (searchParams.get('filter') as FilterMode | null) ?? 'all'
  const initialQ = searchParams.get('q') ?? ''
  const initialOrg = new Set((searchParams.get('org') ?? '').split(',').filter(Boolean))
  const initialSeverity = new Set((searchParams.get('severity') ?? '').split(',').filter(Boolean))
  const initialHealth = new Set((searchParams.get('health') ?? '').split(',').filter(Boolean))
  const initialSort = (searchParams.get('sort') as SortKey | null) ?? 'health-asc'
  const initialExpanded = new Set((searchParams.get('expanded') ?? '').split(',').filter(Boolean))

  const [filterMode, setFilterMode] = useState<FilterMode>(initialFilter)
  const [search, setSearch] = useState<string>(initialQ)
  const [orgFilter, setOrgFilter] = useState<Set<string>>(initialOrg)
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(initialSeverity)
  const [healthFilter, setHealthFilter] = useState<Set<string>>(initialHealth)
  const [sortKey, setSortKey] = useState<SortKey>(initialSort)
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filterMode !== 'all') params.set('filter', filterMode)
    if (search) params.set('q', search)
    if (orgFilter.size > 0) params.set('org', Array.from(orgFilter).join(','))
    if (severityFilter.size > 0) params.set('severity', Array.from(severityFilter).join(','))
    if (healthFilter.size > 0) params.set('health', Array.from(healthFilter).join(','))
    if (sortKey !== 'health-asc') params.set('sort', sortKey)
    if (expanded.size > 0) params.set('expanded', Array.from(expanded).join(','))
    const query = params.toString()
    const url = query ? `${pathname}?${query}` : pathname
    startTransition(() => {
      router.replace(url, { scroll: false })
    })
  }, [filterMode, search, orgFilter, severityFilter, healthFilter, sortKey, expanded, pathname, router])

  const orgOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const org = r.repo.fullName.split('/')[0]
      counts.set(org, (counts.get(org) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [rows])

  const severityOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      for (const s of r.signals) counts.set(s.severity, (counts.get(s.severity) ?? 0) + 1)
    }
    return ['critical', 'warning', 'info']
      .filter((s) => counts.has(s))
      .map((value) => ({ value, count: counts.get(value) ?? 0 }))
  }, [rows])

  const healthOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.repo.triage, (counts.get(r.repo.triage) ?? 0) + 1)
    return ['critical', 'watch', 'healthy']
      .filter((t) => counts.has(t))
      .map((value) => ({ value, count: counts.get(value) ?? 0, color: healthColors[value] }))
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (filterMode === 'has-signal') result = result.filter((r) => r.signals.length > 0)
    if (filterMode === 'tasks') result = result.filter((r) => r.activeTaskCount > 0 || r.recentTasks.some((t) => t.status === 'pending'))
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) => r.repo.fullName.toLowerCase().includes(q) || r.repo.description?.toLowerCase().includes(q),
      )
    }
    if (orgFilter.size > 0) result = result.filter((r) => orgFilter.has(r.repo.fullName.split('/')[0]))
    if (healthFilter.size > 0) result = result.filter((r) => healthFilter.has(r.repo.triage))
    if (severityFilter.size > 0) result = result.filter((r) => r.signals.some((s) => severityFilter.has(s.severity)))

    return [...result].sort((a, b) => {
      switch (sortKey) {
        case 'health-asc':
          return a.repo.score - b.repo.score
        case 'health-desc':
          return b.repo.score - a.repo.score
        case 'name':
          return a.repo.fullName.localeCompare(b.repo.fullName)
        case 'signals':
          return b.signals.length - a.signals.length
        case 'recent-activity': {
          const aTime = a.repo.lastCommitAt ? new Date(a.repo.lastCommitAt).getTime() : 0
          const bTime = b.repo.lastCommitAt ? new Date(b.repo.lastCommitAt).getTime() : 0
          return bTime - aTime
        }
      }
    })
  }, [rows, filterMode, search, orgFilter, healthFilter, severityFilter, sortKey])

  const totalSignals = rows.reduce((acc, r) => acc + r.signals.length, 0)
  const totalActiveTasks = rows.reduce((acc, r) => acc + r.activeTaskCount, 0)

  function toggleExpanded(fullName: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  function refresh() {
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Hammer}
          title="No repos yet"
          description="Sync your workspace to see repositories here."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-muted rounded-md p-0.5 text-[12px] font-medium">
          {(
            [
              ['all', `All (${rows.length})`],
              ['has-signal', `Signals (${totalSignals})`],
              ['tasks', `Tasks (${totalActiveTasks})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterMode(key)}
              className={`px-3 py-1 rounded transition-colors ${
                filterMode === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos…"
            className="h-8 pl-8 pr-3 text-[12px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-56"
          />
        </div>

        <div className="flex items-center gap-2">
          <MultiSelectFilter label="Org" options={orgOptions} selected={orgFilter} onChange={setOrgFilter} />
          <MultiSelectFilter label="Health" options={healthOptions} selected={healthFilter} onChange={setHealthFilter} />
          <MultiSelectFilter label="Severity" options={severityOptions} selected={severityFilter} onChange={setSeverityFilter} />
        </div>

        <div className="ml-auto">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-8 px-2 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="health-asc">Sort: Health (worst first)</option>
            <option value="health-desc">Sort: Health (best first)</option>
            <option value="signals">Sort: Signal count</option>
            <option value="recent-activity">Sort: Recent activity</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="text-[13px] text-muted-foreground text-center py-12 italic">
            No repos match the current filters.
          </div>
        ) : (
          filtered.map((row) => (
            <RepoRow
              key={row.repo.id}
              row={row}
              expanded={expanded.has(row.repo.fullName)}
              onToggle={() => toggleExpanded(row.repo.fullName)}
              workspaceId={workspaceId}
              onChange={refresh}
            />
          ))
        )}
      </div>
    </div>
  )
}
