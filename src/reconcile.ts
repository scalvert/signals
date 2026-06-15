import { getOctokit } from '@/lib/github/client'
import type { DispatchInfo, SignalsState } from './types'

function parseIssueUrl(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null
}

/**
 * Carry dispatch tracking from the previous run forward onto freshly-collected
 * items (matched by id). Without this, regenerating the digest would lose the
 * link to issues/PRs the agent is working on.
 */
export function mergeDispatchState(fresh: SignalsState, prior: SignalsState | null): void {
  if (!prior) return
  const priorById = new Map(prior.items.map((i) => [i.id, i]))
  for (const item of fresh.items) {
    const prev = priorById.get(item.id)?.dispatch
    if (prev?.targetIssueUrl && item.dispatch) {
      item.dispatch.agent = prev.agent
      item.dispatch.targetIssueUrl = prev.targetIssueUrl
      item.dispatch.branch = prev.branch
      item.dispatch.prUrl = prev.prUrl
      item.dispatch.status = prev.status
    }
  }
}

/**
 * For each dispatched item, look up the agent's branch and PR on GitHub and
 * update its status. With openMissingPRs, open the PR from the agent's branch
 * if the agent pushed one but didn't open a PR — so dispatch ends in an open PR.
 */
export async function reconcileDispatch(
  state: SignalsState,
  opts: { token?: string; openMissingPRs?: boolean } = {},
): Promise<void> {
  const octokit = getOctokit(opts.token)

  for (const item of state.items) {
    const d = item.dispatch
    if (!d?.targetIssueUrl || d.status === 'merged') continue
    const loc = parseIssueUrl(d.targetIssueUrl)
    if (!loc) continue
    const { owner, repo, number } = loc

    const branch = d.branch ?? (await findAgentBranch(octokit, owner, repo, number))
    if (!branch) continue
    d.branch = branch

    let pr = await findPrForBranch(octokit, owner, repo, branch)
    if (!pr && opts.openMissingPRs) {
      pr = await openPr(octokit, owner, repo, branch, number, item.title)
    }
    if (pr) {
      d.prUrl = pr.html_url
      d.status = pr.merged_at ? 'merged' : pr.state === 'open' ? 'pr-open' : 'failed'
    }
  }
}

async function findAgentBranch(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string | undefined> {
  // claude-code-action names branches claude/issue-<n>-<timestamp>.
  const prefix = `claude/issue-${issueNumber}-`
  const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner,
    repo,
    per_page: 100,
  })
  return branches.find((b) => b.name.startsWith(prefix))?.name
}

type PrSummary = { html_url: string; state: string; merged_at: string | null }

async function findPrForBranch(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  branch: string,
): Promise<PrSummary | undefined> {
  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'all',
    per_page: 1,
  })
  return data[0]
}

async function openPr(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  branch: string,
  issueNumber: number,
  title: string,
): Promise<PrSummary> {
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branch,
    base: 'main',
    title: `[signals] ${title}`,
    body: `Dispatched by Signals. Closes #${issueNumber}.`,
  })
  return data
}
