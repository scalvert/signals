'use client'

import { useState } from 'react'
import { ChevronsUpDown, Check, Plus, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@/types/workspace'

interface UserSwitcherProps {
  currentUser: User | null
  allUsers: User[]
  workspaceCounts: Record<number, number>
}

export function UserSwitcher({ currentUser, allUsers, workspaceCounts }: UserSwitcherProps) {
  const [open, setOpen] = useState(false)

  if (!currentUser) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left"
      >
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.githubLogin}
          className="w-6 h-6 rounded-full shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-white truncate">{currentUser.githubLogin}</div>
          <div className="text-[10px] text-sidebar-foreground/50 truncate">{currentUser.name}</div>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-sidebar-foreground/45 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
              Accounts
            </div>
            {allUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  if (user.id !== currentUser.id) {
                    window.location.href = `/api/auth/signin/github?login=${user.githubLogin}`
                  }
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted transition-colors',
                  user.id === currentUser.id && 'bg-muted',
                )}
              >
                <img
                  src={user.avatarUrl}
                  alt={user.githubLogin}
                  className="w-7 h-7 rounded-full shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-foreground truncate">{user.githubLogin}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {workspaceCounts[user.id] ?? 0} workspace{(workspaceCounts[user.id] ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>
                {user.id === currentUser.id && (
                  <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                )}
              </button>
            ))}
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false)
                  window.location.href = '/api/auth/signin/github'
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted transition-colors text-muted-foreground"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="text-[12px]">Add GitHub account</span>
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  window.location.href = '/api/auth/signout'
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted transition-colors text-muted-foreground"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="text-[12px]">Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
