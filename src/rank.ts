import { scoreRepo, detectEvents } from '@/lib/signals/engine'
import { registry } from '@/lib/signals/registry'
import { interpolatePrompt } from '@/lib/tasks/prompts'
import { daysAgo } from '@/lib/signals/definitions/utils'
import type { RawRepo } from '@/lib/github/fetch-repos'
import type { RawPullRequest } from '@/lib/github/fetch-prs'
import type { RepoSnapshot, SignalFixInfo } from '@/lib/signals/types'
import type { Repo, PullRequest } from '@/types/workspace'
import type { AttentionItem, DispatchInfo, Severity, Effort } from './types'

/** Metric checks scoring below this (0–1) are surfaced as fixable attention items. */
const CHECK_FAIL_THRESHOLD = 0.7

const SEVERITY_WEIGHT: Record<Severity, number> = { info: 1, warning: 2, critical: 3 }
const EFFORT_PENALTY: Record<Effort, number> = { low: 0, medium: 4, high: 10 }

/** How "alive" a repo is, from its last commit — signals on live repos are more worth acting on. */
function liveness(lastCommitAt: string | null): number {
  if (!lastCommitAt) return 0.25
  const d = daysAgo(lastCommitAt)
  if (d <= 90) return 1
  if (d <= 365) return 0.7
  if (d <= 730) return 0.45
  return 0.25
}

/**
 * For a dormant repo, how actionable the dormancy is. Recent dormancy is the sweet spot
 * (a nudge can revive it); years-old dormancy is an archive decision, not urgent work.
 * Open issues/PRs mean there's real unanswered work, so nudge it up.
 */
function dormancyActionability(days: number, hasOpenWork: boolean): number {
  let f = days <= 180 ? 1 : days <= 365 ? 0.65 : days <= 730 ? 0.4 : 0.2
  if (hasOpenWork) f += 0.15
  return f
}

function actionabilityMultiplier(
  type: string,
  repo: RawRepo,
  metadata: Record<string, unknown>,
): number {
  if (type === 'dormant-repo') {
    const days =
      typeof metadata.daysSinceLastCommit === 'number'
        ? metadata.daysSinceLastCommit
        : repo.lastCommitAt
          ? daysAgo(repo.lastCommitAt)
          : Number.MAX_SAFE_INTEGER
    return dormancyActionability(days, repo.openIssues > 0 || repo.openPRs > 0)
  }
  return liveness(repo.lastCommitAt)
}

function toPullRequest(raw: RawPullRequest): PullRequest {
  return {
    ...raw,
    id: 0,
    workspaceId: 0,
    daysSinceUpdate: Math.floor(
      (Date.now() - new Date(raw.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
  }
}

function toRepo(raw: RawRepo, scored: ReturnType<typeof scoreRepo>, now: string): Repo {
  return {
    ...raw,
    id: 0,
    score: scored.score,
    grade: scored.grade,
    triage: scored.triage,
    pillars: scored.pillars,
    checkResults: scored.checkResults,
    workspaceId: 0,
    syncedAt: now,
  }
}

function buildDispatch(
  fixInfo: SignalFixInfo | undefined,
  vars: Record<string, unknown>,
): DispatchInfo | null {
  if (!fixInfo || !('dispatch' in fixInfo)) return null
  const template = 'prompt' in fixInfo ? fixInfo.prompt : fixInfo.description
  return {
    available: true,
    expectedOutcome: 'expectedOutcome' in fixInfo ? fixInfo.expectedOutcome : undefined,
    needs: 'needs' in fixInfo ? fixInfo.needs : undefined,
    prompt: interpolatePrompt(template, vars),
  }
}

function effortFor(fixInfo: SignalFixInfo | undefined): Effort {
  if (!fixInfo || !('dispatch' in fixInfo)) return 'high'
  if (fixInfo.dispatch === 'agent') return 'medium'
  return 'low' // 'auto' | 'llm'
}

interface MakeItemArgs {
  repo: RawRepo
  type: string
  severity: Severity
  title: string
  detail: string
  metadata: Record<string, unknown>
  now: string
}

function makeItem({ repo, type, severity, title, detail, metadata, now }: MakeItemArgs): AttentionItem {
  const def = registry.get(type)
  const fixInfo = def?.meta.fixInfo
  const [owner, name] = repo.fullName.split('/')
  const vars = { repoFullName: repo.fullName, owner, repo: name, ...metadata }

  const dispatch = buildDispatch(fixInfo, vars)
  const effort = effortFor(fixInfo)
  const base = SEVERITY_WEIGHT[severity] * 12 + Math.log2(repo.stars + 1) * 5
  const multiplier = actionabilityMultiplier(type, repo, metadata)
  const impact = Math.min(100, Math.round(base * multiplier))
  const rank = impact + (dispatch ? 8 : 0) - EFFORT_PENALTY[effort]

  return {
    id: `${repo.fullName}#${type}`,
    repo: repo.fullName,
    repoUrl: repo.url,
    stars: repo.stars,
    type,
    category: def?.meta.category ?? 'quality',
    severity,
    title,
    rationale: def?.meta.rationale ?? '',
    detail,
    fixable: Boolean(def?.meta.fixable),
    dispatch,
    rank,
    impact,
    effort,
    detectedAt: now,
    resolvedAt: null,
  }
}

/**
 * Turn fetched repos + PRs into a ranked list of attention items.
 * Reuses the existing scoring (metric signals) and event detectors verbatim.
 */
export function buildAttentionItems(
  rawRepos: RawRepo[],
  rawPRs: RawPullRequest[],
  now: string,
): AttentionItem[] {
  const prs = rawPRs.map(toPullRequest)
  const items: AttentionItem[] = []

  for (const raw of rawRepos) {
    const snapshot: RepoSnapshot = {
      name: raw.name,
      fullName: raw.fullName,
      stars: raw.stars,
      forks: raw.forks,
      openIssues: raw.openIssues,
      openPRs: raw.openPRs,
      lastCommitAt: raw.lastCommitAt,
      lastReleaseAt: raw.lastReleaseAt,
      hasCI: raw.hasCI,
      hasLicense: raw.hasLicense,
      hasContributing: raw.hasContributing,
      language: raw.language,
    }
    const repoPRs = prs.filter((pr) => pr.repoFullName === raw.fullName)
    const scored = scoreRepo(snapshot, repoPRs)
    const repo = toRepo(raw, scored, now)

    // Event signals (dormant repo, stale PRs, milestones, …).
    for (const ev of detectEvents(repo, undefined, prs, [], undefined)) {
      items.push({ ...makeItem({ repo: raw, type: ev.type, severity: ev.severity, title: ev.title, detail: ev.body, metadata: ev.metadata, now }) })
    }

    // Failing, fixable metric checks (missing LICENSE/CI/CONTRIBUTING, …).
    for (const [checkId, res] of Object.entries(scored.checkResults)) {
      const def = registry.get(checkId)
      if (!def?.meta.fixable || res.score >= CHECK_FAIL_THRESHOLD) continue
      items.push(
        makeItem({
          repo: raw,
          type: checkId,
          severity: 'warning',
          title: `${raw.name}: ${res.label}`,
          detail: res.actionable ?? res.evidence.join('; ') ?? res.label,
          metadata: {},
          now,
        }),
      )
    }
  }

  return items.sort((a, b) => b.rank - a.rank)
}
