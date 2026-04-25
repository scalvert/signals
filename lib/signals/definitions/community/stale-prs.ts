import type { SignalDefinition } from '../../types'
import { isBot } from '../utils'

const EXTERNAL_STALE_DAYS = 7
const INTERNAL_STALE_DAYS = 14

export const stalePRs: SignalDefinition = {
  meta: {
    id: 'stale-prs',
    name: 'Stale pull requests',
    category: 'community',
    rationale:
      'Unanswered contributor PRs are the fastest way to kill community goodwill. This signal only tracks human PRs — bot PRs (Dependabot, Renovate) are tracked separately by stale-bot-prs.',
    docs: {
      summary:
        'Fires when human (non-bot) PRs go unreviewed: 7+ days for external contributors, 14+ days for internal. Draft PRs are excluded. Groups stale PRs per repo into a single signal.',
    },
    mode: 'event',
    fixable: true,
    fixInfo: {
      description: 'Review or close stale PRs to unblock contributors',
    },
    suppressionKeywords: [
      'long-lived prs',
      'slow review',
      'review cadence',
    ],
  },

  applies: () => true,

  evaluate({ repo, pullRequests, existingSignals }) {
    const stalePRList = pullRequests.filter((pr) => {
      if (pr.isDraft) return false
      if (isBot(pr)) return false
      const threshold = pr.isExternal ? EXTERNAL_STALE_DAYS : INTERNAL_STALE_DAYS
      return pr.daysSinceUpdate >= threshold
    })

    if (stalePRList.length === 0) return null

    const prNumbers = stalePRList.map((p) => p.number)
    const key = prNumbers.sort((a, b) => a - b).join(',')

    const isDuplicate = existingSignals.some((s) => {
      if (s.type !== 'stale-prs' && s.type !== 'pr-stale') return false
      if (s.repoFullName !== repo.fullName) return false
      const existing = (s.metadata as Record<string, unknown>).prNumbers as number[] | undefined
      return existing?.sort((a, b) => a - b).join(',') === key
    })
    if (isDuplicate) return null

    const oldest = Math.max(...stalePRList.map((p) => p.daysSinceUpdate))
    const hasExternal = stalePRList.some((p) => p.isExternal)
    const severity = hasExternal && oldest > 14 ? 'critical' : 'warning'
    const repoName = repo.fullName.split('/')[1]

    return {
      mode: 'event',
      detected: true,
      severity,
      title: `${stalePRList.length} stale PR${stalePRList.length > 1 ? 's' : ''} on ${repoName}`,
      body: stalePRList
        .map(
          (pr) =>
            `#${pr.number} by @${pr.authorLogin} (${pr.daysSinceUpdate}d, ${pr.isExternal ? 'external' : 'internal'})`,
        )
        .join('. '),
      metadata: {
        prNumbers,
        oldestDays: oldest,
        hasExternal,
        prs: stalePRList.map((p) => ({
          number: p.number,
          title: p.title,
          author: p.authorLogin,
          daysSinceUpdate: p.daysSinceUpdate,
          isExternal: p.isExternal,
        })),
      },
    }
  },
}
