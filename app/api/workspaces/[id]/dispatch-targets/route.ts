import { NextResponse } from 'next/server'
import {
  getDispatchTargets,
  upsertAgentOrchestratorDispatchTarget,
} from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess, requireWorkspaceRole } from '@/lib/auth/access'
import type { AgentOrchestratorConfig } from '@/types/workspace'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const workspaceId = Number(id)
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    await requireWorkspaceAccess(workspaceId)
    return NextResponse.json({ dispatchTargets: getDispatchTargets(workspaceId) })
  } catch (error) {
    return accessErrorResponse(error)
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const workspaceId = Number(id)
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    await requireWorkspaceRole(workspaceId, ['owner'])
    const body = await req.json() as {
      type?: string
      name?: string
      enabled?: boolean
      config?: Partial<AgentOrchestratorConfig>
    }

    if (body.type && body.type !== 'agent-orchestrator') {
      return NextResponse.json({ error: 'Unsupported dispatch target type' }, { status: 400 })
    }

    const target = upsertAgentOrchestratorDispatchTarget({
      workspaceId,
      name: body.name,
      enabled: body.enabled ?? true,
      config: {
        aoCommand: body.config?.aoCommand ?? 'ao',
        aoCwd: body.config?.aoCwd ?? '',
        projectId: body.config?.projectId ?? '',
        dashboardUrl: body.config?.dashboardUrl ?? null,
        defaultRunner: body.config?.defaultRunner ?? 'codex',
        allowedRunners: body.config?.allowedRunners ?? ['codex', 'claude-code', 'cursor', 'opencode'],
        runnerIdentity: body.config?.runnerIdentity ?? 'local runner identity',
      },
    })

    return NextResponse.json({ dispatchTarget: target })
  } catch (error) {
    return accessErrorResponse(error)
  }
}
