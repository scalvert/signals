import { getOctokit } from './client'
import { ORG_PRS_QUERY, USER_PRS_QUERY, SINGLE_REPO_PRS_QUERY } from './queries'
import type { GitHubPRNode } from './types'
import type { WorkspaceSource } from '@/types/workspace'

const EXTERNAL_ASSOCIATIONS = new Set([
  'FIRST_TIME_CONTRIBUTOR',
  'FIRST_TIMER',
  'NONE',
])

interface RawPullRequest {
  number: number
  title: string
  url: string
  authorLogin: string
  authorAssociation: string
  repoFullName: string
  isDraft: boolean
  ciState: 'passing' | 'failing' | 'pending' | 'unknown'
  createdAt: string
  updatedAt: string
  isExternal: boolean
  isStale: boolean
}

export async function fetchPRsForWorkspace(
  sources: WorkspaceSource[],
): Promise<RawPullRequest[]> {
  const prs: RawPullRequest[] = []

  for (const source of sources) {
    if (source.type === 'org') {
      const orgPRs = await fetchOrgPRs(source.value)
      prs.push(...orgPRs)
    } else if (source.type === 'user') {
      const userPRs = await fetchUserPRs(source.value)
      prs.push(...userPRs)
    } else {
      const [owner, name] = source.value.split('/')
      if (owner && name) {
        const repoPRs = await fetchSingleRepoPRs(owner, name)
        prs.push(...repoPRs)
      }
    }
  }

  // Deduplicate by repo+number
  const seen = new Set<string>()
  return prs.filter((pr) => {
    const key = `${pr.repoFullName}#${pr.number}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchOrgPRs(login: string): Promise<RawPullRequest[]> {
  const octokit = getOctokit()

  const result = await octokit.graphql.paginate<{
    organization: {
      repositories: {
        nodes: Array<{
          nameWithOwner: string
          pullRequests: { nodes: GitHubPRNode[] }
        }>
        pageInfo: { hasNextPage: boolean; endCursor: string }
      }
    }
  }>(ORG_PRS_QUERY, { org: login })

  const prs: RawPullRequest[] = []
  for (const repo of result.organization.repositories.nodes) {
    for (const pr of repo.pullRequests.nodes) {
      prs.push(parsePRNode(pr, repo.nameWithOwner))
    }
  }
  return prs
}

async function fetchUserPRs(login: string): Promise<RawPullRequest[]> {
  const octokit = getOctokit()

  const result = await octokit.graphql.paginate<{
    user: {
      repositories: {
        nodes: Array<{
          nameWithOwner: string
          pullRequests: { nodes: GitHubPRNode[] }
        }>
        pageInfo: { hasNextPage: boolean; endCursor: string }
      }
    }
  }>(USER_PRS_QUERY, { user: login })

  const prs: RawPullRequest[] = []
  for (const repo of result.user.repositories.nodes) {
    for (const pr of repo.pullRequests.nodes) {
      prs.push(parsePRNode(pr, repo.nameWithOwner))
    }
  }
  return prs
}

async function fetchSingleRepoPRs(
  owner: string,
  name: string,
): Promise<RawPullRequest[]> {
  const octokit = getOctokit()

  try {
    const result = await octokit.graphql<{
      repository: {
        nameWithOwner: string
        pullRequests: { nodes: GitHubPRNode[] }
      }
    }>(SINGLE_REPO_PRS_QUERY, { owner, name })

    return result.repository.pullRequests.nodes.map((pr) =>
      parsePRNode(pr, result.repository.nameWithOwner),
    )
  } catch (err) {
    console.warn(
      `[signals] Failed to fetch PRs for ${owner}/${name}:`,
      err instanceof Error ? err.message : err,
    )
    return []
  }
}

function parsePRNode(
  node: GitHubPRNode,
  repoFullName: string,
): RawPullRequest {
  const updatedAt = new Date(node.updatedAt)
  const now = new Date()
  const daysSinceUpdate = Math.floor(
    (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
  )

  const statusState =
    node.commits.nodes[0]?.commit?.statusCheckRollup?.state
  let ciState: RawPullRequest['ciState'] = 'unknown'
  if (statusState === 'SUCCESS') ciState = 'passing'
  else if (statusState === 'FAILURE' || statusState === 'ERROR')
    ciState = 'failing'
  else if (statusState === 'PENDING') ciState = 'pending'

  return {
    number: node.number,
    title: node.title,
    url: node.url,
    authorLogin: node.author?.login ?? 'ghost',
    authorAssociation: node.authorAssociation,
    repoFullName,
    isDraft: node.isDraft,
    ciState,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    isExternal: EXTERNAL_ASSOCIATIONS.has(node.authorAssociation),
    isStale: daysSinceUpdate > 7,
  }
}
