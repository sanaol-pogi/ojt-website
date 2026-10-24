import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/finalize?intent=teacher|student&next=/...
 *
 * Called after Google OAuth completes.
 * - intent=student: ensures Student record exists, REMOVES Teacher record
 *   (so JWT gives role=student and the student sees the student dashboard)
 * - intent=teacher: ensures Teacher record exists
 *
 * This separation means one Gmail can be either a student OR a teacher,
 * switching roles cleanly by signing in on the correct tab.
 *
 * Intent resolution order (most reliable → fallback):
 *   1. `login_intent` cookie set by the login page before OAuth starts
 *   2. `intent` query param in the callbackUrl (may be stripped by NextAuth)
 */
export async function GET(request: NextRequest) {
  // Read the httpOnly cookie set by POST /api/auth/set-intent just before OAuth started.
  // This is the most reliable way to carry intent through the OAuth round-trip because:
  //   - It's set server-side (httpOnly, SameSite=lax) before the redirect to Google
  //   - Google redirects back to the same origin, so the browser sends the cookie
  //   - NextAuth preserves all same-origin cookies through its callback redirect
  // The cookie name matches what /api/auth/set-intent writes: 'signin_intent'
  const cookieIntent = request.cookies.get('signin_intent')?.value

  // Fall back to query param (legacy, may be stripped by NextAuth), then default student
  const paramIntent = new URL(request.url).searchParams.get('intent')
  const intent = (cookieIntent === 'teacher' || cookieIntent === 'student')
    ? cookieIntent
    : (paramIntent === 'teacher' ? 'teacher' : 'student')

  const next = intent === 'teacher' ? '/teacher/dashboard' : '/dashboard'

  const baseUrl    = request.nextUrl.origin
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, baseUrl))
    // Clear the intent cookie — it's single-use
    res.cookies.set('signin_intent', '', { path: '/', maxAge: 0 })
    return res
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return redirectTo('/login')

    const email = session.user.email
    const name  = session.user.name ?? email.split('@')[0]
    const image = session.user.image ?? null 
    if (intent === 'teacher') {
      // ── TEACHER sign-in ───────────────────────────────────
      // GUARD: if this email already has a Student record, block teacher login
      const existingStudent = await prisma.student.findUnique({ where: { email }, select: { id: true, name: true } })
      if (existingStudent) {
        // Sign them out and redirect to login with a clear error message
        return redirectTo('/login?error=AlreadyStudent')
      }

      // Ensure Teacher record exists
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

      // CRITICAL: Remove Student record so this account doesn't appear in the Students tab
      // Without this, a teacher who previously signed in as a student still shows up as a student
      const studentRecord = await prisma.student.findUnique({ where: { email } })
      if (studentRecord) {
        // Use $transaction so cleanup is atomic — no orphaned records on partial failure
        await prisma.$transaction([
          prisma.studentChecklistProgress.deleteMany({ where: { studentId: studentRecord.id } }),
          prisma.narrative.deleteMany({ where: { studentId: studentRecord.id } }),
          prisma.notification.deleteMany({ where: { userId: studentRecord.id, userType: 'student' } }),
          prisma.student.delete({ where: { id: studentRecord.id } }),
        ]).catch((err) => {
          console.error('Teacher finalize: student cleanup transaction failed', err)
          // Non-fatal — teacher record was already created, continue
        })
      }
    } else {
      // ── STUDENT sign-in ───────────────────────────────────
      // GUARD: if this email already has a Teacher record, block student login
      const existingTeacher = await prisma.teacher.findUnique({ where: { email }, select: { id: true, name: true } })
      if (existingTeacher) {
        return redirectTo('/login?error=AlreadyTeacher')
      }

      // Ensure Student record exists
      const existing = await prisma.student.findUnique({ where: { email } })
      if (!existing) {
        await prisma.student.create({
          data: { email, name, studentId: `STU-${Date.now()}`, profilePicture: image },
        })
      } else if (!existing.profilePicture && image) {
        await prisma.student.update({ where: { id: existing.id }, data: { profilePicture: image } })
      }

      // CRITICAL: Remove Teacher record so the JWT sets role=student
      // Without this, having both records means JWT always picks "teacher"
      const teacherRecord = await prisma.teacher.findUnique({ where: { email } })
      if (teacherRecord) {
        // Use $transaction so cleanup is atomic — no orphaned records on partial failure
        await prisma.$transaction([
          prisma.student.updateMany({ where: { supervisorId: teacherRecord.id }, data: { supervisorId: null } }),
          prisma.section.updateMany({ where: { teacherId: teacherRecord.id }, data: { teacherId: null } }),
          prisma.narrativeReview.deleteMany({ where: { teacherId: teacherRecord.id } }),
          prisma.notification.deleteMany({ where: { userId: teacherRecord.id, userType: 'teacher' } }),
          prisma.announcement.updateMany({ where: { teacherId: teacherRecord.id }, data: { isActive: false } }),
          prisma.teacher.delete({ where: { id: teacherRecord.id } }),
        ]).catch((err) => {
          console.error('Student finalize: teacher cleanup transaction failed', err)
          // Non-fatal — student record was already created, continue
        })
      }
    }

    return redirectTo(next)
  } catch (error) {
    console.error('finalize error:', error)
    // Instead of silently redirecting (which can loop), show a proper error
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    // If it's a DB connection error, redirect to login with error param
    if (errMsg.includes('connect') || errMsg.includes('prisma') || errMsg.includes('database')) {
      return redirectTo('/login?error=DatabaseError')
    }
    return redirectTo(next)
  }
}
