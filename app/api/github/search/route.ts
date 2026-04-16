import { NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github/client'

interface OrgSearchResult {
  search: {
    nodes: Array<{
      login?: string
      avatarUrl?: string
      repositories?: { totalCount: number }
    }>
  }
}

interface UserSearchResult {
  search: {
    nodes: Array<{
      login?: string
      avatarUrl?: string
    }>
  }
}

interface RepoSearchResult {
  search: {
    nodes: Array<{
      nameWithOwner?: string
      stargazerCount?: number
      isPrivate?: boolean
    }>
  }
}

const ORG_SEARCH_QUERY = `
  query OrgSearch($searchQuery: String!) {
    search(query: $searchQuery, type: USER, first: 5) {
      nodes {
        ... on Organization {
          login
          avatarUrl
          repositories { totalCount }
        }
      }
    }
  }
`

const USER_SEARCH_QUERY = `
  query UserSearch($searchQuery: String!) {
    search(query: $searchQuery, type: USER, first: 5) {
      nodes {
        ... on User {
          login
          avatarUrl
        }
      }
    }
  }
`

const REPO_SEARCH_QUERY = `
  query RepoSearch($searchQuery: String!) {
    search(query: $searchQuery, type: REPOSITORY, first: 10) {
      nodes {
        ... on Repository {
          nameWithOwner
          stargazerCount
          isPrivate
        }
      }
    }
  }
`

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query = (url.searchParams.get('q') ?? '').toLowerCase().trim()

  if (!query) {
    return NextResponse.json({ orgs: [], users: [], repos: [] })
  }

  try {
    const octokit = getOctokit()

    const [orgResult, userResult, repoResult] = await Promise.all([
      octokit.graphql<OrgSearchResult>(ORG_SEARCH_QUERY, {
        searchQuery: `${query} type:org`,
      }).catch(() => ({ search: { nodes: [] } }) as OrgSearchResult),
      octokit.graphql<UserSearchResult>(USER_SEARCH_QUERY, {
        searchQuery: `${query} type:user`,
      }).catch(() => ({ search: { nodes: [] } }) as UserSearchResult),
      octokit.graphql<RepoSearchResult>(REPO_SEARCH_QUERY, {
        searchQuery: `user:${query} fork:true`,
      }).catch(() => ({ search: { nodes: [] } }) as RepoSearchResult),
    ])

    const orgs = orgResult.search.nodes
      .filter((n) => n.login)
      .map((n) => ({
        login: n.login!,
        avatarUrl: n.avatarUrl ?? '',
        repoCount: n.repositories?.totalCount ?? 0,
      }))

    const users = userResult.search.nodes
      .filter((n) => n.login)
      .map((n) => ({
        login: n.login!,
        avatarUrl: n.avatarUrl ?? '',
      }))

    const repos = repoResult.search.nodes
      .filter((n) => n.nameWithOwner)
      .map((n) => ({
        fullName: n.nameWithOwner!,
        stars: n.stargazerCount ?? 0,
        isPrivate: n.isPrivate ?? false,
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
