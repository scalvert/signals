import type { Repo, PullRequest, Signal } from '@/types/workspace'
import type { SignalContext } from '../types'

export function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 1,
    name: 'test-repo',
    fullName: 'org/test-repo',
    description: null,
    url: 'https://github.com/org/test-repo',
    language: 'TypeScript',
    stars: 50,
    forks: 10,
    openIssues: 5,
    openPRs: 2,
    lastCommitAt: new Date().toISOString(),
    lastReleaseAt: null,
    hasCI: true,
    hasLicense: true,
    hasContributing: true,
    isPrivate: false,
    isFork: false,
    score: 75,
    grade: 'B' as const,
    triage: 'healthy' as const,
    pillars: { activity: 20, community: 15, quality: 25, security: 15 },
    checkResults: {},
    workspaceId: 1,
    syncedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Fix something',
    url: 'https://github.com/org/test-repo/pull/42',
    authorLogin: 'contributor',
    authorAssociation: 'CONTRIBUTOR',
    repoFullName: 'org/test-repo',
    isDraft: false,
    ciState: 'passing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysSinceUpdate: 0,
    isExternal: true,
    isStale: false,
    workspaceId: 1,
    ...overrides,
  }
}

export function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    type: 'dormant',
    severity: 'warning',
    title: 'test signal',
    body: 'test body',
    repoFullName: 'org/test-repo',
    metadata: {},
    detectedAt: new Date().toISOString(),
    workspaceId: 1,
    status: 'active',
    dismissedReason: null,
    enrichedBody: null,
    ...overrides,
  }
}

export function makeContext(overrides: Partial<SignalContext> = {}): SignalContext {
  return {
    repo: makeRepo(),
    pullRequests: [],
    existingSignals: [],
    ...overrides,
  }
}

export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}
