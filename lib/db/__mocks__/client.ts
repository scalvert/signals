import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'

export const sqlite = new Database(':memory:')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sources TEXT NOT NULL,
    excluded_repos TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
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
    created_at TEXT NOT NULL,
    dispatched_at TEXT,
    completed_at TEXT
  );
`)

export const db = drizzle(sqlite, { schema })
