import { describe, expect, it } from 'vitest'
import { canDispatchWithPermission } from './permissions'

describe('canDispatchWithPermission', () => {
  it('allows write-level GitHub permissions', () => {
    expect(canDispatchWithPermission('write')).toBe(true)
    expect(canDispatchWithPermission('maintain')).toBe(true)
    expect(canDispatchWithPermission('admin')).toBe(true)
  })

  it('rejects read-only GitHub permissions', () => {
    expect(canDispatchWithPermission('none')).toBe(false)
    expect(canDispatchWithPermission('read')).toBe(false)
    expect(canDispatchWithPermission('triage')).toBe(false)
  })
})

