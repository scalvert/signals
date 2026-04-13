import { NextResponse } from 'next/server'
import { getRepoContext, upsertRepoContext } from '@/lib/db/queries'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = Number(url.searchParams.get('workspaceId'))
  const repo = url.searchParams.get('repo')

  if (isNaN(workspaceId) || !repo) {
    return NextResponse.json(
      { error: 'workspaceId and repo are required' },
      { status: 400 },
    )
  }

  const context = getRepoContext(workspaceId, repo)
  return NextResponse.json({ context: context ?? null })
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { workspaceId, repoFullName, context } = body as {
    workspaceId: number
    repoFullName: string
    context: string
  }

  if (!workspaceId || !repoFullName || typeof context !== 'string') {
    return NextResponse.json(
      { error: 'workspaceId, repoFullName, and context are required' },
      { status: 400 },
    )
  }

  upsertRepoContext(workspaceId, repoFullName, context)
  return NextResponse.json({ success: true })
}
