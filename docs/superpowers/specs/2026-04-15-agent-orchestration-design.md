# Agent Orchestration for Signal-Driven OSS Maintenance

Transforms Signals from a monitoring dashboard into an orchestration platform. Users create tasks from signals and failing checks, dispatch them to coding agents (Claude Code, Cursor, Codex), track work in flight, and verify fixes automatically on the next sync.

## Problem

Signals identifies problems across repos but can't act on them. Maintainers must context-switch to each repo, remember what the signal said, and manually fix it. There's no way to delegate work to agents, track what's in flight, or verify that a fix landed.

## Solution

Five subsystems:

1. **Task data model + MCP server** — tasks table, bidirectional MCP server for agent communication
2. **Task generation UI** — one-click task creation from signals and failing checks
3. **Work view** — top-level page showing all tasks across repos with status tracking
4. **Agent dispatch** — provider-agnostic adapter for local (Claude Code, Cursor) and cloud (Codex) agents
5. **Verification** — sync engine auto-verifies completed tasks by re-running the originating check/signal

## Data Model

### New `tasks` table

| Column | Type | Notes |
|---|---|---|
| id | integer PK | auto-increment |
| workspaceId | integer | FK to workspaces |
| repoFullName | text | which repo this task is for |
| title | text | human-readable task title |
| description | text | detailed instruction for the agent |
| sourceType | text | `'signal'` or `'check'` |
| sourceId | text | signal ID or check ID that spawned it |
| status | text | `'pending'` \| `'dispatched'` \| `'completed'` \| `'verified'` \| `'failed'` |
| provider | text | nullable — which agent provider handled it |
| providerRef | text | nullable — external reference (PR URL, session ID) |
| notes | text | JSON array of `{ text: string, timestamp: string, source: 'agent' \| 'system' }` |
| createdAt | text | ISO timestamp |
| dispatchedAt | text | nullable |
| completedAt | text | nullable |

### Status lifecycle

```
pending → dispatched → completed → verified
                    ↘ failed
```

- `pending` — created by user, ready to dispatch
- `dispatched` — sent to an agent provider
- `completed` — agent reported done (via MCP), pending sync verification
- `verified` — next sync confirmed the fix (check now passes or signal no longer triggers)
- `failed` — agent reported failure or sync showed no improvement

### Agent provider configuration

Stored in settings table under key `agent.providers` as a JSON array:

```json
[
  { "type": "claude-code", "mode": "local", "default": true },
  { "type": "cursor", "mode": "local" },
  { "type": "codex", "mode": "cloud", "apiKey": "..." }
]
```

## MCP Server

Stdio transport using `@modelcontextprotocol/sdk`. Reuses existing query functions from `lib/db/queries.ts`.

### Read tools (agents query Signals for context)

| Tool | Description |
|---|---|
| `get_workspace_summary` | Repo count, health scores, signal count |
| `get_repo_health` | Detailed score breakdown with pillar scores and check results |
| `get_repo_signals` | All active signals for a specific repo |
| `get_repo_actionable_items` | Combined: failing checks + active signals for a repo, each with description and suggested fix. Ready to be worked on directly. |
| `get_task_details` | Full context for a specific dispatched task |

### Write tools (agents report back to Signals)

| Tool | Description |
|---|---|
| `create_task_from_item` | Agent creates a task from an actionable item (self-serve from CLI) |
| `update_task_status` | Set status to `completed` or `failed`, with optional `providerRef` (PR URL) |
| `add_task_note` | Append a timestamped note to a task (progress updates, blockers) |

### Agent-initiated workflow (no UI needed)

An agent working in a repo can pull work directly from Signals:

```
Agent → get_repo_actionable_items("gleanwork/mcp-server")
     ← [{ type: "check", id: "has-license", title: "Add LICENSE file" }, ...]
Agent → create_task_from_item("check", "has-license")
     ← { taskId: 7, status: "dispatched" }
Agent: (works on it)
Agent → update_task_status(7, "completed", { providerRef: "PR #15" })
```

## Channel Server

A separate channel server (`mcp/channel.ts`) implements the Claude Code channel contract for push-based dispatch.

- Listens on a local HTTP port
- Signals web app POSTs a task payload to this port
- Channel server pushes it into the running Claude Code session as a `<channel>` event
- Claude receives the task, works on it, reports back via MCP write tools

```
Signals Web App
    │
    ├── POST to channel server (localhost:PORT)
    │       ↓
    │   Channel Server → pushes event → Claude Code session
    │                                        │
    │                                        │ (works on task)
    │                                        │
    │                                        ↓
    │                                   MCP Server
    │                                   update_task_status()
    │                                        │
    └──────────── DB updated ←───────────────┘
```

## Agent Provider Adapter

Pluggable dispatch system. Each provider implements a common interface:

```typescript
interface AgentProvider {
  type: string
  mode: 'local' | 'cloud'
  dispatch(task: Task): Promise<DispatchResult>
}

interface DispatchResult {
  success: boolean
  providerRef?: string
  error?: string
}
```

### Built-in providers

