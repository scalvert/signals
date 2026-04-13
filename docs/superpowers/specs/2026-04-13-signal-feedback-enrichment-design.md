# Signal Feedback & Enrichment

Adds a feedback loop to the signal feed so users can dismiss false-positive signals, provide per-repo context, and get LLM-enriched signal narratives that incorporate that context.

## Problem

Signal detectors are context-blind. A repo like `copier-glean-connector` fires dormant alerts every 30 days even though infrequent updates are by design. There's no way to tell the system "this is expected" — signals are fire-and-forget with no learning.

## Solution

Two layers:

1. **Detector suppression** — per-repo context notes are checked at detection time to suppress obvious false positives via keyword matching.
2. **LLM enrichment** — after detection, Claude contextualizes remaining signals using repo context, producing enriched narratives stored alongside raw detector output.

Users provide context via two entry points: reactively (dismissing a signal with a reason) and proactively (editing repo context notes directly). Both write to the same `repoContext` store.

## Data Model

### New table: `repoContext`

| Column | Type | Constraints |
|---|---|---|
| id | integer | PK, auto-increment |
| workspaceId | integer | not null |
| repoFullName | text | not null |
| context | text | not null |
| updatedAt | text | not null, ISO timestamp |

Unique index on `(workspace_id, repo_full_name)`.

Join to signals on `(workspaceId, repoFullName)` — same soft-FK pattern used throughout the schema. No formal FK constraint because repos are ephemeral (delete-and-reinsert on sync).

### New table: `settings`

| Column | Type | Constraints |
|---|---|---|
| key | text | PK |
| value | text | not null, JSON-encoded |
| updatedAt | text | not null, ISO timestamp |

Initial keys:
- `enrichment.model` — string, default `"claude-haiku-4-5-20251001"`
- `enrichment.enabled` — boolean, default `true`

Secrets (`ANTHROPIC_API_KEY`) stay as env vars. Non-secret preferences live here.

### Extended table: `signals`

Three new columns:

| Column | Type | Default |
|---|---|---|
| status | text | `'active'` |
| dismissedReason | text | null |
| enrichedBody | text | null |

`status` is `'active'` or `'dismissed'`. `enrichedBody` is the LLM-enhanced version of `body`. UI displays `enrichedBody ?? body`.

## Detector Suppression Layer

### Interface change

```typescript
interface SignalDetector {
  type: SignalType
  detect(
    currentRepos: Repo[],
    previousRepos: Repo[],
    existingSignals: Signal[],
    repoContexts: Map<string, string>,
  ): DetectedSignal[]
}
```

### Engine change

Before running detectors, query all `repoContext` rows for the workspace into a `Map<repoFullName, contextText>`. Pass this map to every detector.

### Detector behavior

Each detector optionally checks the context map for the repo it's evaluating. Matching is case-insensitive substring search (e.g., `context.toLowerCase().includes('low cadence')`) — simple, fast, deterministic. No word-boundary matching needed since the keywords are multi-word phrases unlikely to appear as substrings of unrelated text.

Example suppression rules:

| Detector | Context keywords | Behavior |
|---|---|---|
| dormant | "low cadence", "infrequently updated", "stable", "maintenance mode" | Skip signal entirely |
| health-drop | "expected decline", "winding down" | Downgrade severity to info |
| pr-stale | "long-lived PRs", "slow review" | Downgrade severity to info |

Detectors without meaningful suppression patterns ignore the context map.

## LLM Enrichment Pipeline

### When it runs

At the end of `runSignalDetection()`, after raw signals are inserted. Only runs if:
- `enrichment.enabled` setting is `true`
- There are new signals to enrich
- `ANTHROPIC_API_KEY` env var is set

### Input

- Batch of newly detected signals (raw body, type, severity, repo)
- All repo contexts for the workspace

### Prompt structure

