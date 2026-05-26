import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repoPermissions, users } from '@/lib/db/schema'
import type { Session } from 'next-auth'
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
    const tokenChanged = existing.accessToken !== data.accessToken
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
    if (tokenChanged) {
      db.delete(repoPermissions)
        .where(eq(repoPermissions.userId, existing.id))
        .run()
    }
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

export function getUserById(userId: number): User | null {
  const row = db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  return row ?? null
}

export function getUserByLogin(githubLogin: string): User | null {
  const row = db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.githubLogin, githubLogin))
    .get()

  return row ?? null
}

export function getUserToken(userId: number): string | null {
  const row = db
    .select({ accessToken: users.accessToken })
    .from(users)
    .where(eq(users.id, userId))
    .get()
  return row?.accessToken ?? null
}

export function ensureUserFromSession(session: Session): User | null {
  if (session.error) return null

  const githubLogin = session.user?.githubLogin
  const accessToken = session.accessToken
  if (!githubLogin || !accessToken) return null

  const existingId = session.user?.id ? Number(session.user.id) : NaN
  if (Number.isFinite(existingId)) {
    const storedToken = getUserToken(existingId)
    if (storedToken) {
      if (storedToken !== accessToken) {
        return upsertUser({
          githubLogin,
          name: session.user.name ?? githubLogin,
          avatarUrl: session.user.avatarUrl ?? session.user.image ?? '',
          accessToken,
          refreshToken: null,
          tokenExpiresAt: null,
        })
      }
      return getUserById(existingId)
    }
  }

  const existing = getUserByLogin(githubLogin)
  if (existing) {
    const storedToken = getUserToken(existing.id)
    if (storedToken) {
      if (storedToken !== accessToken) {
        return upsertUser({
          githubLogin,
          name: session.user.name ?? githubLogin,
          avatarUrl: session.user.avatarUrl ?? session.user.image ?? '',
          accessToken,
          refreshToken: null,
          tokenExpiresAt: null,
        })
      }
      return existing
    }
  }

  return upsertUser({
    githubLogin,
    name: session.user.name ?? githubLogin,
    avatarUrl: session.user.avatarUrl ?? session.user.image ?? '',
    accessToken,
    refreshToken: null,
    tokenExpiresAt: null,
  })
}
