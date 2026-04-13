import Link from 'next/link'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  href?: string
}) {
  const content = (
    <div className={cn(
      'bg-card border border-border rounded-lg p-4 flex flex-col gap-2 h-full',
      href && 'hover:border-foreground/20 hover:shadow-sm transition-all cursor-pointer',
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-[32px] font-bold text-foreground leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-auto">{sub ?? '\u00A0'}</div>
    </div>
  )

  if (href) {
    return <Link href={href} className="h-full">{content}</Link>
  }

  return content
}
