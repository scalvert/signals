import { NextResponse } from 'next/server'
import { getDispatchTargetForWorkspace } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceAccess } from '@/lib/auth/access'
import { getAgentOrchestratorStatus } from '@/lib/dispatch/agent-orchestrator'

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
    const target = getDispatchTargetForWorkspace(workspaceId, 'agent-orchestrator')
    if (!target) {
      return NextResponse.json({
        status: {
          configured: false,
          available: false,
          message: 'Agent Orchestrator is not configured for this workspace.',
        },
      })
    }

    const status = await getAgentOrchestratorStatus(target.config)
    return NextResponse.json({ status, dispatchTarget: target })
  } catch (error) {
    return accessErrorResponse(error)
  }
}
