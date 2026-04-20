import type { HealthGrade, TriageStatus } from '@/types/workspace'

export const gradeColors: Record<HealthGrade, string> = {
  A: 'text-health-a bg-health-a/10 border-health-a/25',
  B: 'text-health-b bg-health-b/10 border-health-b/25',
  C: 'text-health-c bg-health-c/10 border-health-c/25',
  D: 'text-health-d bg-health-d/10 border-health-d/25',
  F: 'text-health-d bg-health-d/10 border-health-d/25',
}

export const triageColors: Record<TriageStatus, string> = {
  healthy: 'border-health-a/30 bg-health-a/5',
  watch: 'border-health-b/30 bg-health-b/5',
  critical: 'border-health-d/30 bg-health-d/5',
}

export const triageHeaderColors: Record<TriageStatus, string> = {
  healthy: 'text-health-a',
  watch: 'text-health-b',
  critical: 'text-health-d',
}

export const languageColors: Record<string, string> = {
  TypeScript: 'bg-[#3178c6]',
  Python: 'bg-[#3572A5]',
  Go: 'bg-[#00ADD8]',
  Ruby: 'bg-[#701516]',
  MDX: 'bg-[#fcb32c]',
  YAML: 'bg-[#cb171e]',
  JavaScript: 'bg-[#f1e05a]',
  Rust: 'bg-[#dea584]',
  Java: 'bg-[#b07219]',
  Shell: 'bg-[#89e051]',
}

export const languagePillColors: Record<string, string> = {
  TypeScript:
    'text-[oklch(0.52_0.22_260)] bg-[oklch(0.52_0.22_260)]/10',
  Python:
    'text-[oklch(0.6_0.15_185)] bg-[oklch(0.6_0.15_185)]/10',
  Go: 'text-[oklch(0.55_0.18_200)] bg-[oklch(0.55_0.18_200)]/10',
  Ruby: 'text-[oklch(0.55_0.22_27)] bg-[oklch(0.55_0.22_27)]/10',
  JavaScript:
    'text-[oklch(0.65_0.15_85)] bg-[oklch(0.65_0.15_85)]/10',
}
