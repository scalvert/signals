import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import type { WorkspaceSource } from '@/types/workspace'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { source } = (await request.json()) as { source: WorkspaceSource }

  if (!source?.type || !source?.value) {
    return NextResponse.json(
      { error: 'source with type and value is required' },
      { status: 400 },
    )
  }

  const row = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, Number(id)))
    .get()

  if (!row) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const sources: WorkspaceSource[] = JSON.parse(row.sources)
  const exists = sources.some(
    (s) => s.type === source.type && s.value === source.value,
  )

  if (exists) {
    return NextResponse.json(
      { error: `${source.type} "${source.value}" is already in this workspace` },
      { status: 409 },
    )
  }

  sources.push(source)
  db.update(workspaces)
    .set({ sources: JSON.stringify(sources) })
    .where(eq(workspaces.id, Number(id)))
    .run()

  return NextResponse.json({ success: true, sources })
}
