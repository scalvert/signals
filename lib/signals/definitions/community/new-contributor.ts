import type { SignalDefinition, SignalResult } from '../../types'
import { isBot } from '../utils'

const FIRST_TIME_ASSOCIATIONS = new Set(['FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER'])

export const newContributor: SignalDefinition = {
  meta: {
    id: 'new-contributor',
    name: 'New contributor',
    category: 'community',
    rationale:
      'First-time contributors represent community growth. Welcoming them quickly increases the chance they become repeat contributors.',
    docs: {
      summary:
        'Fires for each first-time human contributor PR on a repo. Bot authors (dependabot[bot], etc.) are excluded. Dedup is per-author per-repo.',
    },
    mode: 'event',
    fixable: true,
    fixInfo: {
      description: 'Welcome the contributor and review their PR promptly',
      dispatch: 'llm' as const,
      objective: 'The new contributor receives a timely, specific welcome comment on their PR.',
      prompt: [
        'You are a maintainer of {{repoFullName}}.',
        '',
        '@{{authorLogin}} opened their first contribution: PR #{{prNumber}} "{{prTitle}}".',
        '',
        'Read the PR enough to write a specific, respectful welcome comment.',
        'Thank them for the contribution, mention one concrete thing about the PR, and set expectations for review.',
        'Post exactly one comment on the PR.',
      ].join('\n'),
      needs: { repoAccess: 'none' as const, github: ['pulls', 'comments'] as const },
      expectedOutcome: 'comment-posted' as const,
    },
  },

  applies: () => true,

  evaluate({ repo, pullRequests, existingSignals }) {
    const results: SignalResult[] = []

    for (const pr of pullRequests) {
      if (!FIRST_TIME_ASSOCIATIONS.has(pr.authorAssociation)) continue
      if (isBot(pr)) continue

      const alreadyDetected = existingSignals.some(
        (s) =>
          (s.type === 'new-contributor') &&
          s.repoFullName === repo.fullName &&
          (s.metadata as Record<string, unknown>).authorLogin === pr.authorLogin,
      )
      if (alreadyDetected) continue

      results.push({
        mode: 'event',
        detected: true,
        severity: 'info',
        title: `New contributor on ${repo.fullName.split('/')[1]}`,
        body: `@${pr.authorLogin} opened PR #${pr.number}: "${pr.title}". This is their first contribution to this repo.`,
        metadata: {
          prNumber: pr.number,
          prTitle: pr.title,
          authorLogin: pr.authorLogin,
        },
      })
    }

    return results.length > 0 ? results : null
  },
}
