import { getTask, createTask, updateTaskStatus, addTaskNote } from '@/lib/db/queries'
import type { TaskStatus } from '@/types/workspace'
import { json, error, type MCPTool } from './types'

export const getTaskDetails: MCPTool = {
  definition: {
    name: 'get_task_details',
    description: 'Get full context for a specific task',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'number', description: 'Task ID' } },
      required: ['taskId'],
    },
  },
  handler: (args) => {
    const task = getTask(args.taskId as number)
    if (!task) return error('Task not found')
    return json(task)
  },
}

export const createTaskFromItem: MCPTool = {
  definition: {
    name: 'create_task_from_item',
    description: 'Create a task from an actionable item (failing check or active signal). Use after get_repo_actionable_items to start tracking work.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceName: { type: 'string' },
        repoFullName: { type: 'string', description: 'Full repo name' },
        sourceType: { type: 'string', enum: ['signal', 'check'] },
        sourceId: { type: 'string', description: 'Signal ID or check ID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'What needs to be done' },
      },
      required: ['repoFullName', 'sourceType', 'sourceId', 'title', 'description'],
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const task = createTask({
      workspaceId: id,
      repoFullName: args.repoFullName as string,
      sourceType: args.sourceType as 'signal' | 'check',
      sourceId: args.sourceId as string,
      title: args.title as string,
      description: args.description as string,
    })
    const updated = updateTaskStatus(task.id, 'dispatched', { provider: 'mcp-self-serve' })
    return json(updated)
  },
}

export const updateTaskStatusTool: MCPTool = {
  definition: {
    name: 'update_task_status',
    description: 'Update the status of a task. Use "completed" when work is done, "failed" if it could not be completed.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'number', description: 'Task ID' },
        status: { type: 'string', enum: ['completed', 'failed'] },
        providerRef: { type: 'string', description: 'Reference to the result (e.g. PR URL)' },
      },
      required: ['taskId', 'status'],
    },
  },
  handler: (args) => {
    const task = updateTaskStatus(args.taskId as number, args.status as TaskStatus, { providerRef: args.providerRef as string })
    if (!task) return error('Task not found')
    return json(task)
  },
}

export const addTaskNoteTool: MCPTool = {
  definition: {
    name: 'add_task_note',
    description: 'Add a progress note to a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'number', description: 'Task ID' },
        text: { type: 'string', description: 'Note text' },
      },
      required: ['taskId', 'text'],
    },
  },
  handler: (args) => {
    const task = addTaskNote(args.taskId as number, args.text as string, 'agent')
    if (!task) return error('Task not found')
    return json(task)
  },
}
