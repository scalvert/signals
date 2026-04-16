import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import type { NextAuthConfig } from 'next-auth'
import { getSetting } from '@/lib/db/queries'
import { upsertUser } from './users'

function getAuthConfig(): NextAuthConfig {
  const clientId = getSetting('github.app.clientId') ?? process.env.GITHUB_APP_CLIENT_ID ?? ''
  const clientSecret = getSetting('github.app.clientSecret') ?? process.env.GITHUB_APP_CLIENT_SECRET ?? ''

  return {
    providers: [
      GitHub({
        clientId,
        clientSecret,
        authorization: {
          params: { scope: 'repo read:org read:user' },
        },
      }),
    ],
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account && profile) {
          const user = upsertUser({
            githubLogin: profile.login as string,
            name: (profile.name as string) ?? (profile.login as string),
            avatarUrl: (profile.avatar_url as string) ?? '',
            accessToken: account.access_token!,
            refreshToken: account.refresh_token ?? null,
            tokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000).toISOString()
              : null,
          })
          token.userId = user.id
          token.githubLogin = user.githubLogin
          token.avatarUrl = user.avatarUrl
          token.accessToken = account.access_token
          token.refreshToken = account.refresh_token
          token.expiresAt = account.expires_at
        }

        if (token.expiresAt && Date.now() > (token.expiresAt as number) * 1000) {
          if (token.refreshToken) {
            try {
              const cId = getSetting('github.app.clientId') ?? process.env.GITHUB_APP_CLIENT_ID ?? ''
              const cSecret = getSetting('github.app.clientSecret') ?? process.env.GITHUB_APP_CLIENT_SECRET ?? ''
              const res = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                  client_id: cId,
                  client_secret: cSecret,
                  grant_type: 'refresh_token',
                  refresh_token: token.refreshToken,
                }),
              })
              const data = await res.json()
              if (data.access_token) {
                token.accessToken = data.access_token
                token.expiresAt = Math.floor(Date.now() / 1000 + data.expires_in)
                if (data.refresh_token) token.refreshToken = data.refresh_token

                upsertUser({
                  githubLogin: token.githubLogin as string,
                  name: token.name as string,
                  avatarUrl: token.avatarUrl as string,
                  accessToken: data.access_token,
                  refreshToken: data.refresh_token ?? (token.refreshToken as string),
                  tokenExpiresAt: new Date((token.expiresAt as number) * 1000).toISOString(),
                })
              }
            } catch (err) {
              console.error('[signals] Token refresh failed:', err)
              token.error = 'RefreshTokenError'
            }
          }
        }

        return token
      },
      async session({ session, token }) {
        session.user.id = String(token.userId)
        session.user.githubLogin = token.githubLogin as string
        session.user.avatarUrl = token.avatarUrl as string
        session.accessToken = token.accessToken as string
        if (token.error) session.error = token.error as string
        return session
      },
    },
    pages: {
      signIn: '/setup',
    },
  }
}

export function getAuth() {
  return NextAuth(getAuthConfig())
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      githubLogin: string
      avatarUrl: string
    }
    accessToken: string
    error?: string
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    userId?: number
    githubLogin?: string
    avatarUrl?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: string
  }
}
