# Signal Feedback & Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feedback loop to the signal feed so users can dismiss false-positive signals, provide per-repo context, and get LLM-enriched signal narratives.

**Architecture:** Two new tables (`repoContext`, `settings`), three new columns on `signals`. Detectors gain context-awareness via keyword matching to suppress false positives. An LLM enrichment step runs post-detection using the Vercel AI SDK (`@ai-sdk/anthropic`, already installed) to contextualize signal bodies. Two API endpoints handle dismissal and repo context CRUD. The signal feed UI gets tabs (Active/Dismissed) and a dismiss action. The repo detail panel gets a context editor.

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite, Vercel AI SDK (`@ai-sdk/anthropic`), Vitest, React 19

**Spec:** `docs/superpowers/specs/2026-04-13-signal-feedback-enrichment-design.md`

---

### Task 1: Schema & Migration

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `types/workspace.ts`

- [ ] **Step 1: Add `repoContext` table to schema**

In `lib/db/schema.ts`, add after the `signals` table:

```typescript
import { uniqueIndex } from 'drizzle-orm/sqlite-core'

// ... (add uniqueIndex to the existing import from drizzle-orm/sqlite-core)

export const repoContext = sqliteTable('repo_context', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  context: text('context').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('repo_context_workspace_repo_idx').on(table.workspaceId, table.repoFullName),
])
```

- [ ] **Step 2: Add `settings` table to schema**

In `lib/db/schema.ts`, add after `repoContext`:

```typescript
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

- [ ] **Step 3: Add new columns to `signals` table**

In `lib/db/schema.ts`, add three columns to the existing `signals` table definition, after the `resolvedAt` column:

```typescript
  status: text('status').notNull().default('active'),
  dismissedReason: text('dismissed_reason'),
  enrichedBody: text('enriched_body'),
```

- [ ] **Step 4: Update TypeScript interfaces**

In `types/workspace.ts`, update the `Signal` interface to include the new fields:

```typescript
export interface Signal {
  id: number
  type: SignalType
  severity: SignalSeverity
  title: string
  body: string
  repoFullName: string
  metadata: Record<string, unknown>
  detectedAt: string
  workspaceId: number
  status: 'active' | 'dismissed'
  dismissedReason: string | null
  enrichedBody: string | null
}
```

Add the `RepoContext` interface:

```typescript
export interface RepoContext {
  id: number
  workspaceId: number
  repoFullName: string
  context: string
  updatedAt: string
}
```

- [ ] **Step 5: Generate Drizzle migration**

Run: `npm run db:generate`

This generates a migration file in `drizzle/`. Verify the generated SQL includes:
- `CREATE TABLE repo_context` with columns `id`, `workspace_id`, `repo_full_name`, `context`, `updated_at`
- `CREATE TABLE settings` with columns `key`, `value`, `updated_at`
- `ALTER TABLE signals ADD COLUMN status`, `dismissed_reason`, `enriched_body`

- [ ] **Step 6: Run migration**

Run: `npm run db:migrate`

Verify no errors.

- [ ] **Step 7: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts types/workspace.ts drizzle/
git commit -m "feat: add repoContext, settings tables and signal feedback columns"
```

---

### Task 2: Query Functions

**Files:**
- Modify: `lib/db/queries.ts`

- [ ] **Step 1: Add repo context query functions**

In `lib/db/queries.ts`, add imports for the new tables and types at the top:

```typescript
import { workspaces, repos, pullRequests, signals, syncLog, repoContext, settings } from './schema'
import type {
  Workspace,
  WorkspaceSource,
  Repo,
  PullRequest,
  Signal,
  WorkspaceStats,
  SyncStatus,
  RepoPillars,
  RepoContext,
} from '@/types/workspace'
```

Add these functions:

```typescript
export function getRepoContext(
  workspaceId: number,
  repoFullName: string,
): RepoContext | undefined {
  return db
    .select()
    .from(repoContext)
    .where(
      sql`${repoContext.workspaceId} = ${workspaceId} AND ${repoContext.repoFullName} = ${repoFullName}`,
    )
    .get() as RepoContext | undefined
}

export function getRepoContextsForWorkspace(
  workspaceId: number,
): Map<string, string> {
  const rows = db
    .select()
    .from(repoContext)
    .where(eq(repoContext.workspaceId, workspaceId))
    .all()
  return new Map(rows.map((r) => [r.repoFullName, r.context]))
}

export function upsertRepoContext(
  workspaceId: number,
  repoFullName: string,
  context: string,
): void {
  const now = new Date().toISOString()
  const existing = getRepoContext(workspaceId, repoFullName)
  if (existing) {
    db.update(repoContext)
      .set({ context, updatedAt: now })
      .where(eq(repoContext.id, existing.id))
      .run()
  } else {
    db.insert(repoContext)
      .values({ workspaceId, repoFullName, context, updatedAt: now })
      .run()
  }
}
```

