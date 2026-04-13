export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { seedDefaultSettings } = await import('@/lib/db/seed-settings')
    seedDefaultSettings()

    const { startAutoSync } = await import('@/lib/sync/auto-sync')
    startAutoSync()
  }
}
