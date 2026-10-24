import { NextRequest } from 'next/server'
import { GET as finalizeHandler } from '../finalize-core'

// /api/auth/finalize-student — intent is in the PATH, not query params
export async function GET(request: NextRequest) {
  return finalizeHandler(request, 'student')
}
