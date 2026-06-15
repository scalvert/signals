import { loadConfig } from './config'
import { collectState } from './collect'
import { mergeDispatchState, reconcileDispatch } from './reconcile'
import { readState, writeState } from './state'
import type { AttentionItem, SignalsState } from './types'

const SEVERITY_ICON = { critical: '🔴', warning: '🟡', info: '🔵' } as const

function renderItem(item: AttentionItem, index: number): string {
  const icon = SEVERITY_ICON[item.severity]
  const act = item.dispatch
    ? `dispatchable → ${item.dispatch.expectedOutcome ?? 'agent'} · effort ${item.effort}`
    : 'manual'
  return [
    `${index + 1}. ${icon} **${item.title}**  ·  ${item.repo} (★${item.stars})`,
    `   ${item.rationale}`,
    `   _${item.detail}_`,
    `   rank ${item.rank} · impact ${item.impact} · ${act}`,
  ].join('\n')
}

export function renderDigest(state: SignalsState, topN: number): string {
  const top = state.items.slice(0, topN)
  const lines = [
    `# Signals digest — ${state.items.length} items across ${state.repoCount} repos`,
    '',
    `Generated ${state.generatedAt}`,
    '',
  ]
  if (top.length === 0) {
    lines.push('Nothing needs your attention right now. ✨')
  } else {
    lines.push(`## Top ${top.length} worth your time`, '')
    top.forEach((item, i) => lines.push(renderItem(item, i), ''))
  }
  return lines.join('\n')
}

async function main(): Promise<void> {
  const config = loadConfig()
  console.error('[signals] fetching repos + PRs…')
  const prior = readState()
  const state = await collectState(config)
  mergeDispatchState(state, prior)
  await reconcileDispatch(state, { openMissingPRs: false })
  writeState(state)
  console.error(
    `[signals] wrote state/signals.json (${state.items.length} items, ${state.repoCount} repos)`,
  )
  console.log(renderDigest(state, config.digest.topN))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
