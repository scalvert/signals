'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Repo } from '@/types/workspace'

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

export function Insights({ repos }: { repos: Repo[] }) {
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

  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-[13px] font-semibold text-foreground">Insights</h2>
      <div className="grid grid-cols-2 gap-4">
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
