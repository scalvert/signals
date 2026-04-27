import { describe, it, expect } from 'vitest'
import { buildPrompt, interpolatePrompt } from './prompts'
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
  dispatchState: null,
  resultRef: null,
  statusLine: null,
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

describe('interpolatePrompt', () => {
  it('substitutes simple variables', () => {
    const result = interpolatePrompt('Hello {{name}}, repo {{repo}}', {
      name: 'Alice',
      repo: 'org/foo',
    })
    expect(result).toBe('Hello Alice, repo org/foo')
  })

  it('leaves missing variables as empty strings', () => {
    const result = interpolatePrompt('Hello {{name}}!', {})
    expect(result).toBe('Hello !')
  })

  it('handles {{#each}} loops', () => {
    const result = interpolatePrompt(
      '{{#each items}}- {{this.label}}\n{{/each}}',
      { items: [{ label: 'A' }, { label: 'B' }] },
    )
    expect(result).toBe('- A\n- B\n')
  })

  it('handles {{#if}} conditionals', () => {
    const result = interpolatePrompt(
      '{{#if showExtra}}bonus{{/if}}',
      { showExtra: true },
    )
    expect(result).toBe('bonus')
  })

  it('handles {{#if}} with {{else}}', () => {
    const result = interpolatePrompt(
      '{{#if showExtra}}bonus{{else}}none{{/if}}',
      { showExtra: false },
    )
    expect(result).toBe('none')
  })

  it('handles nested {{#if this.field}} inside {{#each}}', () => {
    const result = interpolatePrompt(
      '{{#each prs}}#{{this.number}} ({{#if this.isExternal}}external{{else}}internal{{/if}})\n{{/each}}',
      { prs: [{ number: 1, isExternal: true }, { number: 2, isExternal: false }] },
    )
    expect(result).toBe('#1 (external)\n#2 (internal)\n')
  })

  it('returns empty for {{#each}} on missing key', () => {
    const result = interpolatePrompt('before{{#each items}}X{{/each}}after', {})
    expect(result).toBe('beforeafter')
  })

  it('handles the stale-prs prompt template shape', () => {
    const template = [
      'Maintainer of {{repoFullName}}.',
      '',
      '{{#each prs}}',
      '- PR #{{this.number}} "{{this.title}}" by @{{this.author}} — {{this.daysSinceUpdate}} days ({{#if this.isExternal}}external{{else}}internal{{/if}})',
      '{{/each}}',
    ].join('\n')

    const result = interpolatePrompt(template, {
      repoFullName: 'org/repo',
      prs: [
        { number: 42, title: 'Add feature', author: 'bob', daysSinceUpdate: 30, isExternal: true },
        { number: 99, title: 'Fix bug', author: 'alice', daysSinceUpdate: 14, isExternal: false },
      ],
    })

    expect(result).toContain('Maintainer of org/repo.')
    expect(result).toContain('PR #42 "Add feature" by @bob — 30 days (external)')
    expect(result).toContain('PR #99 "Fix bug" by @alice — 14 days (internal)')
  })
})