| Provider | Mode | Dispatch mechanism |
|---|---|---|
| `claude-code` | local | Channel push (if session running) or CLI launch (`claude --prompt`) |
| `cursor` | local | CLI launch with prepopulated prompt |
| `codex` | cloud | Codex API call |
| `custom` | either | Webhook POST to user-configured URL |

### Prompt template system

Each dispatch wraps the task in a structured prompt template:

```
You are working on the repository {repoFullName}.

## Task
{task.title}

## Context
{task.description}

## Instructions
- Fix the issue described above
- Run tests to verify your fix
- When done, use the Signals MCP server to report completion:
  update_task_status({taskId}, "completed", { providerRef: "PR URL or description" })

## Signals MCP Server
Connect to the Signals MCP server for additional context:
- get_repo_health("{repoFullName}") for full health breakdown
- get_repo_actionable_items("{repoFullName}") for other items to fix
```

Templates are provider-aware: Claude Code gets MCP instructions, Cursor gets a simpler prompt, cloud agents get API-specific instructions.

## Task Generation UI

### From signal cards

Each signal card in the feed gets a "Fix this" button alongside "Dismiss". Clicking creates a `pending` task with:
- Title auto-generated from signal (e.g., "Review 2 stale PRs on gleanwork/mcp-server")
- Description from `enrichedBody ?? body` + signal metadata
- `sourceType: 'signal'`, `sourceId: signal.id`

### From failing checks

Each check in the repo detail panel's "Actions Needed" section gets a "Fix" button alongside "Dismiss". Clicking creates a `pending` task with:
- Title from check name + repo (e.g., "Add LICENSE file to gleanwork/mcp-server")
- Description from `check.actionable` text + evidence
- `sourceType: 'check'`, `sourceId: check.id`

## Work View

New top-level page at `/workspace/[slug]/work` with sidebar navigation entry.

### Layout

Task list table:

| Column | Content |
|---|---|
| Task | Title + repo badge |
| Source | Signal or check that spawned it |
| Status | Badge: pending / dispatched / completed / verified / failed |
| Provider | Which agent is handling it |
| Ref | Link to PR or external reference |
| Created | Timestamp |

Filters: status, repo, provider. Sortable columns.

### Dispatch from Work view

Pending tasks show a "Dispatch" button with a provider dropdown. Batch dispatch: select multiple tasks, dispatch all at once.

## Verification on Sync

After each sync, the engine checks tasks with `completed` status:

- `sourceType === 'check'`: re-run the check for that repo. If it now passes → status becomes `verified`. If still failing → stays `completed` (the fix may not have been merged yet).
- `sourceType === 'signal'`: check if the signal would still trigger with current data. If not → `verified`.

Tasks that remain `completed` for more than 7 days without verification get a "stale" indicator in the Work view.

## Implementation Phases

### Phase 1: Foundation (tasks table + MCP server)
- `tasks` table + migration
- Task CRUD query functions and types
- MCP server with stdio transport: all read tools + write tools
- Tests for task queries and MCP tool logic
- `npm run mcp` script working

### Phase 2: Task generation UI
- "Fix this" button on signal cards in SignalFeed
- "Fix" button on failing checks in repo detail panel
- `POST /api/tasks` endpoint for task creation
- Tasks created in `pending` state

### Phase 3: Work view
- New `/workspace/[slug]/work` page
- Task list with filters and sorting
- Sidebar navigation entry
- Task status badges with visual states

### Phase 4: Agent dispatch (local)
- Agent provider adapter interface
- Claude Code provider (channel push + CLI fallback)
- Cursor provider (CLI launch)
- Provider settings UI in workspace settings
- Dispatch button with provider dropdown
- Batch dispatch support
- Prompt template system

### Phase 5: Verification + cloud dispatch
- Sync engine verifies `completed` tasks against current check/signal state
- Status transitions: completed → verified
- Codex cloud provider
- Custom webhook provider
- Stale task indicators

## Files to Create/Modify

### Create
- `mcp/server.ts` — MCP server with read/write tools
- `mcp/channel.ts` — Claude Code channel server
- `lib/tasks/types.ts` — Task, AgentProvider, DispatchResult types
- `lib/tasks/providers/` — provider adapters (claude-code.ts, cursor.ts, codex.ts, custom.ts)
- `lib/tasks/dispatch.ts` — dispatch manager
- `lib/tasks/prompts.ts` — prompt template system
- `components/screens/Work.tsx` — Work view component
- `app/workspace/[slug]/work/page.tsx` — Work page route
- `app/api/tasks/route.ts` — Task CRUD endpoint
- `app/api/tasks/[id]/dispatch/route.ts` — Dispatch endpoint

### Modify
- `lib/db/schema.ts` — add tasks table
- `lib/db/queries.ts` — add task query functions
- `lib/sync/engine.ts` — add task verification step
- `types/workspace.ts` — add Task type
- `components/screens/SignalFeed.tsx` — add "Fix this" button
- `components/screens/Repositories.tsx` — add "Fix" button on checks
- `components/layout/Sidebar.tsx` — add Work nav item

## Dependencies

- `@modelcontextprotocol/sdk` — already installed
- No new dependencies needed
