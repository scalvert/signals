'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  GitBranch,
  GitPullRequest,
  Rss,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { Workspace } from '@/types/workspace'

interface SidebarProps {
  workspace: Workspace
}

const navItems = [
  { path: '', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/repos', label: 'Repositories', icon: GitBranch },
  { path: '/prs', label: 'Pull Requests', icon: GitPullRequest },
  { path: '/signals', label: 'Signal Feed', icon: Rss },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
]

export function Sidebar({ workspace }: SidebarProps) {
  const pathname = usePathname()
  const basePath = `/workspace/${workspace.slug}`

  const orgCount = workspace.sources.filter((s) => s.type === 'org').length
  const repoCount = workspace.sources.filter((s) => s.type === 'repo').length

  return (
    <aside className="w-[220px] shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0">
          <span className="text-black text-xs font-bold leading-none">B</span>
        </div>
        <span className="font-semibold text-[15px] text-white tracking-tight">Signals</span>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0 ring-1 ring-sidebar-border">
          <span className="text-[10px] font-bold text-sidebar-foreground leading-none select-none">
            {workspace.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-white truncate">{workspace.name}</div>
          <div className="text-[11px] text-sidebar-foreground/50 truncate">
            {orgCount > 0 && `${orgCount} org${orgCount > 1 ? 's' : ''}`}
            {orgCount > 0 && repoCount > 0 && ' · '}
            {repoCount > 0 && `${repoCount} repo${repoCount > 1 ? 's' : ''}`}
          </div>
        </div>
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
