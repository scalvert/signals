'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'

interface MultiSelectFilterProps {
  label: string
  options: { value: string; count: number; color?: string }[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const hasSelection = selected.size > 0

  function toggle(value: string) {
    const next = new Set(selected)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12px] font-medium transition-colors',
            hasSelection
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground border-border hover:text-foreground',
          )}
        >
          {label}
          {hasSelection && (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 rounded-full',
              'bg-background text-foreground',
            )}>
              {selected.size}
            </span>
          )}
          <ChevronDown className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        <div className="flex flex-col">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer text-[12px] hover:bg-muted transition-colors',
                selected.has(opt.value) && 'bg-muted',
              )}
            >
              <Checkbox
                checked={selected.has(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              {opt.color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
              )}
              <span className="flex-1 truncate">{opt.value}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{opt.count}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
