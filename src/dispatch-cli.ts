import { loadConfig } from './config'
import { collectState } from './collect'
import { readState, writeState } from './state'
import { dispatchItem } from './dispatch'

/** Dispatch a single attention item to the configured hosted agent from the terminal. */
async function main(): Promise<void> {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: tsx src/dispatch-cli.ts "<owner/repo#type>"')
    process.exit(1)
  }

  const config = loadConfig()
  const state = readState() ?? (await collectState(config))
  const item = state.items.find((i) => i.id === id)
  if (!item) {
    console.error(`No attention item with id "${id}". Run the digest first.`)
    process.exit(1)
  }
  if (!item.dispatch) {
    console.error(`Item "${id}" is not dispatchable.`)
    process.exit(1)
  }

  const result = await dispatchItem(item, { agent: config.dispatch.agent })
  writeState(state)
  console.log(`Dispatched ${id} → ${config.dispatch.agent}`)
  console.log(`Issue: ${result.targetIssueUrl}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
