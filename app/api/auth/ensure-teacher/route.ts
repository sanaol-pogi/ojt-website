import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/ensure-teacher
 *
 * Called by the teacher dashboard on load to guarantee the Teacher DB record
 * exists. This is a fallback for cases where the signIn callback fails silently
 * (e.g. DB connection issues at the time of OAuth).
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email = session.user.email
    const name  = session.user.name ?? email.split('@')[0]
    const image = (session.user as { image?: string }).image ?? null

    // Remove any student record for this email
    await prisma.student.deleteMany({ where: { email } })

    // Upsert teacher record
    const teacher = await prisma.teacher.upsert({
      where:  { email },
      update: {},
      create: {
        email, name,
        teacherId:      `TCH-${Date.now()}`,
        role:           'teacher',
        accessLevel:    'teacher',
        profilePicture: image,
      },
    })

    return NextResponse.json({ ok: true, teacherId: teacher.id })
  } catch (err) {
    console.error('[ensure-teacher] error:', err)
    return NextResponse.json({ error: 'Failed to ensure teacher record' }, { status: 500 })
  }
}
