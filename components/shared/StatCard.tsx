import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-[32px] font-bold text-foreground leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}
