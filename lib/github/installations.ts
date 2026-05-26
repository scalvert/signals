import {
  getGitHubInstallationByInstallationId,
  upsertGitHubInstallation,
} from '@/lib/db/queries'
import { getAppOctokit, getInstallationOctokit } from './app'
import type { GitHubAccountType, GitHubInstallation } from '@/types/workspace'

interface RawInstallation {
  id: number
  account?: { login?: string; type?: string } | null
  repository_selection: string
  permissions?: Record<string, unknown>
}

function accountType(type: string | undefined): GitHubAccountType {
  return type === 'User' ? 'User' : 'Organization'
}

function installationToData(installation: RawInstallation) {
  const account = installation.account
  const login = account && 'login' in account ? account.login : null
  const type = account && 'type' in account ? account.type : undefined

  if (!login) return null

  return {
    installationId: installation.id,
    accountLogin: login,
    accountType: accountType(type),
    repositorySelection: installation.repository_selection,
    permissions: Object.fromEntries(
      Object.entries(installation.permissions ?? {}).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  }
}

export async function syncGitHubInstallations(): Promise<GitHubInstallation[]> {
  const octokit = getAppOctokit()
  const response = await octokit.rest.apps.listInstallations({ per_page: 100 })
  return response.data
    .map(installationToData)
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .map(upsertGitHubInstallation)
}

export async function listVisibleInstallations(
  githubLogin: string,
): Promise<GitHubInstallation[]> {
  const installations = await syncGitHubInstallations()
  const visible: GitHubInstallation[] = []

  for (const installation of installations) {
    if (await canUserAccessInstallation(installation.installationId, githubLogin)) {
      visible.push(installation)
    }
  }

  return visible
}

export async function canUserAccessInstallation(
  installationId: number,
  githubLogin: string,
): Promise<boolean> {
  const installation =
    getGitHubInstallationByInstallationId(installationId) ??
    (await syncGitHubInstallations()).find((item) => item.installationId === installationId)

  if (!installation) return false
  if (installation.accountType === 'User') {
    return installation.accountLogin.toLowerCase() === githubLogin.toLowerCase()
  }

  const octokit = getInstallationOctokit(installationId)
  try {
    await octokit.rest.orgs.checkMembershipForUser({
      org: installation.accountLogin,
      username: githubLogin,
    })
    return true
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: number }).status)
      : 0
    if (status === 404 || status === 302) return false
    throw error
  }
}
