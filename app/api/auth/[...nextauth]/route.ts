import { getAuth } from '@/lib/auth/config'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { handlers } = getAuth()
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  const { handlers } = getAuth()
  return handlers.POST(req)
}
