import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Shared finalize logic for /api/auth/finalize-teacher and /api/auth/finalize-student.
 *
 * Intent is in the route PATH (not query params) — NextAuth v4 strips query params
 * from callbackUrl but always preserves the full path.
 *
 * After updating the DB record, we redirect to a small client-side page that calls
 * NextAuth's update() to refresh the JWT with the new role, then navigates to the
 * correct dashboard. This avoids clearing the session cookie (which would log the
 * user out) while still getting a fresh JWT.
 */
export async function GET(request: NextRequest, intent: 'teacher' | 'student') {
  const dest    = intent === 'teacher' ? '/teacher/dashboard' : '/dashboard'
  const baseUrl = request.nextUrl.origin

  console.log(`[finalize] intent=${intent} url=${request.url}`)

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, baseUrl))

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return redirectTo('/login')

    const email = session.user.email
    const name  = session.user.name ?? email.split('@')[0]
    const image = session.user.image ?? null

    if (intent === 'teacher') {
      await prisma.student.deleteMany({ where: { email } })
      console.log(`[finalize] deleted student records for ${email}`)

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
        console.log(`[finalize] created teacher record for ${email}`)
      } else {
        console.log(`[finalize] teacher record already exists for ${email}`)
        if (!existing.profilePicture && image) {
          await prisma.teacher.update({ where: { id: existing.id }, data: { profilePicture: image } })
        }
      }
    } else {
      await prisma.teacher.deleteMany({ where: { email } })
      console.log(`[finalize] deleted teacher records for ${email}`)

      const existing = await prisma.student.findUnique({ where: { email } })
      if (!existing) {
        await prisma.student.create({
          data: { email, name, studentId: `STU-${Date.now()}`, profilePicture: image },
        })
        console.log(`[finalize] created student record for ${email}`)
      } else {
        console.log(`[finalize] student record already exists for ${email}`)
        if (!existing.profilePicture && image) {
          await prisma.student.update({ where: { id: existing.id }, data: { profilePicture: image } })
        }
      }
    }

    // Redirect to a tiny refresh page that triggers a server-side session update,
    // then forwards to the correct dashboard. The `dest` is passed as a query param
    // on this internal redirect only (not through NextAuth).
    return redirectTo(`/auth-refresh?dest=${encodeURIComponent(dest)}`)

  } catch (error) {
    console.error('finalize error:', error)
    return redirectTo('/login?error=DatabaseError')
  }
}
