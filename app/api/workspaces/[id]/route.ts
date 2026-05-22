import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import { AccessError, accessErrorResponse, requireWorkspaceRole } from '@/lib/auth/access'
import { canUserAccessInstallation } from '@/lib/github/installations'
import { slugify } from '@/lib/utils'
import type { WorkspaceSource } from '@/types/workspace'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const workspaceId = Number(id)
    const access = await requireWorkspaceRole(workspaceId, ['owner'])
    const { name, sources, githubInstallationId } = (await request.json()) as {
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
      access.githubLogin,
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

    db.update(workspaces)
      .set({
        name,
        slug,
        sources: JSON.stringify(sources),
        githubInstallationId,
      })
      .where(eq(workspaces.id, workspaceId))
      .run()

    return NextResponse.json({ id: workspaceId, name, slug, sources, githubInstallationId })
  } catch (err) {
    if (err instanceof AccessError) return accessErrorResponse(err)
    const message =
      err instanceof Error && err.message.includes('UNIQUE')
        ? 'A workspace with that name already exists'
        : 'Failed to update workspace'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
