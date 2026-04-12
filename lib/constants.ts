import type { HealthGrade, TriageStatus } from '@/types/workspace'

export const gradeColors: Record<HealthGrade, string> = {
  A: 'text-[oklch(0.55_0.18_145)] bg-[oklch(0.55_0.18_145)]/10 border-[oklch(0.55_0.18_145)]/25',
  B: 'text-[oklch(0.72_0.17_85)] bg-[oklch(0.72_0.17_85)]/10 border-[oklch(0.72_0.17_85)]/25',
  C: 'text-[oklch(0.65_0.18_45)] bg-[oklch(0.65_0.18_45)]/10 border-[oklch(0.65_0.18_45)]/25',
  D: 'text-[oklch(0.55_0.22_27)] bg-[oklch(0.55_0.22_27)]/10 border-[oklch(0.55_0.22_27)]/25',
  F: 'text-[oklch(0.55_0.22_27)] bg-[oklch(0.55_0.22_27)]/10 border-[oklch(0.55_0.22_27)]/25',
}

export const triageColors: Record<TriageStatus, string> = {
  healthy:
    'border-[oklch(0.55_0.18_145)]/30 bg-[oklch(0.55_0.18_145)]/5',
  watch:
    'border-[oklch(0.72_0.17_85)]/30 bg-[oklch(0.72_0.17_85)]/5',
  critical:
    'border-[oklch(0.55_0.22_27)]/30 bg-[oklch(0.55_0.22_27)]/5',
}

export const triageHeaderColors: Record<TriageStatus, string> = {
  healthy: 'text-[oklch(0.55_0.18_145)]',
  watch: 'text-[oklch(0.72_0.17_85)]',
  critical: 'text-[oklch(0.55_0.22_27)]',
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
