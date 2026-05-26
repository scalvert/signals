import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'

export const sqlite = new Database(':memory:')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_login TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    github_installation_id INTEGER,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sources TEXT NOT NULL,
    excluded_repos TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS github_installations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installation_id INTEGER NOT NULL UNIQUE,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL,
    repository_selection TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    joined_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_idx
    ON workspace_members (workspace_id, user_id);

  CREATE TABLE IF NOT EXISTS repo_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    repo_full_name TEXT NOT NULL,
    permission TEXT NOT NULL,
    can_dispatch INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS repo_permissions_workspace_user_repo_idx
    ON repo_permissions (workspace_id, user_id, repo_full_name);

  CREATE TABLE IF NOT EXISTS dispatch_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS dispatch_targets_workspace_type_idx
    ON dispatch_targets (workspace_id, type);

  CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    language TEXT,
    stars INTEGER NOT NULL DEFAULT 0,
    forks INTEGER NOT NULL DEFAULT 0,
    open_issues INTEGER NOT NULL DEFAULT 0,
    open_prs INTEGER NOT NULL DEFAULT 0,
    last_commit_at TEXT,
    last_release_at TEXT,
    has_ci INTEGER NOT NULL DEFAULT 0,
    has_license INTEGER NOT NULL DEFAULT 0,
    has_contributing INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0,
    is_fork INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    grade TEXT NOT NULL DEFAULT 'F',
    triage TEXT NOT NULL DEFAULT 'critical',
    pillars TEXT NOT NULL,
    check_results TEXT NOT NULL DEFAULT '{}',
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    detected_at TEXT NOT NULL,
    resolved_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    dismissed_reason TEXT,
    enriched_body TEXT,
    fixable INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    repo_full_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider TEXT,
    provider_ref TEXT,
    notes TEXT NOT NULL DEFAULT '[]',
    dispatch_state TEXT,
    result_ref TEXT,
    status_line TEXT,
    created_at TEXT NOT NULL,
    dispatched_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS task_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL,
    dispatch_target_id INTEGER,
    orchestrator TEXT NOT NULL,
    runner TEXT NOT NULL,
    status TEXT NOT NULL,
    external_id TEXT,
    external_url TEXT,
    branch TEXT,
    pr_url TEXT,
    summary TEXT,
    error TEXT,
    raw_state TEXT,
    dispatched_by_user_id INTEGER NOT NULL,
    executed_by_identity TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
`)

export const db = drizzle(sqlite, { schema })
