import { NextResponse } from 'next/server'
import { updateWorkspaceExcludedRepos } from '@/lib/db/queries'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { excludedRepos } = await request.json()

  if (!Array.isArray(excludedRepos)) {
    return NextResponse.json(
      { error: 'excludedRepos must be an array of repo fullName strings' },
      { status: 400 },
    )
  }

  updateWorkspaceExcludedRepos(Number(id), excludedRepos)
  return NextResponse.json({ success: true })
}
