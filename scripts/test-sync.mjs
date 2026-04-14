import { execFileSync } from 'child_process'

const token = process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8' }).trim()

const USER_REPOS_QUERY = `
  query UserRepos($user: String!, $cursor: String) {
    user(login: $user) {
      repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { name nameWithOwner stargazerCount }
      }
    }
  }
`

const USER_PRS_QUERY = `
  query UserPRs($user: String!, $cursor: String) {
    user(login: $user) {
      repositories(first: 50, after: $cursor, ownerAffiliations: OWNER) {
        pageInfo { hasNextPage endCursor }
        nodes {
          nameWithOwner
          pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes { number title }
          }
        }
      }
    }
  }
`

async function paginate(query, variables, rootField) {
  let cursor = null
  let allNodes = []
  let page = 0

  while (true) {
    page++
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Authorization': `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { ...variables, cursor } }),
    })

    if (!res.ok) {
      console.log(`Page ${page} HTTP ${res.status}:`, await res.text().then(t => t.substring(0, 200)))
      return null
    }

    const json = await res.json()
    if (json.errors) {
      console.log(`Page ${page} GraphQL errors:`, JSON.stringify(json.errors, null, 2))
      return null
    }

    const repos = json.data.user.repositories
    allNodes.push(...repos.nodes)
    console.log(`Page ${page}: ${repos.nodes.length} repos (total: ${allNodes.length})`)

    if (!repos.pageInfo.hasNextPage) break
    cursor = repos.pageInfo.endCursor
  }

  return allNodes
}

console.log('=== Testing USER_REPOS_QUERY ===')
const repos = await paginate(USER_REPOS_QUERY, { user: 'scalvert' }, 'user')
if (repos) console.log(`Total repos: ${repos.length}\n`)

console.log('=== Testing USER_PRS_QUERY ===')
const reposWithPRs = await paginate(USER_PRS_QUERY, { user: 'scalvert' }, 'user')
if (reposWithPRs) {
  const prCount = reposWithPRs.reduce((sum, r) => sum + r.pullRequests.nodes.length, 0)
  console.log(`Total repos: ${reposWithPRs.length}, total open PRs: ${prCount}`)
}
