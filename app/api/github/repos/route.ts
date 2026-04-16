import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getOctokit } from '@/lib/github/client'
import { ORG_REPOS_PICKER_QUERY, USER_REPOS_PICKER_QUERY } from '@/lib/github/queries'

interface PickerRepoNode {
  name: string
  nameWithOwner: string
  stargazerCount: number
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const owner = url.searchParams.get('owner')
  const type = url.searchParams.get('type') as 'org' | 'user' | null

  if (!owner || !type || (type !== 'org' && type !== 'user')) {
    return NextResponse.json(
      { error: 'owner and type (org|user) are required' },
      { status: 400 },
    )
  }

  const session = await auth()
  const octokit = getOctokit(session?.accessToken)
  const query = type === 'org' ? ORG_REPOS_PICKER_QUERY : USER_REPOS_PICKER_QUERY
  const variables = type === 'org' ? { org: owner } : { user: owner }
  const rootField = type === 'org' ? 'organization' : 'user'

  try {
    const result = await octokit.graphql.paginate<Record<string, {
      repositories: {
        nodes: PickerRepoNode[]
        pageInfo: { hasNextPage: boolean; endCursor: string }
      }
    }>>(query, variables)

    const repos = result[rootField].repositories.nodes.map((node) => ({
      name: node.name,
      fullName: node.nameWithOwner,
      stars: node.stargazerCount,
      isPrivate: node.isPrivate,
      isArchived: node.isArchived,
      isFork: node.isFork,
    }))

    return NextResponse.json({ repos })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch repos' },
      { status: 500 },
    )
  }
}
