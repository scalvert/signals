import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const workspaces = sqliteTable('workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sources: text('sources').notNull(), // JSON array of WorkspaceSource
  excludedRepos: text('excluded_repos').notNull().default('[]'), // JSON array of fullName strings
  createdAt: text('created_at').notNull(),
})

export const repos = sqliteTable('repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description'),
  url: text('url').notNull(),
  language: text('language'),
  stars: integer('stars').notNull().default(0),
  forks: integer('forks').notNull().default(0),
  openIssues: integer('open_issues').notNull().default(0),
  openPRs: integer('open_prs').notNull().default(0),
  lastCommitAt: text('last_commit_at'),
  lastReleaseAt: text('last_release_at'),
  hasCI: integer('has_ci', { mode: 'boolean' }).notNull().default(false),
  hasLicense: integer('has_license', { mode: 'boolean' })
    .notNull()
    .default(false),
  hasContributing: integer('has_contributing', { mode: 'boolean' })
    .notNull()
    .default(false),
  isPrivate: integer('is_private', { mode: 'boolean' })
    .notNull()
    .default(false),
  isFork: integer('is_fork', { mode: 'boolean' })
    .notNull()
    .default(false),
  score: real('score').notNull().default(0),
  grade: text('grade').notNull().default('F'),
  triage: text('triage').notNull().default('critical'),
  pillars: text('pillars').notNull(), // JSON: {activity, community, quality, security}
  checkResults: text('check_results').notNull().default('{}'), // JSON: Record<checkId, CheckResult>
  syncedAt: text('synced_at').notNull(),
})

export const pullRequests = sqliteTable('pull_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  authorLogin: text('author_login').notNull(),
  authorAssociation: text('author_association').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  isDraft: integer('is_draft', { mode: 'boolean' }).notNull().default(false),
  ciState: text('ci_state').notNull().default('unknown'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncedAt: text('synced_at').notNull(),
})

export const signals = sqliteTable('signals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull(),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  metadata: text('metadata').notNull().default('{}'), // JSON
  detectedAt: text('detected_at').notNull(),
  resolvedAt: text('resolved_at'),
  status: text('status').notNull().default('active'),
  dismissedReason: text('dismissed_reason'),
  enrichedBody: text('enriched_body'),
})

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull(),
  status: text('status').notNull(), // 'running' | 'success' | 'error'
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  repoCount: integer('repo_count'),
  error: text('error'),
})

export const repoContext = sqliteTable('repo_context', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  context: text('context').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('repo_context_workspace_repo_idx').on(table.workspaceId, table.repoFullName),
])

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})
