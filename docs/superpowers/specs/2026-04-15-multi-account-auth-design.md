# Multi-Account GitHub Auth

Adds GitHub OAuth authentication with support for multiple accounts. Users authenticate via GitHub, and each account provides access to different orgs and repos. A user switcher in the sidebar lets users switch between GitHub identities.

## Problem

Signals uses a single global `GITHUB_TOKEN` for all API calls. Users with multiple GitHub accounts (personal + work) can only access repos visible to one token. Private repos from other orgs are invisible.

## Solution

GitHub OAuth via Auth.js (NextAuth) with a GitHub App created through GitHub's Manifest flow (one-click setup). Each GitHub identity is a separate user with its own OAuth token. Workspaces belong to a user, and the workspace's API calls use its owner's token.

## Auth Approach

**OAuth App via GitHub App Manifest** — not a traditional GitHub App installation. The GitHub App is created purely for OAuth credentials. We use its user-to-server OAuth tokens, which grant access to everything the user can see (same as an OAuth App). Our workspace source configuration remains the only repo selection layer — no conflict with GitHub App installation permissions.

## Data Model

### New `users` table

| Column | Type | Notes |
|---|---|---|
| id | integer PK | auto-increment |
| githubLogin | text | unique |
| name | text | display name from GitHub profile |
| avatarUrl | text | GitHub profile image URL |
| accessToken | text | encrypted OAuth access token |
| refreshToken | text | encrypted OAuth refresh token |
| tokenExpiresAt | text | nullable, when accessToken expires |
| createdAt | text | ISO timestamp |

### Modified `workspaces` table

Add `userId` integer column — FK to users. Each workspace belongs to one user. The user's token is used for all GitHub API calls within that workspace.

### Octokit changes

`getOctokit()` becomes `getOctokit(token: string)` — no more global singleton. Cached instance keyed by token. Each sync/fetch call passes the workspace owner's token.

## Auth.js Integration

Uses `next-auth` with the GitHub provider.

### Route handler

`app/api/auth/[...nextauth]/route.ts` — standard Auth.js catch-all route.

### Configuration

- GitHub provider with `clientId` and `clientSecret` from settings table (populated by manifest flow)
- OAuth scopes: `repo`, `read:org`, `read:user`
- JWT callback: persists `accessToken`, `refreshToken`, `tokenExpiresAt`, handles automatic token refresh on expiry
- Session callback: exposes `user.id`, `user.githubLogin`, `user.avatarUrl`
- SignIn callback: creates or updates user record in `users` table

### Token refresh

GitHub App OAuth tokens expire after 8 hours. Auth.js JWT callback detects expiry and uses the refresh token to get a new access token automatically. Updated tokens are persisted to the `users` table.

## Setup Flow (GitHub App Manifest)

### First-run experience (`/setup`)

1. Fresh install detects no GitHub App credentials in settings
2. Shows welcome page with "Connect to GitHub" button
3. Button redirects to `https://github.com/settings/apps/new?manifest=<encoded>` with:
   - App name: "Signals"
   - User permissions: repo contents (read), org members (read), user profile (read)
   - Callback URL: `{origin}/api/auth/callback/github`
   - Setup URL: `{origin}/api/github/setup-callback`
4. User clicks "Create GitHub App" on GitHub
5. GitHub redirects back with a `code`
6. Server exchanges code for app credentials (client_id, client_secret, pem) via `POST https://api.github.com/app-manifests/{code}/conversions`
7. Credentials stored in settings table
8. Redirects to OAuth login with the newly created app
9. First user created from GitHub profile, first workspace setup begins

### Env vars

```
NEXTAUTH_SECRET=...         # Required: encrypts JWT/tokens
NEXTAUTH_URL=http://localhost:3000  # Required: app URL for callbacks
```

No `GITHUB_TOKEN` needed for new installs. Existing installs with `GITHUB_TOKEN` get a migration that creates a default user.

## Account Management

### Adding accounts

"Add GitHub account" in the user switcher triggers `signIn('github')`. If the user logs in with a different GitHub account, a new user record is created.

### Switching accounts

Clicking a different account in the switcher calls `signIn('github', { login: targetLogin })` — GitHub's OAuth supports the `login` hint parameter to pre-fill the account. Auth.js updates the session.

## User Switcher UI

**Location:** Bottom of the sidebar, mirroring GitHub's account switcher pattern.

**Collapsed:** Active user's GitHub avatar (from `avatarUrl`), login name, swap icon.

**Popover (open):**
- All users listed with GitHub avatar and login
- Active user has a checkmark
- Workspace count per user as secondary text
- "Add GitHub account" button triggers new OAuth flow
- Sign out option

**Effect of switching:**
- Session updates to selected user
- Workspace selector reloads filtered by `workspace.userId`
- If one workspace, auto-navigate. If multiple, show picker.

## Migration

### Existing installs

1. If `GITHUB_TOKEN` env var exists, create a default user by fetching profile from GitHub API
2. Assign all existing workspaces to that default user
3. App continues to work without OAuth setup
4. User can optionally go through the manifest flow to enable full OAuth

### New installs

1. `/setup` page shown on first visit
2. GitHub App Manifest flow creates credentials
3. First OAuth login creates the first user
4. Guided into workspace creation

## Implementation Phases

### Phase 1: Auth foundation
- Install `next-auth`
- `users` table + migration
- Auth.js route handler with GitHub provider
- GitHub App Manifest setup flow (`/setup`)
- Store/retrieve app credentials from settings table
- Token refresh in JWT callback
- `userId` FK on workspaces + migration
- Update `getOctokit()` to accept a token parameter

### Phase 2: User switcher UI
- User switcher component at bottom of sidebar (GitHub avatar, login)
- Account popover with avatar, login, workspace count, checkmark
- "Add GitHub account" triggers OAuth
- Account switching via signIn with login hint
- Workspace selector filtered by active user

### Phase 3: Wire everything through
- Sync engine uses workspace owner's token
- GitHub search/repos API endpoints use active user's token
- MCP server resolves user from session
- Migrate existing data (create default user from GITHUB_TOKEN, assign workspaces)
- Remove global GITHUB_TOKEN dependency (keep as optional fallback)
- Tests

## Files to Create/Modify

### Create
- `app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- `lib/auth/config.ts` — Auth.js configuration
- `app/setup/page.tsx` — First-run setup with manifest flow
- `app/api/github/setup-callback/route.ts` — Manifest callback handler
- `components/layout/UserSwitcher.tsx` — Account switcher component

### Modify
- `lib/db/schema.ts` — add users table, userId FK on workspaces
- `lib/db/queries.ts` — user CRUD, workspace queries filtered by user
- `lib/github/client.ts` — getOctokit(token) instead of global singleton
- `lib/sync/engine.ts` — pass user token through sync pipeline
- `lib/github/fetch-repos.ts` — accept token parameter
- `lib/github/fetch-prs.ts` — accept token parameter
- `app/api/github/search/route.ts` — use session user's token
- `app/api/github/repos/route.ts` — use session user's token
- `components/layout/Sidebar.tsx` — add UserSwitcher
- `app/workspace/[slug]/layout.tsx` — pass session to shell
- `types/workspace.ts` — add User type

### Install
- `next-auth` (Auth.js, JWT session mode — no DB session table needed)

## Dependencies

- `next-auth` — Auth.js for Next.js
- No other new dependencies expected — Auth.js handles GitHub OAuth, token refresh, and session management
