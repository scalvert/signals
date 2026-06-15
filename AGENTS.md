# Signals — notes for agents

Signals is a **GitHub-native TypeScript tool** (ESM, run with `tsx`) — not a web app. There is no Next.js, no database, and no server.

## Layout

- `src/` — the program: `collect.ts` (fetch) → `rank.ts` (score + rank) → `state.ts` (the `state/signals.json` source of truth) → `render.ts` → `notify.ts` (Slack/email) / `issue.ts` (digest issue). Plus `mcp.ts` (stdio MCP server), `dispatch.ts` + `dispatch-cli.ts` (hand work to a coding agent), `reconcile.ts` (track dispatched PRs).
- `lib/signals/` — health checks + event detectors (the scoring/detection engine). Pure and well-tested; reused by the brain.
- `lib/github/` — Octokit fetch + repo filtering.
- `state/signals.json` — generated source of truth (committed by the digest Action).
- `.github/workflows/` — `digest` (scheduled), `dispatch` (`/dispatch` comments), `claude` (the agent that opens PRs).

## Conventions

- **ESM only.** The project sets `"type": "module"`; run TypeScript with `tsx` (e.g. `npm run digest`).
- **Verify before claiming done:** `npm run typecheck`, `npm test` (vitest), `npm run lint`.
- **Secrets live in env / Actions secrets, never in `signals.config.yml`** — this repo is public.
- Add a health check or detector under `lib/signals/definitions/` and register it in `lib/signals/definitions/index.ts`; write a test alongside it.
