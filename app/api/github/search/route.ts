import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/config'
import { getOctokit } from '@/lib/github/client'
import { VIEWER_SEARCH_QUERY } from '@/lib/github/queries'

interface ViewerSearchResult {
  viewer: {
    login: string
    avatarUrl: string
    organizations: {
      nodes: Array<{
        login: string
        avatarUrl: string
        repositories: { totalCount: number }
      }>
    }
  }
}

interface OrgSearchResult {
  search: {
    nodes: Array<{
      login?: string
      avatarUrl?: string
      repositories?: { totalCount: number }
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
    const { auth } = getAuth()
    const session = await auth()
    const octokit = getOctokit(session?.accessToken)

    const [viewerResult, orgSearchResult, repoResult] = await Promise.all([
      octokit.graphql<ViewerSearchResult>(VIEWER_SEARCH_QUERY),
      octokit.graphql<OrgSearchResult>(ORG_SEARCH_QUERY, {
        searchQuery: `${query} type:org`,
      }),
      octokit.graphql<RepoSearchResult>(REPO_SEARCH_QUERY, {
        searchQuery: `user:${query} fork:true`,
      }).catch(() => ({ search: { nodes: [] } } as RepoSearchResult)),
    ])

    const viewer = viewerResult.viewer

    // Merge viewer orgs with search results, deduplicate
    const orgMap = new Map<string, { login: string; avatarUrl: string; repoCount: number }>()
    for (const org of viewer.organizations.nodes) {
      if (org.login.toLowerCase().includes(query)) {
        orgMap.set(org.login, { login: org.login, avatarUrl: org.avatarUrl, repoCount: org.repositories.totalCount })
      }
    }
    for (const node of orgSearchResult.search.nodes) {
      if (node.login && !orgMap.has(node.login)) {
        orgMap.set(node.login, { login: node.login, avatarUrl: node.avatarUrl ?? '', repoCount: node.repositories?.totalCount ?? 0 })
      }
    }

    const users = viewer.login.toLowerCase().includes(query)
      ? [{ login: viewer.login, avatarUrl: viewer.avatarUrl }]
      : []

    const repos = repoResult.search.nodes
      .filter((node) => node.nameWithOwner)
      .map((node) => ({
        fullName: node.nameWithOwner!,
        stars: node.stargazerCount ?? 0,
        isPrivate: node.isPrivate ?? false,
      }))

    return NextResponse.json({ orgs: Array.from(orgMap.values()), users, repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[signals] GitHub search failed:', message)
    return NextResponse.json(
      { error: message, orgs: [], users: [], repos: [] },
      { status: 500 },
    )
  }
}
