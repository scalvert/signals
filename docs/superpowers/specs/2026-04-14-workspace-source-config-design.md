# Workspace Source Configuration

Replaces the blind text-input source addition with a GitHub-connected typeahead search and per-source repo selection with visibility and fork filters.

## Problem

Adding sources to a workspace is error-prone (no validation, no search) and coarse (all-or-nothing repo inclusion). Users get repos they don't care about (forks, archived projects), can't see private repos, and have no way to select specific repos within an org or user account.

## Solution

1. A GitHub-connected typeahead search for finding orgs, users, and repos from the authenticated user's context.
2. Per-source repo selection: after adding an org/user source, an expandable panel shows all repos with checkboxes, a summary bar, search, and filter dropdowns for visibility and forks.
3. Updated sync engine that respects per-source selection and filters.

## Data Model

### Updated `WorkspaceSource`

```typescript
interface WorkspaceSource {
  type: 'org' | 'user' | 'repo'
  value: string
  repos?: SourceRepoSelection
}

interface SourceRepoSelection {
  mode: 'all' | 'selected'
  selected: string[]
  excludeForks?: boolean
  visibility?: 'all' | 'public' | 'private'
}
```

- `mode: 'all'` — include all repos matching filters (default when adding a source)
- `mode: 'selected'` — only include repos in the `selected` array
- `selected` — repo names (not fullNames; the org/user prefix is implied by the source value)
- `excludeForks` — only relevant for user sources; when true, forks are excluded from sync
- `visibility` — filter to public-only, private-only, or all

For `type: 'repo'` sources, the `repos` field is omitted — single repos are always fully included.

### Default for new sources

When a user adds an org/user source, it starts with:
```json
{ "mode": "all", "selected": [], "visibility": "all" }
```
This matches current behavior (all repos included). The user then optionally refines.

### Migration

Existing sources gain `repos: { mode: 'all', selected: [], visibility: 'all' }` as a default. The workspace-level `excludedRepos` column is no longer read by the sync engine but remains in the schema (removed in a future cleanup).

### Schema change: `isFork` column

Add `isFork` boolean column to the `repos` table, matching the `isPrivate` pattern. Add `isFork` to the GraphQL repo queries and `GitHubRepoNode` type.

## GitHub Search API

### `GET /api/github/search?q=<query>`

Typeahead endpoint. Searches the authenticated user's context using GitHub GraphQL:
- **Orgs**: `viewer { organizations }` filtered client-side by query string
- **User's own account**: included if the query matches the viewer's login
- **Repos**: `search(type: REPOSITORY, query: "user:<login> <query>")` scoped to accessible repos

Response:
```typescript
{
  orgs: { login: string; avatarUrl: string; repoCount: number }[]
  users: { login: string; avatarUrl: string }[]
  repos: { fullName: string; stars: number; isPrivate: boolean }[]
}
```

### `GET /api/github/repos?owner=<login>&type=org|user`

Returns the full repo list for an org or user, with metadata for the selection UI. Uses a lightweight GraphQL query (no `object(expression:)` tree lookups) to avoid the 502 issues seen with heavy queries on large accounts.

Response:
```typescript
{
  repos: {
    name: string
    fullName: string
    stars: number
    isPrivate: boolean
    isArchived: boolean
    isFork: boolean
  }[]
}
```

Page size: `first: 20` to stay within GitHub's resource limits (same as sync queries).

## Sync Engine Changes

For each org/user source during sync:
1. Fetch all repos from GitHub (existing behavior)
2. Apply the source's `SourceRepoSelection` filters:
   - `visibility: 'public'` → exclude private repos
   - `visibility: 'private'` → exclude public repos
   - `excludeForks: true` → exclude forks
   - `mode: 'selected'` → only keep repos whose name is in the `selected` array
   - `mode: 'all'` → keep everything passing the above filters
3. Score and insert filtered repos

The workspace-level `excludedRepos` field is no longer read. Filtering is fully per-source.

## UI Components

### `GitHubSourceSearch`

Typeahead search at the top of the workspace dialog.
- Composes shadcn `Command` (cmdk) for search input + results dropdown
- Debounced (300ms) calls to `/api/github/search?q=...`
- Results grouped by type (Orgs / Users / Repos) with avatars and metadata
- Selecting an org/user adds it to the sources list with `mode: 'all'` defaults and auto-expands the panel
- Selecting a repo adds it as a `type: 'repo'` source (no expansion)

### `SourceRepoSelector`

Expandable panel inside each org/user source card.
- **Summary bar**: "18 of 24 selected" with Select all / Clear links
- **Filter row**: search input + Visibility dropdown. User sources also get a Forks dropdown.
- **Vertical repo list**: rows with checkbox, repo name, star count, and visibility/fork badge. Unselected repos are dimmed.
- Repos loaded from `/api/github/repos?owner=...&type=...` on first expansion, cached in component state
- Checking/unchecking updates the parent source's `SourceRepoSelection` in dialog state

### `SourceCard`

Collapsible card for each source in the list.
- **Header**: avatar (square for orgs, round for users), name, type badge, summary ("18 of 24 repos"), remove button, expand/collapse toggle
- **Body** (org/user only): renders `SourceRepoSelector`
- **Repo sources**: header only, no expansion — just name and remove button

### `WorkspaceDialog` changes

- Replace the source type toggle + text input + add button with `GitHubSourceSearch`
- Replace the flat source list with a list of `SourceCard` components
- Sources state becomes `WorkspaceSource[]` with the full `repos` selection data
- Save button sends the complete sources array to the API
- Remove the `excludedRepos` text input (no longer needed)

## Files Changed

- Create: `components/workspace/GitHubSourceSearch.tsx`
- Create: `components/workspace/SourceRepoSelector.tsx`
- Create: `components/workspace/SourceCard.tsx`
- Create: `app/api/github/search/route.ts`
- Create: `app/api/github/repos/route.ts`
- Modify: `components/workspace/WorkspaceDialog.tsx` — replace source input with new components
- Modify: `types/workspace.ts` — update `WorkspaceSource`, add `SourceRepoSelection`
- Modify: `lib/db/schema.ts` — add `isFork` column to repos
- Modify: `lib/github/types.ts` — add `isFork` to `GitHubRepoNode`
- Modify: `lib/github/queries.ts` — add `isFork` to repo query nodes, add lightweight picker queries
- Modify: `lib/github/fetch-repos.ts` — pass `isFork` through, apply source filters
- Modify: `lib/github/fetch-prs.ts` — apply source filters (skip repos not in selection)
- Modify: `lib/sync/engine.ts` — replace `excludedRepos` filtering with per-source selection
- Generate: Drizzle migration for `isFork` column

## Dependencies

No new packages. Uses existing `cmdk` (via shadcn Command), `@ai-sdk/anthropic` (not needed here), and Octokit GraphQL.
