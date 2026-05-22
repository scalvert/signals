import { describe, expect, it } from 'vitest'
import { getActivePillarMax } from './RepoRow'
import type { RepoDashboardRow } from '@/lib/db/queries'

function rowWithPillars(pillars: string[]): Pick<RepoDashboardRow, 'repo'> {
  return {
    repo: ({
      checkResults: Object.fromEntries(
        pillars.map((pillar, index) => [
          `${pillar}-${index}`,
          {
            score: 1,
            label: pillar,
            evidence: [],
            pillar,
            checkName: pillar,
            fixable: false,
          },
        ]),
      ),
    } as unknown) as RepoDashboardRow['repo'],
  }
}

describe('getActivePillarMax', () => {
  it('scales active pillars across 100 points', () => {
    expect(getActivePillarMax(rowWithPillars(['activity', 'quality']))).toBe(50)
    expect(getActivePillarMax(rowWithPillars(['activity', 'community', 'quality', 'security']))).toBe(25)
  })

  it('falls back to the legacy 25 point max with no check results', () => {
    expect(getActivePillarMax(rowWithPillars([]))).toBe(25)
  })
})
