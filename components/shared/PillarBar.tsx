import { cn } from '@/lib/utils'

export function PillarBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const getColor = (v: number) => {
    const ratio = max > 0 ? v / max : 0
    if (ratio >= 0.76) return 'bg-[var(--health-a)]'
    if (ratio >= 0.6) return 'bg-[var(--health-b)]'
    if (ratio >= 0.44) return 'bg-[var(--health-c)]'
    return 'bg-[var(--health-d)]'
  }
  const width = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getColor(value))}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
