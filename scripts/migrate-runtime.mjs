import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const databaseUrl = process.env.DATABASE_URL || './signals.db'
const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER || './drizzle'

const sqlite = new Database(databaseUrl)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite)
migrate(db, { migrationsFolder })
sqlite.close()

console.info(`[signals] Applied database migrations to ${databaseUrl}`)

