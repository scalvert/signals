import { NextResponse } from 'next/server'
import { accessErrorResponse, requireSession } from '@/lib/auth/access'
import { getInstallationOctokit } from '@/lib/github/app'
import { canUserAccessInstallation } from '@/lib/github/installations'
import { getGitHubInstallationByInstallationId } from '@/lib/db/queries'

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    const url = new URL(req.url)
    const query = (url.searchParams.get('q') ?? '').toLowerCase().trim()
    const installationId = Number(url.searchParams.get('installationId'))

    if (!query) {
      return NextResponse.json({ orgs: [], users: [], repos: [] })
    }

    if (!installationId) {
      return NextResponse.json(
        { error: 'installationId is required', orgs: [], users: [], repos: [] },
        { status: 400 },
      )
    }

    if (!(await canUserAccessInstallation(installationId, session.githubLogin))) {
      return NextResponse.json(
        { error: 'GitHub App installation access denied', orgs: [], users: [], repos: [] },
        { status: 403 },
      )
    }

    const installation = getGitHubInstallationByInstallationId(installationId)
    if (!installation) {
      return NextResponse.json(
        { error: 'GitHub App installation not found', orgs: [], users: [], repos: [] },
        { status: 404 },
      )
    }

    const octokit = getInstallationOctokit(installationId)
    const ownerQualifier =
      installation.accountType === 'Organization'
        ? `org:${installation.accountLogin}`
        : `user:${installation.accountLogin}`

    const [orgUserResult, repoResult] = await Promise.all([
      octokit.rest.search.users({ q: `${query}`, per_page: 10 })
        .catch(() => ({ data: { items: [] } })),
      octokit.rest.search.repos({ q: `${query} in:name ${ownerQualifier} fork:true`, per_page: 10 })
        .catch(() => ({ data: { items: [] } })),
    ])

    const orgItems = orgUserResult.data.items
      .filter((item) => item.type === 'Organization')
      .slice(0, 5)

    const orgs = await Promise.all(
      orgItems.map(async (item) => {
        const details = await octokit.rest.orgs.get({ org: item.login }).catch(() => null)
        return {
          login: item.login,
          avatarUrl: item.avatar_url,
          repoCount: details?.data.public_repos ?? 0,
        }
      }),
    )

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
    try {
      return accessErrorResponse(err)
    } catch {
      // fall through
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[signals] GitHub search failed:', message)
    return NextResponse.json(
      { error: message, orgs: [], users: [], repos: [] },
      { status: 500 },
    )
  }
}
