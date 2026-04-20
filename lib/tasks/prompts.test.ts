import { describe, it, expect } from 'vitest'
import { buildPrompt } from './prompts'
import type { Task } from '@/types/workspace'

const mockTask: Task = {
  id: 1,
  workspaceId: 1,
  repoFullName: 'org/test-repo',
  title: 'Fix dormant repo',
  description: 'No commits in 45 days.',
  sourceType: 'signal',
  sourceId: '1',
  status: 'pending',
  provider: null,
  providerRef: null,
  createdAt: '2026-04-19T00:00:00Z',
  dispatchedAt: null,
  completedAt: null,
  notes: [],
}

describe('buildPrompt', () => {
  it('generates basic prompt without signal context', () => {
    const prompt = buildPrompt(mockTask)
    expect(prompt).toContain('## Task')
    expect(prompt).toContain('Fix dormant repo')
    expect(prompt).toContain('## Context')
    expect(prompt).toContain('## Instructions')
    expect(prompt).not.toContain('## Why this matters')
  })

  it('includes signal context sections when provided', () => {
    const prompt = buildPrompt(mockTask, {
      signalContext: {
        rationale: 'Dormant repos indicate abandoned maintenance.',
        fixGuidance: 'Push a commit or close the repo.',
        docsSummary: 'Checks last commit date against a 30-day threshold.',
        repoContext: 'Stable utility, rarely changes.',
      },
    })
    expect(prompt).toContain('## Why this matters')
    expect(prompt).toContain('Dormant repos indicate abandoned maintenance.')
    expect(prompt).toContain('## Fix guidance')
    expect(prompt).toContain('Push a commit or close the repo.')
    expect(prompt).toContain('## Signal details')
    expect(prompt).toContain('Checks last commit date against a 30-day threshold.')
    expect(prompt).toContain('## Repository context')
    expect(prompt).toContain('Stable utility, rarely changes.')
  })

  it('omits optional sections when not provided', () => {
    const prompt = buildPrompt(mockTask, {
      signalContext: {
        rationale: 'Important reason.',
        docsSummary: 'Summary here.',
      },
    })
    expect(prompt).toContain('## Why this matters')
    expect(prompt).toContain('## Signal details')
    expect(prompt).not.toContain('## Fix guidance')
    expect(prompt).not.toContain('## Repository context')
  })

  it('includes MCP instructions when requested', () => {
    const prompt = buildPrompt(mockTask, { includeMcpInstructions: true })
    expect(prompt).toContain('## Signals MCP Server')
    expect(prompt).toContain('update_task_status')
  })

  it('signal context appears before instructions', () => {
    const prompt = buildPrompt(mockTask, {
      signalContext: {
        rationale: 'Reason.',
        docsSummary: 'Details.',
      },
    })
    const reasonIdx = prompt.indexOf('## Why this matters')
    const instructIdx = prompt.indexOf('## Instructions')
    expect(reasonIdx).toBeLessThan(instructIdx)
  })
})
