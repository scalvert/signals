'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  GitBranch,
  GitPullRequest,
  Rss,
  BarChart3,
  Hammer,
  Settings,
  ChevronsUpDown,
  Check,
  Layers,
} from 'lucide-react'
import { UserSwitcher } from './UserSwitcher'
import type { Workspace, User } from '@/types/workspace'

interface SidebarProps {
  workspace: Workspace
  allWorkspaces: Workspace[]
  currentUser?: User | null
  allUsers?: User[]
  workspaceCounts?: Record<number, number>
}

const navItems = [
  { path: '', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/repos', label: 'Repositories', icon: GitBranch },
  { path: '/prs', label: 'Pull Requests', icon: GitPullRequest },
  { path: '/signals', label: 'Signal Feed', icon: Rss },
  { path: '/work', label: 'Work', icon: Hammer },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
]

function sourceSummary(workspace: Workspace): string {
  const orgCount = workspace.sources.filter((s) => s.type === 'org').length
  const repoCount = workspace.sources.filter((s) => s.type === 'repo').length
  const parts: string[] = []
  if (orgCount > 0) parts.push(`${orgCount} org${orgCount > 1 ? 's' : ''}`)
  if (repoCount > 0) parts.push(`${repoCount} repo${repoCount > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

export function Sidebar({ workspace, allWorkspaces, currentUser, allUsers, workspaceCounts }: SidebarProps) {
  const pathname = usePathname()
  const basePath = `/workspace/${workspace.slug}`
  const [switcherOpen, setSwitcherOpen] = useState(false)

  return (
    <aside className="w-[220px] shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <Link href={basePath} className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors">
        <img src="/signals-icon.png" alt="Signals" className="w-6 h-6 shrink-0 brightness-0 invert" />
        <span className="font-semibold text-[15px] text-white tracking-tight">Signals</span>
      </Link>

      <div className="relative">
        <button
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0 ring-1 ring-sidebar-border">
            <Layers className="w-3.5 h-3.5 text-sidebar-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white truncate">{workspace.name}</div>
            <div className="text-[11px] text-sidebar-foreground/50 truncate">
              {sourceSummary(workspace)}
            </div>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-sidebar-foreground/45 shrink-0" />
        </button>

        {switcherOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
            <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-[300px] overflow-y-auto">
              {allWorkspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/workspace/${ws.slug}`}
                  onClick={() => setSwitcherOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors',
                    ws.id === workspace.id && 'bg-muted',
                  )}
                >
                  <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Layers className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-foreground truncate">{ws.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{sourceSummary(ws)}</div>
                  </div>
                  {ws.id === workspace.id && (
                    <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const href = `${basePath}${item.path}`
          const isActive = item.path === ''
            ? pathname === basePath
            : pathname.startsWith(href)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 pb-1">
        {currentUser && allUsers && (
          <UserSwitcher
            currentUser={currentUser}
            allUsers={allUsers}
            workspaceCounts={workspaceCounts ?? {}}
          />
        )}
      </div>

      <div className="px-2 pb-3">
        <Link
          href={`${basePath}/settings`}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
            pathname.includes('/settings')
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-white',
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
