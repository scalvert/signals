import { execFileSync } from 'child_process'
import { Octokit } from 'octokit'
import { throttling } from '@octokit/plugin-throttling'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'

const ThrottledOctokit = Octokit.plugin(throttling, paginateGraphQL)

const instances = new Map<string, InstanceType<typeof ThrottledOctokit>>()

function resolveDefaultToken(): string {
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

function createOctokit(token: string): InstanceType<typeof ThrottledOctokit> {
  return new ThrottledOctokit({
    auth: token,
    userAgent: 'signals/0.1.0',
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const opts = options as { method: string; url: string }
        console.warn(`[signals] Rate limit hit for ${opts.method} ${opts.url}`)
        if (retryCount < 3) {
          console.info(`[signals] Retrying after ${retryAfter}s`)
          return true
        }
        return false
      },
      onSecondaryRateLimit: (_retryAfter, options) => {
        const opts = options as { method: string; url: string }
        console.warn(`[signals] Secondary rate limit for ${opts.method} ${opts.url}`)
      },
    },
  })
}

export function getOctokit(token?: string): InstanceType<typeof ThrottledOctokit> {
  const resolvedToken = token ?? resolveDefaultToken()
  const cached = instances.get(resolvedToken)
  if (cached) return cached

  const instance = createOctokit(resolvedToken)
  instances.set(resolvedToken, instance)
  return instance
}
