import { getAuth } from '@/lib/auth/config'

const { handlers } = getAuth()
export const { GET, POST } = handlers
