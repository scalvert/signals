import { schedule, type ScheduledTask } from 'node-cron'
import { getWorkspaces } from '@/lib/db/queries'
import { syncWorkspace } from './engine'

let task: ScheduledTask | null = null

export function startAutoSync() {
  const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES) || 15
  const cronExpression = `*/${intervalMinutes} * * * *`

  if (task) {
    task.stop()
  }

  console.info(
    `[signals] Auto-sync enabled: every ${intervalMinutes} minutes`,
  )

  task = schedule(cronExpression, async () => {
    const workspaces = getWorkspaces()
    for (const workspace of workspaces) {
      try {
        console.info(`[signals] Auto-syncing workspace: ${workspace.name}`)
        const result = await syncWorkspace(workspace)
        console.info(
          `[signals] Synced ${workspace.name}: ${result.repoCount} repos, ${result.prCount} PRs, ${result.signalCount} signals`,
        )
      } catch (err) {
        console.error(
          `[signals] Auto-sync failed for ${workspace.name}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
  })
}
