export function isBot(pr: { isBot?: boolean; authorLogin: string }): boolean {
  if (pr.isBot !== undefined) return pr.isBot
  return pr.authorLogin.includes('[bot]')
}

export function daysAgo(dateStr: string): number {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  )
}

export function formatMilestone(n: number): string {
  if (n >= 1000) return `${n / 1000}k`
  return String(n)
}
