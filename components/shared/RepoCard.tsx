import { cn } from '@/lib/utils'
import { triageColors, languageColors } from '@/lib/constants'
import { HealthBadge } from './HealthBadge'
import { Star, GitPullRequest, AlertCircle, Lock } from 'lucide-react'
import type { Repo } from '@/types/workspace'

export function RepoCard({ repo }: { repo: Repo }) {
  const langColor = (repo.language && languageColors[repo.language]) || 'bg-muted-foreground'
  return (
    <div className={cn('rounded-lg border p-3 flex flex-col gap-2 hover:shadow-sm hover:border-foreground/20 transition-all cursor-pointer', triageColors[repo.triage])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', langColor)} title={repo.language ?? ''} />
          <span className="text-[13px] font-semibold text-foreground leading-tight">{repo.name}</span>
          {repo.isPrivate && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
        </div>
        <HealthBadge grade={repo.grade} score={repo.score} />
      </div>
      {repo.description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{repo.description}</p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {repo.stars}</span>
        <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" /> {repo.openPRs}</span>
        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {repo.openIssues}</span>
      </div>
    </div>
  )
}
