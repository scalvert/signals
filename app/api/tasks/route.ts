import { NextResponse } from 'next/server'
import { createTask, getTasks } from '@/lib/db/queries'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = Number(url.searchParams.get('workspaceId'))
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const status = url.searchParams.get('status') as 'pending' | 'dispatched' | 'completed' | 'verified' | 'failed' | null
  const repo = url.searchParams.get('repo') ?? undefined
  const tasks = getTasks(workspaceId, { status: status ?? undefined, repoFullName: repo })
  return NextResponse.json({ tasks })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, repoFullName, title, description, sourceType, sourceId } = body as {
    workspaceId: number
    repoFullName: string
    title: string
    description: string
    sourceType: 'signal' | 'check'
    sourceId: string
  }

  if (!workspaceId || !repoFullName || !title || !description || !sourceType || !sourceId) {
    return NextResponse.json(
      { error: 'workspaceId, repoFullName, title, description, sourceType, and sourceId are required' },
      { status: 400 },
    )
  }

  const task = createTask({ workspaceId, repoFullName, title, description, sourceType, sourceId })
  return NextResponse.json({ task })
}
