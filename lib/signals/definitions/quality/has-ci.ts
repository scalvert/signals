import type { SignalDefinition } from '../../types'

export const hasCI: SignalDefinition = {
  meta: {
    id: 'has-ci',
    name: 'CI configuration',
    category: 'quality',
    rationale:
      'CI ensures every change is tested before merging. Without it, regressions slip through and contributors cannot verify their PRs pass.',
    docs: {
      summary:
        'Binary check: 1.0 if GitHub Actions workflows detected, 0 if not.',
    },
    mode: 'metric',
    weight: 0.4,
    fixable: true,
    fixInfo: {
      description:
        'Add a .github/workflows directory with at least a basic CI workflow',
      dispatch: 'agent' as const,
      objective: 'A minimal CI workflow is added and documented enough for future maintainers to extend.',
      prompt: [
        'Add CI coverage for {{repoFullName}}.',
        '',
        'Inspect the repository to determine the language, package manager, and existing test/build commands.',
        'Create a minimal GitHub Actions workflow under .github/workflows/ that runs on pull requests and pushes.',
        'Prefer the repo-native test command. If no tests exist, use the safest build/lint/smoke check available and leave a concise note in the PR summary.',
      ].join('\n'),
      needs: { repoAccess: 'write' as const, github: ['pulls'] as const },
      expectedOutcome: 'pr-created' as const,
    },
  },

  applies: () => true,

  evaluate({ repo }) {
    return {
      mode: 'metric',
      score: repo.hasCI ? 1 : 0,
      label: repo.hasCI
        ? 'GitHub Actions workflows found'
        : 'No CI configuration detected',
      evidence: [`hasCI: ${repo.hasCI}`],
      actionable: repo.hasCI
        ? undefined
        : 'Add a .github/workflows directory with at least a basic CI workflow',
    }
  },
}
