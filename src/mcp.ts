import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { loadConfig } from './config'
import { collectState } from './collect'
import { dispatchItem } from './dispatch'
import { readState, writeState } from './state'
import type { AttentionItem, SignalsState } from './types'

/** Read cached state, or compute it fresh (and cache it) when missing or when refresh is requested. */
async function getState(refresh: boolean): Promise<SignalsState> {
  if (!refresh) {
    const cached = readState()
    if (cached) return cached
  }
  const state = await collectState(loadConfig())
  writeState(state)
  return state
}

function summarize(item: AttentionItem): Record<string, unknown> {
  return {
    id: item.id,
    repo: item.repo,
    stars: item.stars,
    type: item.type,
    severity: item.severity,
    title: item.title,
    rationale: item.rationale,
    detail: item.detail,
    rank: item.rank,
    impact: item.impact,
    effort: item.effort,
    fixable: item.fixable,
    dispatchable: Boolean(item.dispatch),
    expectedOutcome: item.dispatch?.expectedOutcome,
    dispatchStatus: item.dispatch?.status,
  }
}

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

const LIST_ATTENTION = {
  name: 'list_attention',
  description:
    'List the ranked cross-repo attention items — the things most worth a maintainer\'s time right now, highest rank first. Use this to answer "what should I work on?".',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max items to return (default 10).' },
      repo: { type: 'string', description: 'Filter to one repo (owner/name).' },
      category: {
        type: 'string',
        enum: ['activity', 'community', 'quality', 'security'],
        description: 'Filter to one health category.',
      },
      refresh: {
        type: 'boolean',
        description: 'Re-fetch from GitHub instead of reading the cached digest (slower).',
      },
    },
  },
} as const

const GET_ITEM = {
  name: 'get_item',
  description:
    'Get the full detail for one attention item by id (repo#type), including the ready-to-dispatch agent prompt.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Item id, e.g. "owner/repo#dormant-repo".' } },
    required: ['id'],
  },
} as const

const DISPATCH_ITEM = {
  name: 'dispatch_item',
  description:
    'Hand an attention item off to a hosted coding agent (the Claude GitHub app) by opening a scoped issue in the target repo. The agent then opens a PR. Returns the created issue URL.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Item id to dispatch, e.g. "owner/repo#dormant-repo".' },
    },
    required: ['id'],
  },
} as const

export function createServer(): Server {
  const server = new Server(
    { name: 'signals', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [LIST_ATTENTION, GET_ITEM, DISPATCH_ITEM],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params
    const args = (rawArgs ?? {}) as Record<string, unknown>

    if (name === 'list_attention') {
      const state = await getState(Boolean(args.refresh))
      let items = state.items
      if (typeof args.repo === 'string') items = items.filter((i) => i.repo === args.repo)
      if (typeof args.category === 'string') items = items.filter((i) => i.category === args.category)
      const limit = typeof args.limit === 'number' ? args.limit : 10
      return textResult({
        generatedAt: state.generatedAt,
        repoCount: state.repoCount,
        totalItems: items.length,
        items: items.slice(0, limit).map(summarize),
      })
    }

    if (name === 'get_item') {
      const id = String(args.id ?? '')
      const state = await getState(false)
      const item = state.items.find((i) => i.id === id)
      if (!item) {
        return { content: [{ type: 'text', text: `No item with id "${id}".` }], isError: true }
      }
      return textResult(item)
    }

    if (name === 'dispatch_item') {
      const id = String(args.id ?? '')
      const state = await getState(false)
      const item = state.items.find((i) => i.id === id)
      if (!item) {
        return { content: [{ type: 'text', text: `No item with id "${id}".` }], isError: true }
      }
      if (!item.dispatch) {
        return { content: [{ type: 'text', text: `Item "${id}" is not dispatchable.` }], isError: true }
      }
      const agent = loadConfig().dispatch.agent
      const result = await dispatchItem(item, { agent })
      writeState(state)
      return textResult({ ...result, message: `Opened ${result.targetIssueUrl} and routed to ${agent}.` })
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  })

  return server
}

async function main(): Promise<void> {
  const server = createServer()
  await server.connect(new StdioServerTransport())
  console.error('[signals] MCP server ready (stdio)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
