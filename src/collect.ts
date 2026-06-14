import { fetchReposForWorkspace } from '@/lib/github/fetch-repos'
import { fetchPRsForWorkspace } from '@/lib/github/fetch-prs'
import { filterReposForWorkspace } from '@/lib/github/filter-repos'
import { buildAttentionItems } from './rank'
import type { SignalsConfig } from './config'
import type { SignalsState } from './types'

/**
 * Fetch the configured repos + PRs from GitHub, score and rank them, and
 * return the structured state. Shared by the digest entrypoint, the MCP
 * server, and the GitHub Action.
 */
export async function collectState(
  config: SignalsConfig,
  now = new Date().toISOString(),
): Promise<SignalsState> {
  const allRepos = await fetchReposForWorkspace(config.sources)
  const allPRs = await fetchPRsForWorkspace(config.sources)

  const repos = filterReposForWorkspace(allRepos, config.sources, config.excludedRepos)
  const repoNames = new Set(repos.map((r) => r.fullName))
  const prs = allPRs.filter((pr) => repoNames.has(pr.repoFullName))

  return {
    generatedAt: now,
    repoCount: repos.length,
    items: buildAttentionItems(repos, prs, now),
  }
}
