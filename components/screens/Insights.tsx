'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Repo, PullRequest } from '@/types/workspace'
import type { ScoreSnapshot } from '@/lib/db/queries'

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'hsl(var(--foreground))',
}

function InsightCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      {children}
    </div>
  )
}

function shortName(name: string) {
  if (name.length <= 10) return name
  return name.slice(0, 8) + '…'
}

const BOT_PATTERNS = ['[bot]', 'dependabot', 'renovate', 'greenkeeper', 'snyk-bot', 'github-actions']

function classifyAuthor(login: string): 'bot' | 'human' {
  const lower = login.toLowerCase()
  return BOT_PATTERNS.some((p) => lower.includes(p)) ? 'bot' : 'human'
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

interface InsightsProps {
  repos: Repo[]
  prs: PullRequest[]
  scoreHistory: ScoreSnapshot[]
}

export function Insights({ repos, prs, scoreHistory }: InsightsProps) {
  const starsByRepo = repos
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10)
    .map((r) => ({ name: r.name, stars: r.stars }))

  const healthByRepo = repos
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map((r) => ({ name: r.name, score: r.score }))

  const issuesByRepo = repos
    .filter((r) => r.openIssues > 0)
    .sort((a, b) => b.openIssues - a.openIssues)
    .slice(0, 10)
    .map((r) => ({ name: r.name, issues: r.openIssues }))

  const prsByRepo = repos
    .filter((r) => r.openPRs > 0)
    .sort((a, b) => b.openPRs - a.openPRs)
    .slice(0, 10)
    .map((r) => ({ name: r.name, prs: r.openPRs }))

  const trendData = buildTrendData(scoreHistory)

  const prClassification = classifyPRs(prs)

  const prAgeBuckets = buildPRAgeBuckets(prs)

  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-[13px] font-semibold text-foreground">Insights</h2>
      <div className="grid grid-cols-2 gap-4">
        {trendData.length > 1 && (
          <InsightCard title="Health Score Trend (avg across repos)">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="avgScore" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </InsightCard>
        )}

        {prClassification.length > 0 && (
          <InsightCard title="PR Authors: Human vs Bot">
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={prClassification} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                    {prClassification.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {prClassification.map((item, i) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[12px] text-foreground">{item.type}</span>
                    <span className="text-[11px] text-muted-foreground">{item.count} PRs</span>
                  </div>
                ))}
              </div>
            </div>
          </InsightCard>
        )}

        <InsightCard title="Stars by Repo (top 10)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={starsByRepo} margin={{ top: 0, right: 4, bottom: 20, left: -10 }}>
              <XAxis dataKey="name" tickFormatter={shortName}
                tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="stars" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightCard>

        <InsightCard title="Health Score (lowest 10)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={healthByRepo} margin={{ top: 0, right: 4, bottom: 20, left: -10 }}>
              <XAxis dataKey="name" tickFormatter={shortName}
                tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="score" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightCard>

        {prAgeBuckets.length > 0 && (
          <InsightCard title="PR Age Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={prAgeBuckets} margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </InsightCard>
        )}

        <InsightCard title="Open Issues by Repo">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={issuesByRepo} margin={{ top: 0, right: 4, bottom: 20, left: -10 }}>
              <XAxis dataKey="name" tickFormatter={shortName}
                tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="issues" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightCard>

        <InsightCard title="Open PRs by Repo">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={prsByRepo} margin={{ top: 0, right: 4, bottom: 20, left: -10 }}>
              <XAxis dataKey="name" tickFormatter={shortName}
                tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="prs" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightCard>
      </div>
    </div>
  )
}

function buildTrendData(history: ScoreSnapshot[]): { date: string; avgScore: number }[] {
  const byDate = new Map<string, number[]>()
  for (const snap of history) {
    const date = snap.syncedAt.split('T')[0]
    const scores = byDate.get(date) ?? []
    scores.push(snap.score)
    byDate.set(date, scores)
  }
  return Array.from(byDate.entries())
    .map(([date, scores]) => ({
      date,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function classifyPRs(prs: PullRequest[]): { type: string; count: number }[] {
  let human = 0
  let bot = 0
  for (const pr of prs) {
    if (classifyAuthor(pr.authorLogin) === 'bot') bot++
    else human++
  }
  const result: { type: string; count: number }[] = []
  if (human > 0) result.push({ type: 'Human', count: human })
  if (bot > 0) result.push({ type: 'Bot', count: bot })
  return result
}

function buildPRAgeBuckets(prs: PullRequest[]): { label: string; count: number }[] {
  const buckets = [
    { label: '<1d', max: 1 },
    { label: '1-3d', max: 3 },
    { label: '3-7d', max: 7 },
    { label: '1-2w', max: 14 },
    { label: '2-4w', max: 28 },
    { label: '>4w', max: Infinity },
  ]
  const counts = new Array(buckets.length).fill(0)
  for (const pr of prs) {
    for (let i = 0; i < buckets.length; i++) {
      if (pr.daysSinceUpdate < buckets[i].max) {
        counts[i]++
        break
      }
    }
  }
  return buckets.map((b, i) => ({ label: b.label, count: counts[i] })).filter((b) => b.count > 0)
}
