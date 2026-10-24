import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Shared finalize logic for /api/auth/finalize-teacher and /api/auth/finalize-student.
 *
 * Intent is passed via the route PATH (not query params) because NextAuth v4
 * strips query params from callbackUrl before redirecting.
 */
export async function GET(request: NextRequest, intent: 'teacher' | 'student') {
  const dest    = intent === 'teacher' ? '/teacher/dashboard' : '/dashboard'
  const baseUrl = request.nextUrl.origin

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, baseUrl))

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return redirectTo('/login')

    const email = session.user.email
    const name  = session.user.name ?? email.split('@')[0]
    const image = session.user.image ?? null

    if (intent === 'teacher') {
      // Switch to teacher: remove any student record for this email
      await prisma.student.deleteMany({ where: { email } })

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
      // Switch to student: remove any teacher record for this email
      await prisma.teacher.deleteMany({ where: { email } })

      const existing = await prisma.student.findUnique({ where: { email } })
      if (!existing) {
        await prisma.student.create({
          data: { email, name, studentId: `STU-${Date.now()}`, profilePicture: image },
        })
      } else if (!existing.profilePicture && image) {
        await prisma.student.update({ where: { id: existing.id }, data: { profilePicture: image } })
      }
    }

    // Clear the session cookie so NextAuth re-issues a fresh JWT that reads
    // the correct role from the DB record we just created/switched.
    const res = NextResponse.redirect(new URL(dest, baseUrl))
    const secure = process.env.NEXTAUTH_URL?.startsWith('https') ?? true
    const cookieName = secure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'
    res.cookies.set(cookieName, '', {
      path: '/', maxAge: 0, secure, httpOnly: true, sameSite: 'lax',
    })
    return res

  } catch (error) {
    console.error('finalize error:', error)
    return redirectTo('/login?error=DatabaseError')
  }
}
