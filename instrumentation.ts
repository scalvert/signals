export async function register() {
  // Only run on the server, not in Edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutoSync } = await import('@/lib/sync/auto-sync')
    startAutoSync()
  }
}
