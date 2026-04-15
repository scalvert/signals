import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client')

import { sqlite } from './__mocks__/client'
import {
  createTask,
  getTask,
  getTasks,
  updateTaskStatus,
  addTaskNote,
} from './queries'

function seedWorkspace(): number {
  const stmt = sqlite.prepare(
    `INSERT INTO workspaces (name, slug, sources, excluded_repos, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const result = stmt.run('Test Workspace', 'test-ws', '[]', '[]', new Date().toISOString())
  return Number(result.lastInsertRowid)
}

function seedWorkspaceWith(name: string, slug: string): number {
  const stmt = sqlite.prepare(
    `INSERT INTO workspaces (name, slug, sources, excluded_repos, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const result = stmt.run(name, slug, '[]', '[]', new Date().toISOString())
  return Number(result.lastInsertRowid)
}

describe('task query functions', () => {
  let workspaceId: number

  beforeEach(() => {
    sqlite.exec('DELETE FROM tasks')
    sqlite.exec('DELETE FROM workspaces')
    workspaceId = seedWorkspace()
  })

  describe('createTask', () => {
    it('creates a task with pending status', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Fix health drop',
        description: 'Health score dropped below threshold',
        sourceType: 'signal',
        sourceId: 'signal-1',
      })

      expect(task.status).toBe('pending')
    })

    it('stores all provided fields', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Fix CI',
        description: 'CI is failing',
        sourceType: 'check',
        sourceId: 'check-42',
      })

      expect(task.workspaceId).toBe(workspaceId)
      expect(task.repoFullName).toBe('org/repo')
      expect(task.title).toBe('Fix CI')
      expect(task.description).toBe('CI is failing')
      expect(task.sourceType).toBe('check')
      expect(task.sourceId).toBe('check-42')
    })

    it('sets createdAt timestamp', () => {
      const before = new Date().toISOString()
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      const after = new Date().toISOString()

      expect(task.createdAt).toBeDefined()
      expect(task.createdAt >= before).toBe(true)
      expect(task.createdAt <= after).toBe(true)
    })

    it('initializes with null optional fields and empty notes', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })

      expect(task.provider).toBeNull()
      expect(task.providerRef).toBeNull()
      expect(task.dispatchedAt).toBeNull()
      expect(task.completedAt).toBeNull()
      expect(task.notes).toEqual([])
    })

    it('returns an auto-incremented id', () => {
      const t1 = createTask({
        workspaceId,
        repoFullName: 'org/a',
        title: 'A',
        description: 'A',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      const t2 = createTask({
        workspaceId,
        repoFullName: 'org/b',
        title: 'B',
        description: 'B',
        sourceType: 'signal',
        sourceId: 's-2',
      })

      expect(t2.id).toBeGreaterThan(t1.id)
    })
  })

  describe('getTask', () => {
    it('retrieves a task by id', () => {
      const created = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'My Task',
        description: 'Details',
        sourceType: 'signal',
        sourceId: 's-1',
      })

      const fetched = getTask(created.id)

      expect(fetched).toBeDefined()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.title).toBe('My Task')
    })

    it('returns undefined for non-existent id', () => {
      const result = getTask(99999)
      expect(result).toBeUndefined()
    })
  })

  describe('getTasks', () => {
    it('lists all tasks for a workspace', () => {
      createTask({
        workspaceId,
        repoFullName: 'org/a',
        title: 'A',
        description: 'A',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      createTask({
        workspaceId,
        repoFullName: 'org/b',
        title: 'B',
        description: 'B',
        sourceType: 'check',
        sourceId: 'c-1',
      })

      const all = getTasks(workspaceId)
      expect(all).toHaveLength(2)
    })

    it('returns empty array when no tasks exist', () => {
      const all = getTasks(workspaceId)
      expect(all).toEqual([])
    })

    it('does not return tasks from another workspace', () => {
      const otherWsId = seedWorkspaceWith('other', 'other-ws')

      createTask({
        workspaceId,
        repoFullName: 'org/mine',
        title: 'Mine',
        description: 'Mine',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      createTask({
        workspaceId: otherWsId,
        repoFullName: 'org/theirs',
        title: 'Theirs',
        description: 'Theirs',
        sourceType: 'signal',
        sourceId: 's-2',
      })

      const mine = getTasks(workspaceId)
      expect(mine).toHaveLength(1)
      expect(mine[0].repoFullName).toBe('org/mine')
    })

    it('filters by status', () => {
      const t1 = createTask({
        workspaceId,
        repoFullName: 'org/a',
        title: 'A',
        description: 'A',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      createTask({
        workspaceId,
        repoFullName: 'org/b',
        title: 'B',
        description: 'B',
        sourceType: 'signal',
        sourceId: 's-2',
      })

      updateTaskStatus(t1.id, 'dispatched')

      const dispatched = getTasks(workspaceId, { status: 'dispatched' })
      expect(dispatched).toHaveLength(1)
      expect(dispatched[0].id).toBe(t1.id)

      const pending = getTasks(workspaceId, { status: 'pending' })
      expect(pending).toHaveLength(1)
    })

    it('filters by repoFullName', () => {
      createTask({
        workspaceId,
        repoFullName: 'org/alpha',
        title: 'Alpha task',
        description: 'A',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      createTask({
        workspaceId,
        repoFullName: 'org/beta',
        title: 'Beta task',
        description: 'B',
        sourceType: 'check',
        sourceId: 'c-1',
      })

      const alpha = getTasks(workspaceId, { repoFullName: 'org/alpha' })
      expect(alpha).toHaveLength(1)
      expect(alpha[0].title).toBe('Alpha task')
    })

    it('returns results ordered by createdAt descending', () => {
      createTask({
        workspaceId,
        repoFullName: 'org/a',
        title: 'First',
        description: 'A',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      createTask({
        workspaceId,
        repoFullName: 'org/b',
        title: 'Second',
        description: 'B',
        sourceType: 'signal',
        sourceId: 's-2',
      })

      const all = getTasks(workspaceId)
      expect(all).toHaveLength(2)
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].createdAt >= all[i].createdAt).toBe(true)
      }
    })
  })

  describe('updateTaskStatus', () => {
    it('sets dispatchedAt when transitioning to dispatched', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })

      const before = new Date().toISOString()
      const updated = updateTaskStatus(task.id, 'dispatched')
      const after = new Date().toISOString()

      expect(updated).toBeDefined()
      expect(updated!.status).toBe('dispatched')
      expect(updated!.dispatchedAt).not.toBeNull()
      expect(updated!.dispatchedAt! >= before).toBe(true)
      expect(updated!.dispatchedAt! <= after).toBe(true)
      expect(updated!.completedAt).toBeNull()
    })

    it('sets completedAt when transitioning to completed', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      updateTaskStatus(task.id, 'dispatched')

      const before = new Date().toISOString()
      const updated = updateTaskStatus(task.id, 'completed')
      const after = new Date().toISOString()

      expect(updated).toBeDefined()
      expect(updated!.status).toBe('completed')
      expect(updated!.completedAt).not.toBeNull()
      expect(updated!.completedAt! >= before).toBe(true)
      expect(updated!.completedAt! <= after).toBe(true)
    })

    it('sets completedAt when transitioning to failed', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      updateTaskStatus(task.id, 'dispatched')

      const updated = updateTaskStatus(task.id, 'failed')

      expect(updated).toBeDefined()
      expect(updated!.status).toBe('failed')
      expect(updated!.completedAt).not.toBeNull()
    })

    it('sets completedAt when transitioning to verified', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })
      updateTaskStatus(task.id, 'dispatched')

      const updated = updateTaskStatus(task.id, 'verified')

      expect(updated).toBeDefined()
      expect(updated!.status).toBe('verified')
      expect(updated!.completedAt).not.toBeNull()
    })

    it('stores provider and providerRef', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })

      const updated = updateTaskStatus(task.id, 'dispatched', {
        provider: 'github-actions',
        providerRef: 'run-12345',
      })

      expect(updated).toBeDefined()
      expect(updated!.provider).toBe('github-actions')
      expect(updated!.providerRef).toBe('run-12345')
    })

    it('returns undefined for non-existent task', () => {
      const result = updateTaskStatus(99999, 'dispatched')
      expect(result).toBeUndefined()
    })
  })

  describe('addTaskNote', () => {
    it('adds a note with timestamp and source', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })

      const before = new Date().toISOString()
      const updated = addTaskNote(task.id, 'Started analysis', 'agent')
      const after = new Date().toISOString()

      expect(updated).toBeDefined()
      expect(updated!.notes).toHaveLength(1)
      expect(updated!.notes[0].text).toBe('Started analysis')
      expect(updated!.notes[0].source).toBe('agent')
      expect(updated!.notes[0].timestamp >= before).toBe(true)
      expect(updated!.notes[0].timestamp <= after).toBe(true)
    })

    it('appends to existing notes', () => {
      const task = createTask({
        workspaceId,
        repoFullName: 'org/repo',
        title: 'Task',
        description: 'Desc',
        sourceType: 'signal',
        sourceId: 's-1',
      })

      addTaskNote(task.id, 'First note', 'system')
      const updated = addTaskNote(task.id, 'Second note', 'agent')

      expect(updated).toBeDefined()
      expect(updated!.notes).toHaveLength(2)
      expect(updated!.notes[0].text).toBe('First note')
      expect(updated!.notes[0].source).toBe('system')
      expect(updated!.notes[1].text).toBe('Second note')
      expect(updated!.notes[1].source).toBe('agent')
    })

    it('returns undefined for non-existent task', () => {
      const result = addTaskNote(99999, 'note', 'system')
      expect(result).toBeUndefined()
    })
  })
})
