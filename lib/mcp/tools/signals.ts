import { getSignals } from '@/lib/db/queries'
import { json, type MCPTool } from './types'

export const getSignalFeed: MCPTool = {
  definition: {
    name: 'get_signal_feed',
    description: 'Get recent signals (star spikes, health drops, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceName: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  handler: (args, resolveWorkspaceId) => {
    const id = resolveWorkspaceId(args.workspaceName as string)
    const limit = (args.limit as number) ?? 10
    return json(getSignals(id, { limit }))
  },
}
