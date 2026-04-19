import type { SignalDefinition } from '../../types'

const MIN_NEW_ISSUES = 5
const FLOOD_RATIO = 1.5

export const issueFlood: SignalDefinition = {
  meta: {
    id: 'issue-flood',
    name: 'Issue spike',
    category: 'activity',
    rationale:
      'A sudden spike in open issues often correlates with a breaking release, external attention (HN/Reddit), or a security disclosure. Early detection lets maintainers triage before the backlog becomes overwhelming.',
    docs: {
      summary:
        'Fires when 5+ new issues appear AND total issues grow by 1.5x or more since the last sync.',
    },
    mode: 'event',
    fixable: false,
    dedupDays: 7,
  },

  applies: () => true,

  evaluate({ repo, previousRepo }) {
    if (!previousRepo) return null

    const newIssues = repo.openIssues - previousRepo.openIssues
    if (newIssues < MIN_NEW_ISSUES) return null

    const ratio =
      previousRepo.openIssues > 0
        ? repo.openIssues / previousRepo.openIssues
        : newIssues
    if (ratio < FLOOD_RATIO) return null

    return {
      mode: 'event',
      detected: true,
      severity: 'warning',
      title: `Issue spike on ${repo.name}`,
      body: `${newIssues} new issues opened (${previousRepo.openIssues} → ${repo.openIssues}). Check for a breaking release or external attention.`,
      metadata: {
        newCount: newIssues,
        previousTotal: previousRepo.openIssues,
        currentTotal: repo.openIssues,
        ratio: Math.round(ratio * 100) / 100,
      },
    }
  },
}
