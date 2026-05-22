import { NextResponse } from 'next/server'
import { createWorkspace, getWorkspacesForUser } from '@/lib/db/queries'
import { AccessError, accessErrorResponse, requireSession } from '@/lib/auth/access'
import { canUserAccessInstallation } from '@/lib/github/installations'
import { slugify } from '@/lib/utils'
import type { WorkspaceSource } from '@/types/workspace'

export async function GET() {
  try {
    const { userId } = await requireSession()
    const workspaces = getWorkspacesForUser(userId)
    return NextResponse.json(workspaces)
  } catch (error) {
    return accessErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const body = await request.json()
    const { name, sources, githubInstallationId } = body as {
      name: string
      sources: WorkspaceSource[]
      githubInstallationId: number
    }

    if (!name || !sources || sources.length === 0 || !githubInstallationId) {
      return NextResponse.json(
        { error: 'Name, GitHub App installation, and at least one source are required' },
        { status: 400 },
      )
    }

    const canAccessInstallation = await canUserAccessInstallation(
      githubInstallationId,
      session.githubLogin,
    )
    if (!canAccessInstallation) {
      return NextResponse.json({ error: 'GitHub App installation access denied' }, { status: 403 })
    }

    const slug = slugify(name)
    if (!slug) {
      return NextResponse.json(
        { error: 'Name must contain at least one alphanumeric character' },
        { status: 400 },
      )
    }

    const workspace = createWorkspace(
      name,
      slug,
      sources,
      session.userId,
      githubInstallationId,
    )
    return NextResponse.json(workspace, { status: 201 })
  } catch (err) {
    if (err instanceof AccessError) {
      return accessErrorResponse(err)
    }
    const message =
      err instanceof Error && err.message.includes('UNIQUE')
        ? 'A workspace with that name already exists'
        : 'Failed to create workspace'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
