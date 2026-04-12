import { NextResponse } from 'next/server'
import { syncWorkspace } from '@/lib/sync/engine'
import { getWorkspaceBySlug } from '@/lib/db/queries'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json(
      { error: 'slug query parameter is required' },
      { status: 400 },
    )
  }

  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) {
    return NextResponse.json(
      { error: `Workspace "${slug}" not found` },
      { status: 404 },
    )
  }

  try {
    const result = await syncWorkspace(workspace)
    return NextResponse.json({
      status: 'success',
      workspace: workspace.name,
      ...result,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
