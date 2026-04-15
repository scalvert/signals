import type { MCPTool } from './types'
import { listWorkspaces, getWorkspaceSummary } from './workspace'
import { getReposNeedingAttention, getRepoHealth, getRepoSignals, getRepoActionableItems, getExternalPrs } from './repos'
import { getSignalFeed } from './signals'
import { getTaskDetails, createTaskFromItem, updateTaskStatusTool, addTaskNoteTool } from './tasks'

export const ALL_TOOLS: MCPTool[] = [
  listWorkspaces,
  getWorkspaceSummary,
  getReposNeedingAttention,
  getExternalPrs,
  getRepoHealth,
  getSignalFeed,
  getRepoSignals,
  getRepoActionableItems,
  getTaskDetails,
  createTaskFromItem,
  updateTaskStatusTool,
  addTaskNoteTool,
]
