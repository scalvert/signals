import { getOctokit } from './client'
import { ORG_REPOS_QUERY, USER_REPOS_QUERY, SINGLE_REPO_QUERY } from './queries'
import type { GitHubRepoNode } from './types'
import type { WorkspaceSource } from '@/types/workspace'

interface RawRepo {
  name: string
  fullName: string
  description: string | null
  url: string
  language: string | null
  stars: number
  forks: number
  openIssues: number
  openPRs: number
  lastCommitAt: string | null
  lastReleaseAt: string | null
  hasCI: boolean
  hasLicense: boolean
  hasContributing: boolean
  isPrivate: boolean
}

export async function fetchReposForWorkspace(
  sources: WorkspaceSource[],
): Promise<RawRepo[]> {
  const repos: RawRepo[] = []

  for (const source of sources) {
    if (source.type === 'org') {
      const orgRepos = await fetchOrgRepos(source.value)
      repos.push(...orgRepos)
    } else if (source.type === 'user') {
      const userRepos = await fetchUserRepos(source.value)
      repos.push(...userRepos)
    } else {
      const [owner, name] = source.value.split('/')
      if (owner && name) {
        const repo = await fetchSingleRepo(owner, name)
        if (repo) repos.push(repo)
      }
    }
  }

  // Deduplicate by fullName (a repo could appear in both an org and as an individual source)
  const seen = new Set<string>()
  return repos.filter((r) => {
    if (seen.has(r.fullName)) return false
    seen.add(r.fullName)
    return true
  })
}

async function fetchOrgRepos(login: string): Promise<RawRepo[]> {
  const octokit = getOctokit()

  const result = await octokit.graphql.paginate<{
    organization: {
      repositories: {
        nodes: GitHubRepoNode[]
        pageInfo: { hasNextPage: boolean; endCursor: string }
      }
    }
  }>(ORG_REPOS_QUERY, { org: login })

  return result.organization.repositories.nodes.map(parseRepoNode)
}

async function fetchUserRepos(login: string): Promise<RawRepo[]> {
  const octokit = getOctokit()

  const result = await octokit.graphql.paginate<{
    user: {
      repositories: {
        nodes: GitHubRepoNode[]
        pageInfo: { hasNextPage: boolean; endCursor: string }
      }
    }
  }>(USER_REPOS_QUERY, { user: login })

  return result.user.repositories.nodes.map(parseRepoNode)
}

async function fetchSingleRepo(
  owner: string,
  name: string,
): Promise<RawRepo | null> {
  const octokit = getOctokit()

  try {
    const result = await octokit.graphql<{
      repository: GitHubRepoNode
    }>(SINGLE_REPO_QUERY, { owner, name })

    return parseRepoNode(result.repository)
  } catch (err) {
    console.warn(
      `[beacon] Failed to fetch repo ${owner}/${name}:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

function parseRepoNode(node: GitHubRepoNode): RawRepo {
  return {
    name: node.name,
    fullName: node.nameWithOwner,
    description: node.description,
    url: node.url,
    language: node.primaryLanguage?.name ?? null,
    stars: node.stargazerCount,
    forks: node.forkCount,
    openIssues: node.issues.totalCount,
    openPRs: node.pullRequests.totalCount,
    lastCommitAt:
      node.defaultBranchRef?.target?.committedDate ?? null,
    lastReleaseAt: node.latestRelease?.publishedAt ?? null,
    hasCI: node.workflowsDir !== null,
    hasLicense: node.licenseInfo !== null,
    hasContributing: node.contributingFile !== null,
    isPrivate: node.isPrivate,
  }
}
