import type { AttentionItem, SignalsState } from './types'

const SEVERITY_ICON = { critical: '🔴', warning: '🟡', info: '🔵' } as const

/** Hidden marker so the digest issue can be found and updated in place each run. */
export const DIGEST_MARKER = '<!-- signals-digest -->'

function statusSuffix(item: AttentionItem): string {
  const d = item.dispatch
  if (!d?.status) return ''
  if (d.status === 'merged') return ' — ✅ merged'
  if (d.status === 'pr-open') return d.prUrl ? ` — PR open: ${d.prUrl}` : ' — PR open'
  if (d.status === 'dispatched') return ' — ⏳ dispatched'
  if (d.status === 'failed') return ' — ⚠️ dispatch failed'
  return ''
}

function topItems(state: SignalsState, topN: number): AttentionItem[] {
  return state.items.slice(0, topN)
}

/** Plain markdown digest — terminal output and a readable summary. */
export function renderDigestMarkdown(state: SignalsState, topN: number): string {
  const top = topItems(state, topN)
  const lines = [
    `# Signals digest — ${state.items.length} items across ${state.repoCount} repos`,
    '',
    `Generated ${state.generatedAt}`,
    '',
  ]
  if (top.length === 0) {
    lines.push('Nothing needs your attention right now. ✨')
    return lines.join('\n')
  }
  lines.push(`## Top ${top.length} worth your time`, '')
  top.forEach((item, i) => {
    lines.push(
      `${i + 1}. ${SEVERITY_ICON[item.severity]} **${item.title}** · ${item.repo} (★${item.stars})${statusSuffix(item)}`,
      `   ${item.rationale}`,
      `   _${item.detail}_ · rank ${item.rank}`,
      '',
    )
  })
  return lines.join('\n')
}

/** The rolling digest issue: same content plus per-item dispatch instructions and the marker. */
export function renderIssueMarkdown(state: SignalsState, topN: number): string {
  const top = topItems(state, topN)
  const lines = [
    DIGEST_MARKER,
    `# 🛰️ Signals — what needs your attention`,
    '',
    `${state.items.length} items across ${state.repoCount} repos · updated ${state.generatedAt}`,
    '',
  ]
  if (top.length === 0) {
    lines.push('Nothing needs your attention right now. ✨')
    return lines.join('\n')
  }
  top.forEach((item, i) => {
    const dispatchHint =
      item.dispatch && !item.dispatch.status
        ? `\n   ↳ dispatch to an agent: comment \`/dispatch ${item.id}\``
        : ''
    lines.push(
      `${i + 1}. ${SEVERITY_ICON[item.severity]} **${item.title}** · \`${item.repo}\` (★${item.stars})${statusSuffix(item)}`,
      `   ${item.rationale}`,
      `   _${item.detail}_ · rank ${item.rank}${dispatchHint}`,
      '',
    )
  })
  lines.push('---', '_Posted by Signals. Reply `/dispatch <id>` on any item to hand it to a coding agent._')
  return lines.join('\n')
}

/** Slack mrkdwn (uses <url|text> links and *bold*, not standard markdown). */
export function renderSlackText(state: SignalsState, topN: number): string {
  const top = topItems(state, topN)
  if (top.length === 0) {
    return `:satellite: *Signals* — nothing needs your attention right now across ${state.repoCount} repos. :sparkles:`
  }
  const lines = [
    `:satellite: *Signals — top ${top.length} worth your time* (${state.items.length} items / ${state.repoCount} repos)`,
    '',
  ]
  top.forEach((item, i) => {
    const link = `<${item.repoUrl}|${item.repo}>`
    lines.push(`${i + 1}. ${SEVERITY_ICON[item.severity]} *${item.title}* · ${link} ★${item.stars}${statusSuffix(item)}`)
    lines.push(`    ${item.detail} · rank ${item.rank}`)
  })
  return lines.join('\n')
}

/** Minimal HTML email. */
export function renderEmailHtml(state: SignalsState, topN: number): string {
  const top = topItems(state, topN)
  const body =
    top.length === 0
      ? '<p>Nothing needs your attention right now. ✨</p>'
      : `<ol>${top
          .map(
            (item) =>
              `<li><strong>${SEVERITY_ICON[item.severity]} ${escapeHtml(item.title)}</strong> · ` +
              `<a href="${item.repoUrl}">${escapeHtml(item.repo)}</a> ★${item.stars}${escapeHtml(statusSuffix(item))}<br>` +
              `${escapeHtml(item.rationale)}<br><em>${escapeHtml(item.detail)}</em> · rank ${item.rank}</li>`,
          )
          .join('')}</ol>`
  return [
    `<h2>🛰️ Signals — what needs your attention</h2>`,
    `<p>${state.items.length} items across ${state.repoCount} repos · updated ${state.generatedAt}</p>`,
    body,
  ].join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const digestSubject = (state: SignalsState, topN: number): string => {
  const top = topItems(state, topN)
  return top.length === 0
    ? 'Signals: all clear'
    : `Signals: ${top.length} things worth your time (${state.repoCount} repos)`
}
