import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export interface MCPTool {
  definition: Tool
  handler: (args: Record<string, unknown>, resolveWorkspaceId: (name?: string) => number) => CallToolResult
}

export function json(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function error(message: string): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }
}
