export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate GitHub token early
    try {
      const { getOctokit } = await import('@/lib/github/client')
      getOctokit()
      console.info('[signals] GitHub token configured')
    } catch (err) {
      console.warn('[signals] GitHub token not configured:', err instanceof Error ? err.message : err)
      console.warn('[signals] Sync will not work until a GitHub token is provided')
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[signals] ANTHROPIC_API_KEY not set — AI chat and signal enrichment will be disabled')
    }

    const { seedDefaultSettings } = await import('@/lib/db/seed-settings')
    seedDefaultSettings()

    const { startAutoSync } = await import('@/lib/sync/auto-sync')
    startAutoSync()
  }
}