System prompt instructs Claude to:
- Rewrite each signal body to incorporate relevant repo context
- Adjust tone/priority based on maintainer notes
- Keep output concise (1-2 sentences per signal)
- Return a JSON array of `{ signalId, enrichedBody }` objects

### Model

Read from `settings` table key `enrichment.model`. Default: `claude-haiku-4-5-20251001`.

### Output

Each signal row gets its `enrichedBody` column updated with the LLM response.

### Failure handling

If the Claude API call fails (network error, rate limit, missing API key), signals keep their raw `body` and `enrichedBody` stays null. No degraded experience — the UI falls back to raw body.

## Signal Dismissal Flow

### From signal card

1. User clicks dismiss button on a signal card
2. Inline form appears with a text input for the reason
3. On submit, `PATCH /api/signals/[id]/dismiss` is called with `{ reason }`
4. Backend sets `signal.status = 'dismissed'` and `signal.dismissedReason = reason`
5. Backend upserts `repo_context` for that signal's repo:
   - If no context exists: creates with the dismiss reason as initial context
   - If context exists: appends the dismiss reason on a new line (simple `\n` separator — context is free-text, not structured)
6. Signal moves from Active tab to Dismissed tab

### From repo settings (proactive)

1. User navigates to repo detail page
2. "Context" section shows editable textarea with current `repoContext.context`
3. On save, `PUT /api/repo-context` is called with `{ workspaceId, repoFullName, context }`
4. Backend upserts the `repoContext` row

## API Endpoints

### `PATCH /api/signals/[id]/dismiss`

Request body: `{ reason: string }`

Actions:
1. Set `signal.status = 'dismissed'`, `signal.dismissedReason = reason`
2. Upsert `repoContext` for the signal's `(workspaceId, repoFullName)` with the reason

### `PUT /api/repo-context`

Request body: `{ workspaceId: number, repoFullName: string, context: string }`

Actions:
1. Upsert `repoContext` row for the given workspace + repo

### `GET /api/repo-context?workspaceId=X&repo=Y`

Returns the `repoContext` row for the given workspace + repo, or null.

## UI Changes

### Signal feed tabs

`SignalFeed` component becomes tabbed:
- **Active** — signals where `status === 'active'`, displays `enrichedBody ?? body`
- **Dismissed** — signals where `status === 'dismissed'`, shows dismiss reason alongside the signal

Severity filter badges remain on the Active tab.

### Signal card dismiss action

Each signal card gets a dismiss button. Clicking opens an inline form:
- Text input for the reason (placeholder: "Why is this signal not useful?")
- Confirm button
- Cancel to close without action

### Repo context editor

On the repo detail/settings page, a "Context" section:
- Editable textarea showing current repo context
- Save button
- Helper text: "Describe this repo's expected behavior. This shapes signal detection and feed generation."

## Sync Pipeline (Updated)

```
SYNC TRIGGER
  |
  +-- Fetch repos & PRs from GitHub
  +-- Filter exclusions
  +-- Score repos
  +-- Update DB (repos, PRs)
  |
  +-- DETECTION LAYER
  |     +-- Load repoContext map for workspace
  |     +-- Run detectors (with context suppression)
  |     +-- Insert raw signals (status: 'active', enrichedBody: null)
  |
  +-- ENRICHMENT LAYER
        +-- Check enrichment.enabled setting
        +-- Load new signals + all repo contexts
        +-- Call Claude API (model from settings table)
        +-- Update enrichedBody on each signal
        +-- On failure: no-op, signals keep raw body
```

## Dependencies

- `@anthropic-ai/sdk` npm package for Claude API calls
- `ANTHROPIC_API_KEY` environment variable

## Migration

Drizzle migration adding:
- `repoContext` table with unique index on `(workspace_id, repo_full_name)`
- `settings` table
- Three new columns on `signals`: `status`, `dismissedReason`, `enrichedBody`
- Seed `settings` with default values for `enrichment.model` and `enrichment.enabled`
