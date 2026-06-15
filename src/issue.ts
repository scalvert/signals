import { getOctokit } from '@/lib/github/client'
import { DIGEST_MARKER, renderIssueMarkdown } from './render'
import type { SignalsConfig } from './config'
import type { SignalsState } from './types'

const DIGEST_LABEL = 'signals-digest'
const DIGEST_TITLE = '🛰️ Signals — what needs your attention'

/**
 * Create or update the single rolling digest issue in the control repo. Idempotent:
 * finds the existing issue by label (or the hidden marker) and updates it in place,
 * so it never spams a new issue per run.
 */
export async function upsertDigestIssue(
  config: SignalsConfig,
  state: SignalsState,
  opts: { repo?: string; token?: string } = {},
): Promise<string> {
  const repoFull = opts.repo ?? process.env.GITHUB_REPOSITORY
  if (!repoFull || !repoFull.includes('/')) {
    throw new Error('upsertDigestIssue: set GITHUB_REPOSITORY (owner/repo) or pass opts.repo')
  }
  const [owner, repo] = repoFull.split('/')
  const octokit = getOctokit(opts.token)
  const body = renderIssueMarkdown(state, config.digest.topN)

  const existing = await findDigestIssue(octokit, owner, repo)
  if (existing) {
    await octokit.rest.issues.update({ owner, repo, issue_number: existing, title: DIGEST_TITLE, body })
    return `https://github.com/${owner}/${repo}/issues/${existing}`
  }

  await ensureLabel(octokit, owner, repo)
  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title: DIGEST_TITLE,
    body,
    labels: [DIGEST_LABEL],
  })
  return data.html_url
}

async function findDigestIssue(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
): Promise<number | undefined> {
  const byLabel = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: DIGEST_LABEL,
    per_page: 1,
  })
  if (byLabel.data[0]) return byLabel.data[0].number

  // Fallback for issues created before the label existed: scan for the marker.
  const open = await octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 50 })
  return open.data.find((i) => (i.body ?? '').includes(DIGEST_MARKER))?.number
}

async function ensureLabel(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
): Promise<void> {
  try {
    await octokit.rest.issues.createLabel({ owner, repo, name: DIGEST_LABEL, color: '5319e7' })
  } catch {
    // already exists
  }
}
