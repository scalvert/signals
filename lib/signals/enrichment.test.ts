import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrichSignals } from './enrichment'
import type { Signal } from '@/types/workspace'

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-model'),
}))

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

const mockSignal: Signal = {
  id: 1,
  type: 'dormant',
  severity: 'warning',
  title: 'test-repo appears dormant',
  body: 'No commits in 45 days.',
  repoFullName: 'org/test-repo',
  metadata: {},
  detectedAt: '2026-04-13T00:00:00Z',
  workspaceId: 1,
  status: 'active',
  dismissedReason: null,
  enrichedBody: null,
}

describe('enrichSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns enriched bodies keyed by signal id', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        enrichments: [
          { signalId: 1, enrichedBody: 'No commits in 45 days, but this is a stable utility.' },
        ],
      },
    } as never)

    const result = await enrichSignals(
      [mockSignal],
      new Map([['org/test-repo', 'Stable utility, rarely changes']]),
      'claude-haiku-4-5-20251001',
    )

    expect(result.get(1)).toBe('No commits in 45 days, but this is a stable utility.')
  })

  it('returns empty map when signals array is empty', async () => {
    const result = await enrichSignals([], new Map(), 'claude-haiku-4-5-20251001')
    expect(result.size).toBe(0)
  })

  it('returns empty map when generateObject throws', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockRejectedValue(new Error('API error'))

    const result = await enrichSignals(
      [mockSignal],
      new Map(),
      'claude-haiku-4-5-20251001',
    )

    expect(result.size).toBe(0)
  })
})
