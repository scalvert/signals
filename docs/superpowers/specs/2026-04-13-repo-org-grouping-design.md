# Repo Org Grouping & Dropdown Filters

Adds org-aware filtering and display to the Repositories screen, and replaces horizontal filter chips with compact multi-select dropdowns that scale to any number of options.

## Problem

The Repositories screen shows a flat list with no org awareness. A workspace can span multiple GitHub orgs and personal repos, but there's no way to filter by org or see which org a repo belongs to. The existing filter chips (Language, Health) also don't scale — more languages or adding an org filter would overflow the toolbar.

## Solution

1. Replace filter chips with multi-select dropdown buttons (Org, Language, Health).
2. Add a sortable Org column to the table.

No schema changes, no API changes. Org is derived from `repo.fullName.split('/')[0]`.

## MultiSelectFilter Component

A thin wrapper composing existing shadcn/ui primitives: `Popover`, `PopoverTrigger`, `PopoverContent` (from `components/ui/popover.tsx`) and `Checkbox` (from `components/ui/checkbox.tsx`). No custom dropdown logic needed — Radix handles open/close, click-outside dismissal, focus management, and animations.

### Props

```typescript
interface MultiSelectFilterProps {
  label: string                    // "Org", "Language", "Health"
  options: { value: string; count: number }[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}
```

### Structure

```tsx
<Popover>
  <PopoverTrigger>  →  button with label + optional count badge
  <PopoverContent>  →  list of Checkbox + label + count per option
</Popover>
```

### States

**Collapsed (no selection):** Button shows label text + ChevronDown icon. Neutral border.

**Collapsed (with selection):** Button is highlighted (filled bg), shows label + count badge (e.g., "Org 2") + ChevronDown.

**Open:** PopoverContent panel with:
- Checkbox + label + repo count per option
- Clicking a checkbox toggles the option in/out of the selected set
- Radix handles click-outside dismissal and Escape key automatically
- Empty selection = show all (no filtering)

### Behavior

- Multi-select: any combination of options can be active simultaneously
- Options are derived from the current repo data (not hardcoded)
- Popover stays open while selecting multiple options (user closes explicitly)

## Org Column

Add a sortable "Org" column to the repos table between "Repository" and "Health".

- Displays org name in a monospace badge (`border border-border rounded px-1.5 py-0.5 font-mono`)
- Sortable: adds `'org'` to the `SortKey` type, sorts alphabetically by `repo.fullName.split('/')[0]`
- "Repository" column shows just `repo.name` (not `fullName`) since org is now its own column

## Filter State Changes

Current state:
```typescript
const [langFilter, setLangFilter] = useState('All')        // single string
const [healthFilter, setHealthFilter] = useState<TriageStatus | null>(null)  // single value
```

New state:
```typescript
const [orgFilter, setOrgFilter] = useState<Set<string>>(new Set())
const [langFilter, setLangFilter] = useState<Set<string>>(new Set())
const [healthFilter, setHealthFilter] = useState<Set<string>>(new Set())
```

Empty set = no filter (show all). The `useMemo` filtering logic checks `set.size === 0 || set.has(value)` for each filter.

## Filter Options Derivation

Options for each dropdown are derived from the current repo list:

```typescript
const orgOptions = useMemo(() => {
  const counts = new Map<string, number>()
  for (const r of repos) {
    const org = r.fullName.split('/')[0]
    counts.set(org, (counts.get(org) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))
}, [repos])
```

Language and health options follow the same pattern.

## Files Changed

- Create: `components/shared/MultiSelectFilter.tsx`
- Modify: `components/screens/Repositories.tsx` — replace chip filters, add org column, update filter state and logic

## No Schema or API Changes

Org is derived from `fullName` at render time. No new tables, columns, or endpoints.
