# <img src="https://github.com/user-attachments/assets/placeholder" alt="" width="0" height="0" /> Signals

> [!WARNING]
> Signals is under active development. The data model and surfaces may still change.

**Signals tells an OSS maintainer the few things most worth their time across all their repos — and hands any of them to a coding agent that opens the PR.**

It's GitHub-native and zero-infra: a scheduled GitHub Action ranks attention across your repos, keeps the result as structured data in the repo, and surfaces it where you already are — your AI tool (MCP), a rolling digest issue, and Slack/email. There is no server, no database, and no login to manage.

## How it works

```
        ┌─ scheduled Action ──────────────────────────────────────┐
        │  fetch repos + PRs → score & rank → state/signals.json   │
        └─────────────┬───────────────────────────────────────────┘
                      │ renders the same ranked data to…
   ┌──────────────────┼─────────────────────────────┐
   ▼                  ▼                              ▼
 MCP server      rolling digest issue          Slack + email
 (list_attention, (one issue, updated          (low-volume, ranked —
  dispatch_item)   in place; comment             outside the GitHub
                   /dispatch <id>)               notification firehose)
                      │
                      ▼
            opens a scoped issue in the target repo →
            the Claude GitHub app implements it → PR
```

- **State, not noise.** `state/signals.json` is the single source of truth — structured and queryable; `git diff` between runs is the changelog.
- **Three ways to act**, all over the same data: ask your AI tool ("what should I work on?"), open the digest issue, or tap a Slack notification on your phone.
- **The agents do the work.** Signals decides *what*; GitHub Copilot or the Claude GitHub app does the coding and opens the PR.

## Quick start

1. **Use this repo as a template** (or clone it) for your own `signals` repo.
2. **Add secrets** (Settings → Secrets and variables → Actions):
   - `SIGNALS_GH_TOKEN` — a fine-grained PAT with **Contents: read**, **Issues: read/write**, **Pull requests: read/write**, **Metadata: read** on the repos you want to watch. (The default `GITHUB_TOKEN` can only see this repo.)
   - `ANTHROPIC_API_KEY` — for the Claude GitHub app on your target repos (and optional enrichment).
   - *(optional)* `SIGNALS_SLACK_WEBHOOK`, `SIGNALS_SMTP_URL` for notifications.
3. **Edit `signals.config.yml`** — what to watch, dispatch agent, and notification channels.
4. **Run it:** trigger the **Signals Digest** workflow (or wait for the schedule). It updates `state/signals.json`, upserts the digest issue, and notifies.
5. **Act on it** from your AI tool (below), from the digest issue (`/dispatch <id>`), or from Slack.

For dispatch to open PRs, each **target repo** needs the [Claude GitHub app](https://github.com/apps/claude) + `ANTHROPIC_API_KEY` + a `claude.yml` workflow (see `.github/workflows/claude.yml`).

## Use it from your AI tool (MCP)

Signals ships a local stdio MCP server. Add it to Claude Code / Cursor / Codex:

```json
{
  "mcpServers": {
    "signals": { "command": "npx", "args": ["tsx", "src/mcp.ts"] }
  }
}
```

| Tool | What it does |
|------|--------------|
| `list_attention` | The ranked "what should I work on?" list across your repos |
| `get_item` | Full detail + the ready-to-dispatch prompt for one item |
| `dispatch_item` | Open a scoped issue in the target repo and route it to the agent |

## Configuration (`signals.config.yml`)

```yaml
sources:                # what to watch
  - type: user          # user | org | repo
    value: your-handle
    repos: { mode: all, excludeForks: true, visibility: public }
excludedRepos: []
digest: { topN: 10 }
dispatch: { agent: claude }   # claude | copilot
notifications:
  slack: { enabled: false, channel: '' }   # webhook → env SIGNALS_SLACK_WEBHOOK
  email: { enabled: false, to: '', from: '' }  # SMTP → env SIGNALS_SMTP_URL
```

Secrets are **named, not stored** here — set them as environment variables / Actions secrets.

## Health & signals

Each repo is scored 0–100 across pillars (Activity, Community, Quality) by deterministic checks in `lib/signals/definitions/`, and event detectors flag dormant repos, stale PRs, milestones, and more. Items are ranked by severity, repo liveness, and how actionable they are (extreme dormancy is treated as an archive decision, not urgent work).

## Development

```bash
npm install
GITHUB_TOKEN=$(gh auth token) npm run digest   # print the ranked digest locally
npm run mcp                                     # run the MCP server
npm test                                        # vitest
npm run typecheck
```

## Tech

TypeScript (ESM, run via [tsx](https://tsx.is)) · [Octokit](https://github.com/octokit) (GitHub GraphQL/REST) · [MCP SDK](https://modelcontextprotocol.io) · [Vercel AI SDK](https://sdk.vercel.ai) + Claude (optional enrichment) · GitHub Actions. No server, no database.

## License

MIT
