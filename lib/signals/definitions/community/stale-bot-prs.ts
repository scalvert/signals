import type { SignalDefinition } from '../../types'
import { isBot } from '../utils'

const BOT_PR_THRESHOLD = 5

export const staleBotPRs: SignalDefinition = {
  meta: {
    id: 'stale-bot-prs',
    name: 'Stale bot PRs',
    category: 'community',
    rationale:
      'Unmerged Dependabot/Renovate PRs pile up as tech debt. Unlike contributor PRs, the fix is a bulk merge/close decision, not individual review.',
    docs: {
      summary:
        'Fires when 5+ unmerged bot PRs (Dependabot, Renovate, etc.) accumulate on a repo. This is a tech debt signal, not a community health signal.',
    },
    mode: 'event',
    fixable: true,
    fixInfo: {
      description: 'Bulk merge or close stale dependency update PRs',
      dispatch: 'agent' as const,
      objective: 'Dependency update PRs are triaged into a safe merge/refresh/close plan.',
      prompt: [
        'Triage stale bot PRs for {{repoFullName}}.',
        '',
        'The bot PRs are: {{prNumbers}}.',
        'Inspect each dependency PR, CI status, age, and whether a newer update supersedes it.',
        'Prefer safe, reversible actions: update superseded PRs with a comment, close clearly obsolete PRs if policy allows, or open a small PR/report that summarizes what should be merged manually.',
        'Do not merge risky dependency updates without passing tests and clear confidence.',
      ].join('\n'),
      needs: { repoAccess: 'write' as const, github: ['pulls', 'comments'] as const },
      expectedOutcome: 'pr-created' as const,
    },
    dedupDays: 14,
  },

  applies: () => true,

  evaluate({ repo, pullRequests }) {
    const botPRs = pullRequests.filter(
      (pr) => !pr.isDraft && isBot(pr),
    )

    if (botPRs.length < BOT_PR_THRESHOLD) return null

    const repoName = repo.fullName.split('/')[1]

    return {
      mode: 'event',
      detected: true,
      severity: 'warning',
      title: `${botPRs.length} unmerged bot PRs on ${repoName}`,
      body: `${botPRs.length} dependency update PRs from bots are piling up. Consider bulk-merging or closing outdated ones.`,
      metadata: {
        botPRCount: botPRs.length,
        bots: [...new Set(botPRs.map((p) => p.authorLogin))],
        prNumbers: botPRs.map((p) => p.number),
      },
    }
  },
}
