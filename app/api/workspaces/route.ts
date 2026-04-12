import { NextResponse } from 'next/server'
import { createWorkspace, getWorkspaces } from '@/lib/db/queries'
import { slugify } from '@/lib/utils'
import type { WorkspaceSource } from '@/types/workspace'

export async function GET() {
  const workspaces = getWorkspaces()
  return NextResponse.json(workspaces)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, sources } = body as {
    name: string
    sources: WorkspaceSource[]
  }

  if (!name || !sources || sources.length === 0) {
    return NextResponse.json(
      { error: 'Name and at least one source are required' },
      { status: 400 },
    )
  }

  const slug = slugify(name)
  if (!slug) {
    return NextResponse.json(
      { error: 'Name must contain at least one alphanumeric character' },
      { status: 400 },
    )
  }

  try {
    const workspace = createWorkspace(name, slug, sources)
    return NextResponse.json(workspace, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes('UNIQUE')
        ? 'A workspace with that name already exists'
        : 'Failed to create workspace'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
