export function isBot(authorLogin: string): boolean {
  return authorLogin.includes('[bot]')
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
