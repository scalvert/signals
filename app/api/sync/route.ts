import { NextResponse } from 'next/server'
import { syncWorkspace } from '@/lib/sync/engine'
import { AccessError, accessErrorResponse, requireWorkspaceAccessBySlug } from '@/lib/auth/access'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { error: 'slug query parameter is required' },
        { status: 400 },
      )
    }

    const { workspace, membership } = await requireWorkspaceAccessBySlug(slug)
    if (membership.role === 'viewer') {
      return NextResponse.json({ error: 'Workspace role is not allowed' }, { status: 403 })
    }

    const result = await syncWorkspace(workspace)
    return NextResponse.json({
      status: 'success',
      workspace: workspace.name,
      ...result,
    })
  } catch (err) {
    if (err instanceof AccessError) return accessErrorResponse(err)
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
