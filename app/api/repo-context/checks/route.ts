import { NextResponse } from 'next/server'
import { toggleDismissedCheck } from '@/lib/db/queries'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspaceId, repoFullName, checkId } = body as {
    workspaceId: number
    repoFullName: string
    checkId: string
  }

  if (!workspaceId || !repoFullName || !checkId) {
    return NextResponse.json(
      { error: 'workspaceId, repoFullName, and checkId are required' },
      { status: 400 },
    )
  }

  const dismissedChecks = toggleDismissedCheck(workspaceId, repoFullName, checkId)
  return NextResponse.json({ dismissedChecks })
}
