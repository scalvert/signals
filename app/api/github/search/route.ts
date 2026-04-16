import { NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query = (url.searchParams.get('q') ?? '').toLowerCase().trim()

  if (!query) {
    return NextResponse.json({ orgs: [], users: [], repos: [] })
  }

  try {
    const octokit = getOctokit()

    const [orgUserResult, repoResult] = await Promise.all([
      octokit.rest.search.users({ q: `${query}`, per_page: 10 })
        .catch(() => ({ data: { items: [] } })),
      octokit.rest.search.repos({ q: `user:${query} fork:true`, per_page: 10 })
        .catch(() => ({ data: { items: [] } })),
    ])

    const orgs = orgUserResult.data.items
      .filter((item) => item.type === 'Organization')
      .slice(0, 5)
      .map((item) => ({
        login: item.login,
        avatarUrl: item.avatar_url,
        repoCount: item.public_repos ?? 0,
      }))

    const users = orgUserResult.data.items
      .filter((item) => item.type === 'User')
      .slice(0, 5)
      .map((item) => ({
        login: item.login,
        avatarUrl: item.avatar_url,
      }))

    const repos = repoResult.data.items
      .slice(0, 10)
      .map((item) => ({
        fullName: item.full_name,
        stars: item.stargazers_count ?? 0,
        isPrivate: item.private ?? false,
      }))

    return NextResponse.json({ orgs, users, repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[signals] GitHub search failed:', message)
    return NextResponse.json(
      { error: message, orgs: [], users: [], repos: [] },
      { status: 500 },
    )
  }
}
