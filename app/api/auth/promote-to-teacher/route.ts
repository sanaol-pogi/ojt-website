import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/promote-to-teacher
 * SECURITY: Only callable when the session user already has a Teacher record
 * (i.e. they signed in via the Teacher tab through /api/auth/finalize?intent=teacher).
 * Students cannot call this — we verify against the DB, not the JWT role.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email = session.user.email

    // SECURITY: Verify the caller already has a Teacher record in DB.
    // Do NOT create one just because they called this endpoint.
    const existing = await prisma.teacher.findUnique({
      where: { email },
      select: { id: true, teacherId: true },
    })

    if (!existing) {
      // They are NOT a teacher — block the request.
      // Students must sign in via Teacher tab to get a Teacher record.
      return NextResponse.json(
        { error: 'Access denied. Sign in via the Teacher tab to become a teacher.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, teacherId: existing.id })
  } catch (error) {
    console.error('Promote to teacher error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
