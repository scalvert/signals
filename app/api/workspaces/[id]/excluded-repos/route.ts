import { NextResponse } from 'next/server'
import { updateWorkspaceExcludedRepos } from '@/lib/db/queries'
import { accessErrorResponse, requireWorkspaceRole } from '@/lib/auth/access'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await requireWorkspaceRole(Number(id), ['owner'])
    const { excludedRepos } = await request.json()

    if (!Array.isArray(excludedRepos)) {
      return NextResponse.json(
        { error: 'excludedRepos must be an array of repo fullName strings' },
        { status: 400 },
      )
    }

    updateWorkspaceExcludedRepos(Number(id), excludedRepos)
    return NextResponse.json({ success: true })
  } catch (error) {
    return accessErrorResponse(error)
  }
}
