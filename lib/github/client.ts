import { execFileSync } from 'child_process'
import { Octokit } from 'octokit'
import { throttling } from '@octokit/plugin-throttling'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'

const ThrottledOctokit = Octokit.plugin(throttling, paginateGraphQL)

let instance: InstanceType<typeof ThrottledOctokit> | null = null

function resolveToken(): string {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN
  }

  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (token) {
      console.info('[signals] Using token from GitHub CLI (gh auth token)')
      return token
    }
  } catch {
    // gh not installed or not authenticated
  }

  throw new Error(
    'No GitHub token found. Set GITHUB_TOKEN in your .env file, or run `gh auth login`.',
  )
}

export function getOctokit(): InstanceType<typeof ThrottledOctokit> {
  if (instance) return instance

  const token = resolveToken()

  instance = new ThrottledOctokit({
    auth: token,
    userAgent: 'signals/0.1.0',
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const opts = options as { method: string; url: string }
        console.warn(
          `[beacon] Rate limit hit for ${opts.method} ${opts.url}`,
        )
        if (retryCount < 3) {
          console.info(`[beacon] Retrying after ${retryAfter}s`)
          return true
        }
        return false
      },
      onSecondaryRateLimit: (_retryAfter, options) => {
        const opts = options as { method: string; url: string }
        console.warn(
          `[beacon] Secondary rate limit for ${opts.method} ${opts.url}`,
        )
      },
    },
  })

  return instance
}
