import type { DetectedSignal } from '../types'
import type { PullRequest, Signal } from '@/types/workspace'

export function detectNewContributors(
  prs: PullRequest[],
  existingSignals: Signal[],
): DetectedSignal[] {
  const signals: DetectedSignal[] = []

  const firstTimeAssociations = new Set(['FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER'])

  for (const pr of prs) {
    if (!firstTimeAssociations.has(pr.authorAssociation)) continue
    if (isDuplicate(existingSignals, pr.repoFullName, pr.authorLogin)) continue

    signals.push({
      type: 'new-contributor',
      severity: 'info',
      title: `New contributor on ${pr.repoFullName.split('/')[1]}`,
      body: `@${pr.authorLogin} opened PR #${pr.number}: "${pr.title}". This is their first contribution to this repo.`,
      repoFullName: pr.repoFullName,
      metadata: {
        prNumber: pr.number,
        prTitle: pr.title,
        authorLogin: pr.authorLogin,
      },
    })
  }

  return signals
}

function isDuplicate(signals: Signal[], repoFullName: string, authorLogin: string): boolean {
  return signals.some(
    (s) =>
      s.type === 'new-contributor' &&
      s.repoFullName === repoFullName &&
      (s.metadata as Record<string, unknown>).authorLogin === authorLogin,
  )
}