- [ ] **Step 2: Add signal dismissal function**

```typescript
export function dismissSignal(
  signalId: number,
  reason: string,
): Signal | undefined {
  const row = db
    .update(signals)
    .set({ status: 'dismissed', dismissedReason: reason })
    .where(eq(signals.id, signalId))
    .returning()
    .get()
  if (!row) return undefined
  return parseSignalRow(row)
}
```

- [ ] **Step 3: Extract signal row parser and update getSignals**

Refactor the existing `getSignals` to use a shared parser, and add status filtering:

```typescript
function parseSignalRow(row: typeof signals.$inferSelect): Signal {
  return {
    ...row,
    type: row.type as Signal['type'],
    severity: row.severity as Signal['severity'],
    status: (row.status ?? 'active') as Signal['status'],
    dismissedReason: row.dismissedReason ?? null,
    enrichedBody: row.enrichedBody ?? null,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }
}

export function getSignals(
  workspaceId: number,
  options?: { limit?: number; status?: 'active' | 'dismissed' },
): Signal[] {
  let query = db
    .select()
    .from(signals)
    .where(eq(signals.workspaceId, workspaceId))
    .orderBy(desc(signals.detectedAt))

  const rows = options?.limit ? query.limit(options.limit).all() : query.all()

  return rows
    .map(parseSignalRow)
    .filter((s) => !options?.status || s.status === options.status)
}
```

- [ ] **Step 4: Add settings query functions**

```typescript
export function getSetting(key: string): string | undefined {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  return row?.value
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString()
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key))
      .run()
  } else {
    db.insert(settings)
      .values({ key, value, updatedAt: now })
      .run()
  }
}
```

- [ ] **Step 5: Seed default settings**

Create `lib/db/seed-settings.ts`:

```typescript
import { getSetting, setSetting } from './queries'

export function seedDefaultSettings(): void {
  if (!getSetting('enrichment.model')) {
    setSetting('enrichment.model', 'claude-haiku-4-5-20251001')
  }
  if (!getSetting('enrichment.enabled')) {
    setSetting('enrichment.enabled', 'true')
  }
}
```

Call `seedDefaultSettings()` in `lib/db/client.ts` after the drizzle initialization:

```typescript
import { seedDefaultSettings } from './seed-settings'
// ... existing code ...
export const db = drizzle(sqlite, { schema })
seedDefaultSettings()
```

- [ ] **Step 6: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/db/queries.ts lib/db/client.ts lib/db/seed-settings.ts
git commit -m "feat: add query functions for repo context, signal dismissal, and settings"
```

---

### Task 3: Detector Context Matching

**Files:**
- Create: `lib/signals/context-match.ts`
- Create: `lib/signals/context-match.test.ts`

- [ ] **Step 1: Write failing tests for context matching**

Create `lib/signals/context-match.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { shouldSuppressSignal } from './context-match'

