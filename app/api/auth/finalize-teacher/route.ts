import { NextRequest, NextResponse } from 'next/server'
import { GET as finalizeHandler } from '../finalize-core'

// /api/auth/finalize-teacher — intent is in the PATH, not query params
// NextAuth preserves the full path as callbackUrl; only query params get stripped.
export async function GET(request: NextRequest) {
  return finalizeHandler(request, 'teacher')
}
