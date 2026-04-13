import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import { slugify } from '@/lib/utils'
import type { WorkspaceSource } from '@/types/workspace'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { name, sources } = (await request.json()) as {
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

  try {
    db.update(workspaces)
      .set({
        name,
        slug,
        sources: JSON.stringify(sources),
      })
      .where(eq(workspaces.id, Number(id)))
      .run()

    return NextResponse.json({ id: Number(id), name, slug, sources })
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes('UNIQUE')
        ? 'A workspace with that name already exists'
        : 'Failed to update workspace'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
