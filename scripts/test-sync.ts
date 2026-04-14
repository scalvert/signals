import { getOctokit } from '../lib/github/client'
import { USER_REPOS_QUERY, USER_PRS_QUERY } from '../lib/github/queries'

async function test() {
  const octokit = getOctokit()

  console.log('Testing USER_REPOS_QUERY for scalvert...')
  try {
    const result = await octokit.graphql.paginate<any>(USER_REPOS_QUERY, { user: 'scalvert' })
    console.log('SUCCESS: repos:', result.user.repositories.nodes.length)
  } catch (err: any) {
    console.log('REPOS ERROR:', err.message?.substring(0, 300))
    console.log('STATUS:', err.status)
  }

  console.log('\nTesting USER_PRS_QUERY for scalvert...')
  try {
    const result = await octokit.graphql.paginate<any>(USER_PRS_QUERY, { user: 'scalvert' })
    const prCount = result.user.repositories.nodes.reduce(
      (sum: number, r: any) => sum + r.pullRequests.nodes.length, 0
    )
    console.log('SUCCESS: repos with PRs:', result.user.repositories.nodes.length, 'total PRs:', prCount)
  } catch (err: any) {
    console.log('PRS ERROR:', err.message?.substring(0, 300))
    console.log('STATUS:', err.status)
  }
}

test()
