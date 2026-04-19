import type { SignalDefinition } from '../../types'
import { daysAgo } from '../utils'

export const dormantRepo: SignalDefinition = {
  meta: {
    id: 'dormant-repo',
    name: 'Dormant repository',
    category: 'activity',
    rationale:
      'A repo with no commits in 30+ days that still has stars signals abandoned work. Users lose trust, and open issues/PRs go unanswered.',
    docs: {
      summary:
        'Fires when a starred repo has no commits in 30+ days. Warning at 30d, critical at 60d. Suppressed by context keywords like "maintenance mode" or "stable".',
    },
    mode: 'event',
    fixable: true,
    fixInfo: {
      description: 'Triage: commit a maintenance update, add a status notice, or archive the repo',
    },
    dedupDays: 30,
    suppressionKeywords: [
      'low cadence',
      'infrequently updated',
      'stable',
      'maintenance mode',
      'rarely changes',
      'updated as needed',
    ],
  },

  applies: (repo) => repo.stars > 0 && repo.lastCommitAt !== null,

  evaluate({ repo }) {
    if (!repo.lastCommitAt) return null

    const days = daysAgo(repo.lastCommitAt)
    if (days < 30) return null

    const severity = days > 60 ? 'critical' : 'warning'
    const contextParts: string[] = []
    if (repo.openIssues > 0) contextParts.push(`${repo.openIssues} open issues`)
    if (repo.openPRs > 0) contextParts.push(`${repo.openPRs} open PRs`)

    const suggestion = contextParts.length > 0
      ? ` Still has ${contextParts.join(' and ')} — consider triaging or archiving.`
      : ' Consider adding a maintenance notice or archiving.'

    return {
      mode: 'event',
      detected: true,
      severity,
      title: `${repo.name} appears dormant`,
      body: `No commits in ${days} days.${suggestion}`,
      metadata: {
        daysSinceLastCommit: days,
        lastCommitDate: repo.lastCommitAt,
        stars: repo.stars,
        openIssues: repo.openIssues,
        openPRs: repo.openPRs,
      },
    }
  },
}
