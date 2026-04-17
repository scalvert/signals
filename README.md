# <img src="public/signals-icon.png" alt="Signals" width="32" height="32" /> Signals

> [!WARNING]
> Signals is under active development and not yet feature-complete. Some screens are rough, some features are stubbed, and the data model may change. That said — contributions, feedback, and ideas are very welcome. If something catches your eye, open an issue or a PR.

Self-hostable dashboard for OSS maintainers. Track health scores, detect signals, triage PRs, and query your repos with AI — across all your GitHub orgs and projects in one place.

![Signals Dashboard](screenshots/01-dashboard.png)

> [See the full UI tour →](docs/tour.md)

## Features

- **Health scoring** — deterministic 0–100 score per repo across four pillars (Activity, Community, Quality, Security) with actionable remediation
- **Signal detection** — automated alerts for star spikes, dormant repos, stale PRs, health drops, and milestones
- **AI chat** — ask questions about your repos using Claude with tool-calling against your live data
- **MCP server** — expose your repo data to Claude Code, Cursor, and other AI tools via Streamable HTTP
- **Workspace model** — group repos by org, by project, or mix-and-match across orgs
- **Repo filtering** — include/exclude specific repos per workspace

## Quick Start

```bash
git clone https://github.com/scalvert/signals.git
cd signals
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Add your GitHub token (create one at https://github.com/settings/tokens with `repo` and `read:org` scopes):

```
GITHUB_TOKEN=ghp_...
```

Optionally add an Anthropic API key for the AI chat panel:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Run the database migration and start the dev server:

```bash
npm run db:migrate
npm run dev
```

Visit http://localhost:3000 to create your first workspace.

## MCP Server

Signals exposes an MCP server at `/api/mcp` that AI coding tools can connect to.

### Claude Code

Add to your `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "signals": {
      "type": "streamable-http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_workspaces` | List all configured workspaces |
| `get_workspace_summary` | Repo count, health scores, top/bottom repos |
| `get_repos_needing_attention` | Repos below a health threshold |
| `get_external_prs` | Open PRs from external contributors |
| `get_repo_health` | Detailed per-check health breakdown for a repo |
| `get_signal_feed` | Recent signals (star spikes, health drops, etc.) |

## Health Scoring

Each repo is scored 0–100 across four pillars (25 points each):

| Pillar | Checks |
|--------|--------|
| **Activity** | Commit frequency, release cadence, PR merge velocity |
| **Community** | External PR ratio, first response time |
| **Quality** | CI configuration, LICENSE file, CONTRIBUTING.md |
| **Security** | Placeholder (OpenSSF Scorecard integration planned) |

Grades: **A** ≥ 80, **B** ≥ 65, **C** ≥ 50, **D** < 50

### Adding a Health Check

Health checks are pure functions in `lib/scoring/checks/`. To add one:

1. Create a file in the appropriate pillar directory (e.g. `lib/scoring/checks/quality/my-check.ts`)
2. Implement the `HealthCheck` interface:

```ts
import type { HealthCheck } from '../../types'

export const myCheck: HealthCheck = {
  id: 'my-check',
  name: 'My Check',
  description: 'What this checks',
  pillar: 'quality',
  weight: 0.2,
  applies: () => true,
  run(repo) {
    return {
      score: 1, // 0–1
      label: 'Check passed',
      evidence: ['reason'],
      actionable: undefined,
    }
  },
}
```

3. Register it in `lib/scoring/checks/index.ts`
4. Write a test in `test/lib/scoring/checks/`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | — | GitHub personal access token (required) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key for AI chat (optional) |
| `DATABASE_URL` | `./signals.db` | SQLite database path |
| `SYNC_INTERVAL_MINUTES` | `15` | Auto-sync interval |

## Tech Stack

- [Next.js](https://nextjs.org) 16 / React 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [shadcn/ui](https://ui.shadcn.com) components
- [Drizzle ORM](https://orm.drizzle.team) + SQLite
- [Octokit](https://github.com/octokit) (GitHub GraphQL API)
- [Vercel AI SDK](https://sdk.vercel.ai) + Claude
- [MCP SDK](https://modelcontextprotocol.io) (Streamable HTTP)

## License

MIT
