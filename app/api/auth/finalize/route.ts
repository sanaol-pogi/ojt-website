import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/finalize?intent=teacher|student&next=/...
 *
 * Called after Google OAuth completes (used as NextAuth callbackUrl).
 * Creates the correct DB record based on which tab the user signed in from.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const intent = searchParams.get('intent') === 'teacher' ? 'teacher' : 'student'
  const next   = searchParams.get('next') ?? (intent === 'teacher' ? '/teacher/dashboard' : '/dashboard')

  const baseUrl    = request.nextUrl.origin
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, baseUrl))

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return redirectTo('/login')

    const email = session.user.email
    const name  = session.user.name ?? email.split('@')[0]
    const image = session.user.image ?? null

    if (intent === 'teacher') {
      // Block if already a student
      const existingStudent = await prisma.student.findUnique({ where: { email }, select: { id: true } })
      if (existingStudent) return redirectTo('/login?error=AlreadyStudent')

      // Upsert teacher record
      const existing = await prisma.teacher.findUnique({ where: { email } })
      if (!existing) {
        await prisma.teacher.create({
          data: {
            email, name,
            teacherId:      `TCH-${Date.now()}`,
            role:           'teacher',
            accessLevel:    'teacher',
            profilePicture: image,
          },
        })
      } else if (!existing.profilePicture && image) {
        await prisma.teacher.update({ where: { id: existing.id }, data: { profilePicture: image } })
      }
    } else {
      // Block if already a teacher
      const existingTeacher = await prisma.teacher.findUnique({ where: { email }, select: { id: true } })
      if (existingTeacher) return redirectTo('/login?error=AlreadyTeacher')

      // Upsert student record
      const existing = await prisma.student.findUnique({ where: { email } })
      if (!existing) {
        await prisma.student.create({
          data: { email, name, studentId: `STU-${Date.now()}`, profilePicture: image },
        })
      } else if (!existing.profilePicture && image) {
        await prisma.student.update({ where: { id: existing.id }, data: { profilePicture: image } })
      }
    }

    return redirectTo(next)
  } catch (error) {
    console.error('finalize error:', error)
    return redirectTo('/login?error=DatabaseError')
  }
}
