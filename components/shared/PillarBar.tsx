import { cn } from '@/lib/utils'

export function PillarBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 19) return 'bg-[var(--health-a)]'
    if (v >= 15) return 'bg-[var(--health-b)]'
    if (v >= 11) return 'bg-[var(--health-c)]'
    return 'bg-[var(--health-d)]'
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getColor(value))}
          style={{ width: `${(value / 25) * 100}%` }}
        />
      </div>
    </div>
  )
}
