import { getOctokit } from '@/lib/github/client'
import type { AttentionItem } from './types'

export type DispatchAgent = 'claude' | 'copilot'

export interface DispatchResult {
  itemId: string
  agent: DispatchAgent
  targetIssueUrl: string
  targetIssueNumber: number
}

/**
 * The scoped task an agent receives. For the Claude GitHub app we mention @claude so
 * claude-code-action picks it up; the body carries the ready-made fix prompt.
 */
function buildIssueBody(item: AttentionItem): string {
  return [
    '@claude',
    '',
    item.dispatch?.prompt ?? item.detail,
    '',
    'When the change is ready, open a pull request (do not just leave a branch).',
    '',
    '---',
    `_Dispatched by Signals — \`${item.type}\` on ${item.repo} (rank ${item.rank})._`,
  ].join('\n')
}

/**
 * Hand an attention item off to a hosted coding agent by opening a scoped issue in the
 * target repo. Mutates `item.dispatch` with the tracking refs; the caller persists state.
 */
export async function dispatchItem(
  item: AttentionItem,
  opts: { agent: DispatchAgent; token?: string },
): Promise<DispatchResult> {
  if (!item.dispatch) throw new Error(`Item ${item.id} is not dispatchable.`)
  if (opts.agent !== 'claude') {
    throw new Error(`Dispatch agent "${opts.agent}" is not implemented yet.`)
  }

  const [owner, repo] = item.repo.split('/')
  const octokit = getOctokit(opts.token)
  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title: `[signals] ${item.title}`,
    body: buildIssueBody(item),
  })

  item.dispatch.agent = opts.agent
  item.dispatch.targetIssueUrl = data.html_url
  item.dispatch.status = 'dispatched'

  return {
    itemId: item.id,
    agent: opts.agent,
    targetIssueUrl: data.html_url,
    targetIssueNumber: data.number,
  }
}
