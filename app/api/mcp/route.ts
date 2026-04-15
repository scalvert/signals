import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createMCPServer } from '@/lib/mcp/server'
import { IncomingMessage, ServerResponse } from 'http'
import { Socket } from 'net'

// Store transports by session ID for stateful connections
const transports = new Map<string, StreamableHTTPServerTransport>()

function createNodeRequest(req: Request): IncomingMessage {
  const url = new URL(req.url)
  const incoming = new IncomingMessage(new Socket())
  incoming.method = req.method
  incoming.url = url.pathname + url.search
  req.headers.forEach((value, key) => {
    incoming.headers[key] = value
  })
  return incoming
}

async function handleMCP(req: Request): Promise<Response> {
  const body = await req.json()
  const sessionId = req.headers.get('mcp-session-id') ?? undefined

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!
    return new Promise<Response>((resolve) => {
      const nodeReq = createNodeRequest(req)
      const chunks: Buffer[] = []
      const nodeRes = new ServerResponse(nodeReq)

      nodeRes.on('finish', () => {
        const responseBody = Buffer.concat(chunks).toString()
        const headers: Record<string, string> = {}
        const rawHeaders = nodeRes.getHeaders()
        for (const [key, val] of Object.entries(rawHeaders)) {
          if (val) headers[key] = String(val)
        }
        resolve(new Response(responseBody, {
          status: nodeRes.statusCode,
          headers,
        }))
      })

      const origWrite = nodeRes.write.bind(nodeRes)
      nodeRes.write = (chunk: unknown, ...args: unknown[]) => {
        if (Buffer.isBuffer(chunk)) chunks.push(chunk)
        else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk))
        return origWrite(chunk, ...args as [BufferEncoding, () => void])
      }

      transport.handleRequest(nodeReq, nodeRes, body)
    })
  }

  if (isInitializeRequest(body)) {
    const server = createMCPServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport)
      },
    })

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId)
      }
    }

    await server.connect(transport)

    return new Promise<Response>((resolve) => {
      const nodeReq = createNodeRequest(req)
      const chunks: Buffer[] = []
      const nodeRes = new ServerResponse(nodeReq)

      nodeRes.on('finish', () => {
        const responseBody = Buffer.concat(chunks).toString()
        const headers: Record<string, string> = {}
        const rawHeaders = nodeRes.getHeaders()
        for (const [key, val] of Object.entries(rawHeaders)) {
          if (val) headers[key] = String(val)
        }
        resolve(new Response(responseBody, {
          status: nodeRes.statusCode,
          headers,
        }))
      })

      const origWrite = nodeRes.write.bind(nodeRes)
      nodeRes.write = (chunk: unknown, ...args: unknown[]) => {
        if (Buffer.isBuffer(chunk)) chunks.push(chunk)
        else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk))
        return origWrite(chunk, ...args as [BufferEncoding, () => void])
      }

      transport.handleRequest(nodeReq, nodeRes, body)
    })
  }

  return new Response(JSON.stringify({ error: 'Invalid request — missing session ID or not an initialize request' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: Request) {
  return handleMCP(req)
}

export async function GET() {
  return new Response(JSON.stringify({
    name: 'signals',
    version: '0.1.0',
    description: 'Signals OSS Maintainer Dashboard — MCP Server',
    tools: [
      'list_workspaces',
      'get_workspace_summary',
      'get_repos_needing_attention',
      'get_external_prs',
      'get_repo_health',
      'get_signal_feed',
      'get_repo_signals',
      'get_repo_actionable_items',
      'get_task_details',
      'create_task_from_item',
      'update_task_status',
      'add_task_note',
    ],
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
