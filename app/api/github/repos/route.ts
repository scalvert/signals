import { NextResponse } from 'next/server'
import { accessErrorResponse, requireSession } from '@/lib/auth/access'
import { canUserAccessInstallation } from '@/lib/github/installations'
import { getInstallationOctokit } from '@/lib/github/app'
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
  try {
    const session = await requireSession()
    const url = new URL(req.url)
    const owner = url.searchParams.get('owner')
    const type = url.searchParams.get('type') as 'org' | 'user' | null
    const installationId = Number(url.searchParams.get('installationId'))

    if (!owner || !type || (type !== 'org' && type !== 'user') || !installationId) {
      return NextResponse.json(
        { error: 'owner, type (org|user), and installationId are required' },
        { status: 400 },
      )
    }

    if (!(await canUserAccessInstallation(installationId, session.githubLogin))) {
      return NextResponse.json({ error: 'GitHub App installation access denied' }, { status: 403 })
    }

    const octokit = getInstallationOctokit(installationId)
    const query = type === 'org' ? ORG_REPOS_PICKER_QUERY : USER_REPOS_PICKER_QUERY
    const variables = type === 'org' ? { org: owner } : { user: owner }
    const rootField = type === 'org' ? 'organization' : 'user'

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
    try {
      return accessErrorResponse(err)
    } catch {
      // fall through
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch repos' },
      { status: 500 },
    )
  }
}