describe('shouldSuppressSignal', () => {
  it('returns true when context contains a matching keyword', () => {
    expect(shouldSuppressSignal('dormant', 'This repo has low cadence updates')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(shouldSuppressSignal('dormant', 'LOW CADENCE expected')).toBe(true)
  })

  it('returns false when context has no matching keywords', () => {
    expect(shouldSuppressSignal('dormant', 'This repo is important')).toBe(false)
  })

  it('returns false when context is empty', () => {
    expect(shouldSuppressSignal('dormant', '')).toBe(false)
  })

  it('matches health-drop keywords', () => {
    expect(shouldSuppressSignal('health-drop', 'Expected decline during migration')).toBe(true)
  })

  it('matches pr-stale keywords', () => {
    expect(shouldSuppressSignal('pr-stale', 'This repo has long-lived PRs by design')).toBe(true)
  })

  it('returns false for signal types with no suppression rules', () => {
    expect(shouldSuppressSignal('star-spike', 'low cadence')).toBe(false)
    expect(shouldSuppressSignal('milestone', 'stable')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/signals/context-match.test.ts`

Expected: FAIL — module `./context-match` not found.

- [ ] **Step 3: Implement context matching**

Create `lib/signals/context-match.ts`:

```typescript
import type { SignalType } from '@/types/workspace'

const suppressionRules: Partial<Record<SignalType, string[]>> = {
  dormant: ['low cadence', 'infrequently updated', 'stable', 'maintenance mode', 'rarely changes', 'updated as needed'],
  'health-drop': ['expected decline', 'winding down', 'deprecating', 'archiving soon'],
  'pr-stale': ['long-lived prs', 'slow review', 'review cadence'],
}

export function shouldSuppressSignal(
  signalType: SignalType,
  context: string,
): boolean {
  const keywords = suppressionRules[signalType]
  if (!keywords) return false
  const lower = context.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/signals/context-match.test.ts`

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/signals/context-match.ts lib/signals/context-match.test.ts
git commit -m "feat: add context-based signal suppression matching"
```

---

### Task 4: Update Detectors with Context Awareness

**Files:**
- Modify: `lib/signals/types.ts`
- Modify: `lib/signals/detectors/dormant.ts`
- Modify: `lib/signals/detectors/health-drop.ts`
- Modify: `lib/signals/detectors/pr-stale.ts`
- Modify: `lib/signals/detectors/star-spike.ts`
- Modify: `lib/signals/detectors/milestone.ts`
- Modify: `lib/signals/engine.ts`

- [ ] **Step 1: Update SignalDetector interface**

In `lib/signals/types.ts`, add the `repoContexts` parameter:

```typescript
import type { Repo, Signal, SignalType, SignalSeverity } from '@/types/workspace'

export interface DetectedSignal {
  type: SignalType
  severity: SignalSeverity
  title: string
  body: string
  repoFullName: string
  metadata: Record<string, unknown>
}

export interface SignalDetector {
  type: SignalType
  detect(
    currentRepos: Repo[],
    previousRepos: Repo[],
    existingSignals: Signal[],
    repoContexts: Map<string, string>,
  ): DetectedSignal[]
}
```

- [ ] **Step 2: Update dormant detector**

In `lib/signals/detectors/dormant.ts`, add context suppression:

```typescript
import type { SignalDetector, DetectedSignal } from '../types'
import type { Repo, Signal } from '@/types/workspace'
import { shouldSuppressSignal } from '../context-match'

const DEDUP_DAYS = 30

export const dormantDetector: SignalDetector = {
  type: 'dormant',
  detect(currentRepos, _previousRepos, existingSignals, repoContexts): DetectedSignal[] {
    const signals: DetectedSignal[] = []
    const cutoff = Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000

    for (const repo of currentRepos) {
      if (repo.stars === 0) continue
      if (!repo.lastCommitAt) continue

      const daysSince = Math.floor(
        (Date.now() - new Date(repo.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24),
      )

      if (daysSince < 30) continue
      if (isDuplicate(existingSignals, repo.fullName, cutoff)) continue

      const context = repoContexts.get(repo.fullName)
      if (context && shouldSuppressSignal('dormant', context)) continue

      const severity = daysSince > 60 ? 'critical' : 'warning'
      const contextInfo = getContext(repo)

      signals.push({
        type: 'dormant',
        severity,
        title: `${repo.name} appears dormant`,
        body: `No commits in ${daysSince} days.${contextInfo}`,
        repoFullName: repo.fullName,
        metadata: {
          daysSinceLastCommit: daysSince,
          lastCommitDate: repo.lastCommitAt,
          stars: repo.stars,
          openIssues: repo.openIssues,
          openPRs: repo.openPRs,
        },
      })
    }

    return signals
  },
}

function isDuplicate(signals: Signal[], repoFullName: string, cutoff: number): boolean {
  return signals.some(
    (s) =>
      s.type === 'dormant' &&
      s.repoFullName === repoFullName &&
      new Date(s.detectedAt).getTime() > cutoff,
  )
}

function getContext(repo: Repo): string {
  const parts: string[] = []
  if (repo.openIssues > 0) parts.push(`${repo.openIssues} open issues`)
  if (repo.openPRs > 0) parts.push(`${repo.openPRs} open PRs`)
  if (parts.length > 0) {
    return ` Still has ${parts.join(' and ')} — consider triaging or archiving.`
  }
  return ' Consider adding a maintenance notice or archiving.'
}
```

- [ ] **Step 3: Update health-drop detector**

In `lib/signals/detectors/health-drop.ts`, add context suppression. Add import and the `repoContexts` parameter:

```typescript
import { shouldSuppressSignal } from '../context-match'
```

Update the `detect` method signature to include `repoContexts: Map<string, string>` and add this check after the dedup check:

```typescript
      const context = repoContexts.get(repo.fullName)
      if (context && shouldSuppressSignal('health-drop', context)) continue
```

- [ ] **Step 4: Update pr-stale detector**

In `lib/signals/detectors/pr-stale.ts`, update the function signature to accept repo contexts:

```typescript
import { shouldSuppressSignal } from '../context-match'

export function detectStalePRs(
  prs: PullRequest[],
  existingSignals: Signal[],
  repoContexts: Map<string, string>,
): DetectedSignal[] {
```

Add this check inside the `for (const [repoFullName, stalePRs] of grouped)` loop, after the dedup check:

```typescript
    const context = repoContexts.get(repoFullName)
    if (context && shouldSuppressSignal('pr-stale', context)) continue
```

- [ ] **Step 5: Update star-spike and milestone detectors**

These detectors don't use context suppression, but their signatures must match the updated interface.

In `lib/signals/detectors/star-spike.ts`, add `repoContexts: Map<string, string>` as the 4th parameter to the `detect` method (unused — name it `_repoContexts`).

In `lib/signals/detectors/milestone.ts`, do the same.

- [ ] **Step 6: Update signal engine to load and pass contexts**

In `lib/signals/engine.ts`:

```typescript
import { db } from '@/lib/db/client'
import { signals } from '@/lib/db/schema'
import { getRepos, getPullRequests, getSignals, getRepoContextsForWorkspace } from '@/lib/db/queries'
import { starSpikeDetector } from './detectors/star-spike'
import { healthDropDetector } from './detectors/health-drop'
import { dormantDetector } from './detectors/dormant'
import { milestoneDetector } from './detectors/milestone'
import { detectStalePRs } from './detectors/pr-stale'
import type { Repo } from '@/types/workspace'
import type { DetectedSignal } from './types'

const repoDetectors = [
  starSpikeDetector,
  healthDropDetector,
  dormantDetector,
  milestoneDetector,
]

export function runSignalDetection(
  workspaceId: number,
  previousRepos: Repo[],
): number {
  const currentRepos = getRepos(workspaceId)
  const prs = getPullRequests(workspaceId)
  const existingSignals = getSignals(workspaceId)
  const repoContexts = getRepoContextsForWorkspace(workspaceId)
  const now = new Date().toISOString()

  const detected: DetectedSignal[] = []

  for (const detector of repoDetectors) {
    detected.push(
      ...detector.detect(currentRepos, previousRepos, existingSignals, repoContexts),
    )
  }

  detected.push(...detectStalePRs(prs, existingSignals, repoContexts))

  for (const signal of detected) {
    db.insert(signals)
      .values({
        workspaceId,
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        body: signal.body,
        repoFullName: signal.repoFullName,
        metadata: JSON.stringify(signal.metadata),
        detectedAt: now,
      })
      .run()
  }

  return detected.length
}
```

- [ ] **Step 7: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 8: Run existing context-match tests**

Run: `npx vitest run lib/signals/context-match.test.ts`

Expected: All tests still pass.

- [ ] **Step 9: Commit**

```bash
git add lib/signals/types.ts lib/signals/engine.ts lib/signals/context-match.ts lib/signals/detectors/
git commit -m "feat: add context-aware signal suppression to detectors"
```

---

### Task 5: LLM Enrichment Module

**Files:**
- Create: `lib/signals/enrichment.ts`
- Create: `lib/signals/enrichment.test.ts`
- Modify: `lib/signals/engine.ts`

- [ ] **Step 1: Write failing tests for enrichment**

Create `lib/signals/enrichment.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrichSignals } from './enrichment'
import type { Signal } from '@/types/workspace'

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-model'),
}))

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

const mockSignal: Signal = {
  id: 1,
  type: 'dormant',
  severity: 'warning',
  title: 'test-repo appears dormant',
  body: 'No commits in 45 days.',
  repoFullName: 'org/test-repo',
  metadata: {},
  detectedAt: '2026-04-13T00:00:00Z',
  workspaceId: 1,
  status: 'active',
  dismissedReason: null,
  enrichedBody: null,
}

describe('enrichSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns enriched bodies keyed by signal id', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        enrichments: [
          { signalId: 1, enrichedBody: 'No commits in 45 days, but this is a stable utility.' },
        ],
      },
    } as never)

    const result = await enrichSignals(
      [mockSignal],
      new Map([['org/test-repo', 'Stable utility, rarely changes']]),
      'claude-haiku-4-5-20251001',
    )

    expect(result.get(1)).toBe('No commits in 45 days, but this is a stable utility.')
  })

  it('returns empty map when signals array is empty', async () => {
    const result = await enrichSignals([], new Map(), 'claude-haiku-4-5-20251001')
    expect(result.size).toBe(0)
  })

  it('returns empty map when generateObject throws', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockRejectedValue(new Error('API error'))

    const result = await enrichSignals(
      [mockSignal],
      new Map(),
      'claude-haiku-4-5-20251001',
    )

    expect(result.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/signals/enrichment.test.ts`

Expected: FAIL — module `./enrichment` not found.

- [ ] **Step 3: Implement enrichment module**

Create `lib/signals/enrichment.ts`:

```typescript
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { Signal } from '@/types/workspace'

const enrichmentSchema = z.object({
  enrichments: z.array(
    z.object({
      signalId: z.number(),
      enrichedBody: z.string(),
    }),
  ),
})

export async function enrichSignals(
  signals: Signal[],
  repoContexts: Map<string, string>,
  model: string,
): Promise<Map<number, string>> {
  if (signals.length === 0) return new Map()

  const contextEntries = Array.from(repoContexts.entries())
    .map(([repo, ctx]) => `- ${repo}: ${ctx}`)
    .join('\n')

  const signalEntries = signals
    .map((s) => `- [id=${s.id}] ${s.type} (${s.severity}) on ${s.repoFullName}: ${s.body}`)
    .join('\n')

  try {
    const { object } = await generateObject({
      model: anthropic(model),
      schema: enrichmentSchema,
      system: `You are a signal enrichment engine for an OSS maintainer dashboard.
Given raw signals and per-repo context notes from the maintainer, rewrite each signal body to incorporate the relevant context.
Keep each enriched body to 1-2 concise sentences.
Adjust tone based on context — if the maintainer has noted something is expected, make the signal informational rather than alarming.
Return every signal ID from the input, even if no context applies (in that case, lightly rephrase the original).`,
      prompt: `Repo contexts:\n${contextEntries || '(none)'}\n\nSignals to enrich:\n${signalEntries}`,
    })

    return new Map(object.enrichments.map((e) => [e.signalId, e.enrichedBody]))
  } catch {
    return new Map()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/signals/enrichment.test.ts`

Expected: All 3 tests PASS.

- [ ] **Step 5: Integrate enrichment into signal engine**

In `lib/signals/engine.ts`, add the enrichment call. Update imports:

```typescript
import { getRepos, getPullRequests, getSignals, getRepoContextsForWorkspace, getSetting } from '@/lib/db/queries'
import { enrichSignals } from './enrichment'
```

At the bottom of `runSignalDetection`, after the insert loop, add the enrichment step. Change the function to async:

```typescript
export async function runSignalDetection(
  workspaceId: number,
  previousRepos: Repo[],
): Promise<number> {
  const currentRepos = getRepos(workspaceId)
  const prs = getPullRequests(workspaceId)
  const existingSignals = getSignals(workspaceId)
  const repoContexts = getRepoContextsForWorkspace(workspaceId)
  const now = new Date().toISOString()

  const detected: DetectedSignal[] = []

  for (const detector of repoDetectors) {
    detected.push(
      ...detector.detect(currentRepos, previousRepos, existingSignals, repoContexts),
    )
  }

  detected.push(...detectStalePRs(prs, existingSignals, repoContexts))

  const insertedSignals: Signal[] = []
  for (const signal of detected) {
    const result = db.insert(signals)
      .values({
        workspaceId,
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        body: signal.body,
        repoFullName: signal.repoFullName,
        metadata: JSON.stringify(signal.metadata),
        detectedAt: now,
      })
      .returning()
      .get()
    insertedSignals.push({
      ...result,
      type: result.type as Signal['type'],
      severity: result.severity as Signal['severity'],
      status: 'active' as const,
      dismissedReason: null,
      enrichedBody: null,
      metadata: JSON.parse(result.metadata) as Record<string, unknown>,
    })
  }

  // LLM enrichment step
  const enrichmentEnabled = getSetting('enrichment.enabled')
  const enrichmentModel = getSetting('enrichment.model')
  if (
    enrichmentEnabled === 'true' &&
    enrichmentModel &&
    process.env.ANTHROPIC_API_KEY &&
    insertedSignals.length > 0
  ) {
    const enrichments = await enrichSignals(insertedSignals, repoContexts, enrichmentModel)
    for (const [signalId, enrichedBody] of enrichments) {
      db.update(signals)
        .set({ enrichedBody })
        .where(eq(signals.id, signalId))
        .run()
    }
  }

  return detected.length
}
```

Add `eq` to the drizzle-orm imports at the top of the file:

```typescript
import { eq } from 'drizzle-orm'
```

- [ ] **Step 6: Update callers of runSignalDetection to await it**

Search for all callers of `runSignalDetection` (likely in `lib/sync/engine.ts` and `app/api/sync/route.ts`). Add `await` where it's called since it's now async.

In `lib/sync/engine.ts`, find the call to `runSignalDetection(...)` and change it to `await runSignalDetection(...)`. Make the containing function `async` if it isn't already.

- [ ] **Step 7: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add lib/signals/enrichment.ts lib/signals/enrichment.test.ts lib/signals/engine.ts lib/sync/engine.ts
git commit -m "feat: add LLM enrichment pipeline for signals"
```

---

### Task 6: API Endpoints

**Files:**
- Create: `app/api/signals/[id]/dismiss/route.ts`
- Create: `app/api/repo-context/route.ts`

- [ ] **Step 1: Create signal dismiss endpoint**

Create `app/api/signals/[id]/dismiss/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { dismissSignal, getRepoContext, upsertRepoContext } from '@/lib/db/queries'
import { signals } from '@/lib/db/schema'
import { db } from '@/lib/db/client'
import { eq } from 'drizzle-orm'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const signalId = Number(id)
  if (isNaN(signalId)) {
    return NextResponse.json({ error: 'Invalid signal ID' }, { status: 400 })
  }

  const body = await req.json()
  const reason = body.reason as string
  if (!reason || typeof reason !== 'string') {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  // Get the signal first to find its workspace and repo
  const signal = db
    .select()
    .from(signals)
    .where(eq(signals.id, signalId))
    .get()

  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  // Dismiss the signal
  const dismissed = dismissSignal(signalId, reason)

  // Upsert repo context — append to existing or create new
  const existing = getRepoContext(signal.workspaceId, signal.repoFullName)
  const newContext = existing
    ? `${existing.context}\n${reason}`
    : reason
  upsertRepoContext(signal.workspaceId, signal.repoFullName, newContext)

  return NextResponse.json({ signal: dismissed })
}
```

- [ ] **Step 2: Create repo context endpoints**

Create `app/api/repo-context/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getRepoContext, upsertRepoContext } from '@/lib/db/queries'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = Number(url.searchParams.get('workspaceId'))
  const repo = url.searchParams.get('repo')

  if (isNaN(workspaceId) || !repo) {
    return NextResponse.json(
      { error: 'workspaceId and repo are required' },
      { status: 400 },
    )
  }

  const context = getRepoContext(workspaceId, repo)
  return NextResponse.json({ context: context ?? null })
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { workspaceId, repoFullName, context } = body as {
    workspaceId: number
    repoFullName: string
    context: string
  }

  if (!workspaceId || !repoFullName || typeof context !== 'string') {
    return NextResponse.json(
      { error: 'workspaceId, repoFullName, and context are required' },
      { status: 400 },
    )
  }

  upsertRepoContext(workspaceId, repoFullName, context)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/signals/[id]/dismiss/route.ts app/api/repo-context/route.ts
git commit -m "feat: add API endpoints for signal dismissal and repo context"
```

---

### Task 7: Signal Feed UI — Tabs & Dismiss

**Files:**
- Modify: `components/screens/SignalFeed.tsx`
- Modify: `app/workspace/[slug]/signals/page.tsx`

- [ ] **Step 1: Update signals page to pass both active and dismissed signals**

In `app/workspace/[slug]/signals/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getSignals } from '@/lib/db/queries'
import { SignalFeed } from '@/components/screens/SignalFeed'

export default async function SignalsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const activeSignals = getSignals(workspace.id, { status: 'active' })
  const dismissedSignals = getSignals(workspace.id, { status: 'dismissed' })
  return (
    <SignalFeed
      activeSignals={activeSignals}
      dismissedSignals={dismissedSignals}
    />
  )
}
```

- [ ] **Step 2: Rewrite SignalFeed component with tabs and dismiss action**

Replace `components/screens/SignalFeed.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { TrendingUp, UserPlus, TrendingDown, AlertCircle, Star, GitPullRequest, Activity, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Signal, SignalType } from '@/types/workspace'

const signalIcons: Record<SignalType, { icon: React.ElementType; color: string; bg: string }> = {
  'star-spike': { icon: TrendingUp, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  'new-contributor': { icon: UserPlus, color: 'text-[var(--health-a)]', bg: 'bg-[var(--health-a)]/10' },
  'health-drop': { icon: TrendingDown, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
  'issue-flood': { icon: AlertCircle, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'pr-stale': { icon: GitPullRequest, color: 'text-[var(--health-c)]', bg: 'bg-[var(--health-c)]/10' },
  'milestone': { icon: Star, color: 'text-[var(--health-b)]', bg: 'bg-[var(--health-b)]/10' },
  'dormant': { icon: Activity, color: 'text-[var(--health-d)]', bg: 'bg-[var(--health-d)]/10' },
}

const severityBorder: Record<string, string> = {
  info: 'border-border',
  warning: 'border-[var(--health-c)]/30',
  critical: 'border-[var(--health-d)]/30',
}

const severityBg: Record<string, string> = {
  info: '',
  warning: 'bg-[var(--health-c)]/3',
  critical: 'bg-[var(--health-d)]/3',
}

function DismissForm({ signalId, onDismissed }: { signalId: number; onDismissed: () => void }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    await fetch(`/api/signals/${signalId}/dismiss`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    onDismissed()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this signal not useful?"
        className="flex-1 h-7 px-2 text-[12px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <button
        type="submit"
        disabled={submitting || !reason.trim()}
        className="h-7 px-3 text-[11px] font-medium rounded bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        Dismiss
      </button>
    </form>
  )
}

function SignalCard({
  signal,
  showDismissAction,
  onDismissed,
}: {
  signal: Signal
  showDismissAction: boolean
  onDismissed?: () => void
}) {
  const [showDismissForm, setShowDismissForm] = useState(false)
  const config = signalIcons[signal.type] ?? signalIcons['health-drop']
  const Icon = config.icon
  const displayBody = signal.enrichedBody ?? signal.body

  return (
    <div
      className={cn(
        'bg-card border rounded-lg px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow',
        severityBorder[signal.severity],
        severityBg[signal.severity],
      )}
    >
      <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[13px] font-semibold text-foreground leading-tight">{signal.title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[11px] text-muted-foreground">
              {new Date(signal.detectedAt).toLocaleDateString()}
            </div>
            {showDismissAction && !showDismissForm && (
              <button
                onClick={() => setShowDismissForm(true)}
                className="p-0.5 hover:bg-muted rounded transition-colors"
                title="Dismiss signal"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground leading-relaxed mt-1">{displayBody}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
            {signal.repoFullName}
          </span>
        </div>
        {signal.dismissedReason && (
          <div className="mt-2 text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
            Dismissed: {signal.dismissedReason}
          </div>
        )}
        {showDismissForm && (
          <DismissForm
            signalId={signal.id}
            onDismissed={() => {
              setShowDismissForm(false)
              onDismissed?.()
            }}
          />
        )}
      </div>
    </div>
  )
}

export function SignalFeed({
  activeSignals,
  dismissedSignals,
}: {
  activeSignals: Signal[]
  dismissedSignals: Signal[]
}) {
  const [tab, setTab] = useState<'active' | 'dismissed'>('active')
  const signals = tab === 'active' ? activeSignals : dismissedSignals
  const totalCount = activeSignals.length + dismissedSignals.length

  if (totalCount === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          title="No signals yet"
          description="Signals will appear after your first sync detects events like star spikes, health drops, or new contributors."
        />
      </div>
    )
  }

  function handleDismissed() {
    // Reload the page to refresh server data
    window.location.reload()
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab('active')}
            className={cn(
              'text-[13px] font-semibold px-2 py-1 rounded transition-colors',
              tab === 'active' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Active ({activeSignals.length})
          </button>
          <button
            onClick={() => setTab('dismissed')}
            className={cn(
              'text-[13px] font-semibold px-2 py-1 rounded transition-colors',
              tab === 'dismissed' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Dismissed ({dismissedSignals.length})
          </button>
        </div>
        {tab === 'active' && (
          <div className="flex items-center gap-2">
            {(['info', 'warning', 'critical'] as const).map((s) => (
              <span
                key={s}
                className={cn(
                  'text-[11px] font-medium px-2 py-1 rounded-full border',
                  s === 'info' && 'border-border text-muted-foreground',
                  s === 'warning' && 'border-[var(--health-c)]/30 text-[var(--health-c)] bg-[var(--health-c)]/8',
                  s === 'critical' && 'border-[var(--health-d)]/30 text-[var(--health-d)] bg-[var(--health-d)]/8',
                )}
              >
                {activeSignals.filter((e) => e.severity === s).length} {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {signals.length === 0 ? (
          <div className="text-[13px] text-muted-foreground text-center py-8">
            {tab === 'active' ? 'No active signals.' : 'No dismissed signals.'}
          </div>
        ) : (
          signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              showDismissAction={tab === 'active'}
              onDismissed={handleDismissed}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 4: Start dev server and verify the signal feed**

Run: `npm run dev`

Navigate to a workspace's signals page. Verify:
- Active/Dismissed tabs render correctly
- Signal cards show enrichedBody when available, body as fallback
- Dismiss button appears on active signals
- Clicking dismiss shows the inline form
- Submitting a dismissal moves the signal to the Dismissed tab

- [ ] **Step 5: Commit**

```bash
git add components/screens/SignalFeed.tsx app/workspace/[slug]/signals/page.tsx
git commit -m "feat: add tabbed signal feed with dismiss action"
```

---

### Task 8: Repo Context Editor in Detail Panel

**Files:**
- Modify: `components/screens/Repositories.tsx`

- [ ] **Step 1: Add RepoContextEditor component**

In `components/screens/Repositories.tsx`, add a new component before `RepoDetailPanel`. This component needs the `workspaceId` prop, so the `Repositories` component will need to accept it too.

First, update the `Repositories` component props and the `RepoDetailPanel` props to include `workspaceId`:

```tsx
function RepoContextEditor({ workspaceId, repoFullName }: { workspaceId: number; repoFullName: string }) {
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/repo-context?workspaceId=${workspaceId}&repo=${encodeURIComponent(repoFullName)}`)
      .then((r) => r.json())
      .then((data) => {
        setContext(data.context?.context ?? '')
        setLoading(false)
      })
  }, [workspaceId, repoFullName])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/repo-context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, repoFullName, context }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div>
      <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-2">
        Context
      </h3>
      <p className="text-[11px] text-muted-foreground mb-2">
        Describe this repo&apos;s expected behavior. This shapes signal detection and feed generation.
      </p>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={3}
        className="w-full text-[12px] rounded border border-border bg-background text-foreground px-2 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        placeholder="e.g., Low cadence repo — only updated when upstream API changes."
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-7 px-3 text-[11px] font-medium rounded bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && <span className="text-[11px] text-[var(--health-a)]">Saved</span>}
      </div>
    </div>
  )
}
```

Add `useEffect` to the imports at the top of the file:

```typescript
import { useState, useMemo, useEffect } from 'react'
```

- [ ] **Step 2: Add RepoContextEditor to RepoDetailPanel**

In the `RepoDetailPanel` component, add the context editor after the health breakdown section (before the "Actions Needed" section). Pass `workspaceId` as a prop:

Update `RepoDetailPanel` signature:
```tsx
function RepoDetailPanel({ repo, workspaceId, onClose }: { repo: Repo; workspaceId: number; onClose: () => void }) {
```

Add inside the panel's scrollable area, after the PillarBar section:

```tsx
        <RepoContextEditor workspaceId={workspaceId} repoFullName={repo.fullName} />
```

- [ ] **Step 3: Update Repositories component to accept and pass workspaceId**

Update the `Repositories` component:

```tsx
export function Repositories({ repos, workspaceId }: { repos: Repo[]; workspaceId: number }) {
```

Update the `RepoDetailPanel` usage at the bottom:

```tsx
      {selectedRepo && <RepoDetailPanel repo={selectedRepo} workspaceId={workspaceId} onClose={() => setSelectedRepo(null)} />}
```

- [ ] **Step 4: Update repos page to pass workspaceId**

In `app/workspace/[slug]/repos/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getRepos } from '@/lib/db/queries'
import { Repositories } from '@/components/screens/Repositories'

export default async function ReposPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const repos = getRepos(workspace.id)
  return <Repositories repos={repos} workspaceId={workspace.id} />
}
```

- [ ] **Step 5: Verify build**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 6: Start dev server and verify the context editor**

Run: `npm run dev`

Navigate to a workspace's repos page. Click on a repo to open the detail panel. Verify:
- "Context" section appears with textarea and helper text
- Saving context works (check via the API: `curl localhost:3000/api/repo-context?workspaceId=1&repo=org/repo`)
- Saved confirmation appears briefly after save

- [ ] **Step 7: Commit**

```bash
git add components/screens/Repositories.tsx app/workspace/[slug]/repos/page.tsx
git commit -m "feat: add repo context editor to detail panel"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Run type checker**

Run: `npm run typecheck`

Expected: No type errors.

- [ ] **Step 3: Run linter**

Run: `npm run lint`

Expected: No lint errors (fix any that appear).

- [ ] **Step 4: Manual end-to-end test**

Start the dev server: `npm run dev`

Test the full flow:
1. Navigate to a workspace's repos page
2. Click a repo → detail panel opens → "Context" section visible
3. Write context: "Low cadence repo, infrequently updated" → Save
4. Trigger a sync (POST to `/api/sync?slug=your-workspace`)
5. Navigate to signals page → Active tab shows signals
6. Verify dormant signal for that repo was suppressed (should not appear)
7. Find another signal → click dismiss → enter reason → submit
8. Signal moves to Dismissed tab with reason shown
9. Check the repo context was updated (via repo detail panel)

- [ ] **Step 5: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end testing"
```
