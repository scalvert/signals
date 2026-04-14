import { execFileSync } from 'child_process'
import { Octokit } from 'octokit'
import { throttling } from '@octokit/plugin-throttling'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'

const token = process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8' }).trim()

const ThrottledOctokit = Octokit.plugin(throttling, paginateGraphQL)

const octokit = new ThrottledOctokit({
  auth: token,
  userAgent: 'signals/0.1.0',
  throttle: {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      console.warn(`Rate limit hit, retry ${retryCount}`)
      if (retryCount < 3) return true
      return false
    },
    onSecondaryRateLimit: (_retryAfter, options) => {
      console.warn(`Secondary rate limit for ${options.method} ${options.url}`)
    },
  },
})

// Test with first: 20 instead of first: 100
const USER_REPOS_QUERY = `
  query UserRepos($user: String!, $cursor: String) {
    user(login: $user) {
      repositories(
        first: 20
        after: $cursor
        ownerAffiliations: OWNER
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          nameWithOwner
          description
          url
          isPrivate
          primaryLanguage { name }
          stargazerCount
          forkCount
          issues(states: OPEN) { totalCount }
          pullRequests(states: OPEN) { totalCount }
          defaultBranchRef {
            target {
              ... on Commit { committedDate }
            }
          }
          latestRelease { publishedAt }
          licenseInfo { key }
          contributingFile: object(expression: "HEAD:CONTRIBUTING.md") { id }
          workflowsDir: object(expression: "HEAD:.github/workflows") { id }
        }
      }
    }
  }
`

console.log('Testing with first: 20...')
console.time('paginate')
try {
  const result = await octokit.graphql.paginate(USER_REPOS_QUERY, { user: 'scalvert' })
  console.log('SUCCESS:', result.user.repositories.nodes.length, 'repos')
} catch (err) {
  console.log('FAILED:', err.status, err.message?.substring(0, 200))
}
console.timeEnd('paginate')
