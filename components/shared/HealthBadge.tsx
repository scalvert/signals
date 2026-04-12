import { cn } from '@/lib/utils'
import { gradeColors } from '@/lib/constants'
import type { HealthGrade } from '@/types/workspace'

export function HealthBadge({ grade, score }: { grade: HealthGrade; score: number }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border', gradeColors[grade])}>
      {grade} · {score}
    </span>
  )
}
