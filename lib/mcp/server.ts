import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { getWorkspaces } from '@/lib/db/queries'
import { ALL_TOOLS } from './tools'

export function createMCPServer() {
  const server = new Server(
    { name: 'signals', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  const toolMap = new Map(ALL_TOOLS.map((t) => [t.definition.name, t]))

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => t.definition),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const tool = toolMap.get(name)

    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }

    const workspaces = getWorkspaces()

    function resolveWorkspaceId(wsName?: string): number {
      if (!wsName && workspaces.length > 0) return workspaces[0].id
      const ws = workspaces.find(
        (w) => w.name.toLowerCase() === wsName?.toLowerCase() || w.slug === wsName?.toLowerCase(),
      )
      if (!ws) throw new Error(`Workspace "${wsName}" not found`)
      return ws.id
    }

    return tool.handler(args ?? {}, resolveWorkspaceId)
  })

  return server
}
