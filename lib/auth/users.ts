import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import type { User } from '@/types/workspace'

interface UpsertUserData {
  githubLogin: string
  name: string
  avatarUrl: string
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: string | null
}

export function upsertUser(data: UpsertUserData): User {
  const now = new Date().toISOString()
  const existing = db
    .select()
    .from(users)
    .where(eq(users.githubLogin, data.githubLogin))
    .get()

  if (existing) {
    db.update(users)
      .set({
        name: data.name,
        avatarUrl: data.avatarUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      })
      .where(eq(users.id, existing.id))
      .run()
    return {
      id: existing.id,
      githubLogin: data.githubLogin,
      name: data.name,
      avatarUrl: data.avatarUrl,
      createdAt: existing.createdAt,
    }
  }

  const row = db
    .insert(users)
    .values({
      githubLogin: data.githubLogin,
      name: data.name,
      avatarUrl: data.avatarUrl,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      createdAt: now,
    })
    .returning()
    .get()

  return {
    id: row.id,
    githubLogin: row.githubLogin,
    name: row.name,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
  }
}

export function getAllUsers(): User[] {
  return db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .all()
}

export function getUserToken(userId: number): string | null {
  const row = db
    .select({ accessToken: users.accessToken })
    .from(users)
    .where(eq(users.id, userId))
    .get()
  return row?.accessToken ?? null
}
