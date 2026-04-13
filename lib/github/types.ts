export interface GitHubRepoNode {
  databaseId: number
  name: string
  nameWithOwner: string
  description: string | null
  url: string
  isPrivate: boolean
  primaryLanguage: { name: string } | null
  stargazerCount: number
  forkCount: number
  issues: { totalCount: number }
  pullRequests: { totalCount: number }
  defaultBranchRef: {
    target: { committedDate: string }
  } | null
  latestRelease: { publishedAt: string } | null
  licenseInfo: { key: string } | null
  contributingFile: { id: string } | null
  workflowsDir: { id: string } | null
}

export interface GitHubPRNode {
  number: number
  title: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  author: { login: string } | null
  authorAssociation: string
  commits: {
    nodes: Array<{
      commit: {
        statusCheckRollup: { state: string } | null
      }
    }>
  }
}
