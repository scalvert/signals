import { loadConfig } from './config'
import { collectState } from './collect'
import { mergeDispatchState, reconcileDispatch } from './reconcile'
import { readState, writeState } from './state'
import { renderDigestMarkdown } from './render'
import { notify } from './notify'
import { upsertDigestIssue } from './issue'

/** Build the digest: fetch + rank, carry dispatch state forward, reconcile, persist, notify. */
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

  console.log(renderDigestMarkdown(state, config.digest.topN))
  await notify(config, state)

  // Publish the rolling digest issue only when running in the Action (avoids
  // creating GitHub issues from local digest runs).
  if (process.env.GITHUB_ACTIONS === 'true') {
    const url = await upsertDigestIssue(config, state)
    console.error(`[signals] digest issue: ${url}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
