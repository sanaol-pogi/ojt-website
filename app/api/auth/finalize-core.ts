import { NextRequest, NextResponse } from 'next/server'

/**
 * The signIn callback in auth.ts now handles all DB record creation/switching
 * by reading account.state.callbackUrl to detect the intent.
 *
 * These finalize routes exist purely so the intent is encoded in the PATH
 * (NextAuth strips query params from callbackUrl, but preserves the full path).
 *
 * They simply redirect to the correct dashboard.
 */
export async function GET(request: NextRequest, intent: 'teacher' | 'student') {
  const dest    = intent === 'teacher' ? '/teacher/dashboard' : '/dashboard'
  const baseUrl = request.nextUrl.origin
  console.log(`[finalize-core] intent=${intent} → ${dest}`)
  return NextResponse.redirect(new URL(dest, baseUrl))
}
