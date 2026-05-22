import { Octokit } from 'octokit'
import { createAppAuth } from '@octokit/auth-app'
import { throttling } from '@octokit/plugin-throttling'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'
import { getSetting } from '@/lib/db/queries'
import type { GitHubClient } from './client'

const AppOctokit = Octokit.plugin(throttling, paginateGraphQL)

const appInstances = new Map<string, InstanceType<typeof AppOctokit>>()
const installationInstances = new Map<number, InstanceType<typeof AppOctokit>>()

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

function getAppCredentials() {
  const appId = getSetting('github.app.id') ?? process.env.GITHUB_APP_ID
  const privateKey =
    getSetting('github.app.privateKey') ??
    process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error('GitHub App id and private key are required for installation access')
  }

  return {
    appId,
    privateKey: normalizePrivateKey(privateKey),
  }
}

function createAppOctokit(installationId?: number): InstanceType<typeof AppOctokit> {
  const { appId, privateKey } = getAppCredentials()
  return new AppOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
    userAgent: 'signals/0.1.0',
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const opts = options as { method: string; url: string }
        console.warn(`[signals] GitHub App rate limit hit for ${opts.method} ${opts.url}`)
        if (retryCount < 3) {
          console.info(`[signals] Retrying after ${retryAfter}s`)
          return true
        }
        return false
      },
      onSecondaryRateLimit: (_retryAfter, options) => {
        const opts = options as { method: string; url: string }
        console.warn(`[signals] GitHub App secondary rate limit for ${opts.method} ${opts.url}`)
      },
    },
  })
}

export function getAppOctokit(): InstanceType<typeof AppOctokit> {
  const { appId } = getAppCredentials()
  const cached = appInstances.get(appId)
  if (cached) return cached

  const octokit = createAppOctokit()
  appInstances.set(appId, octokit)
  return octokit
}

export function getInstallationOctokit(installationId: number): GitHubClient {
  const cached = installationInstances.get(installationId)
  if (cached) return cached as unknown as GitHubClient

  const octokit = createAppOctokit(installationId)
  installationInstances.set(installationId, octokit)
  return octokit as unknown as GitHubClient
}

