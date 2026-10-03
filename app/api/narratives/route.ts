import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Helper: find student by email regardless of JWT role
async function getStudentByEmail(email: string) {
  return prisma.student.findUnique({ where: { email }, select: { id: true, name: true, supervisorId: true } })
}

// Helper: find teacher by email regardless of JWT role
async function getTeacherByEmail(email: string) {
  return prisma.teacher.findUnique({ where: { email }, select: { id: true } }).catch(() => null)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const wantsStats     = searchParams.get('stats') === 'true'
    const studentIdParam = searchParams.get('studentId')
    const statusParam    = searchParams.get('status')
    const page  = parseInt(searchParams.get('page')  || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // cap at 100
    const skip  = (page - 1) * limit

    const where: Record<string, unknown> = {}

    const student = await getStudentByEmail(session.user.email)
    // Teacher check is INDEPENDENT — someone can have both records (signed in both tabs)
    // Teacher always takes priority for viewing all narratives
    const teacherRecord = await getTeacherByEmail(session.user.email)
    const isTeacher = !!teacherRecord

    if (isTeacher) {
      // Teacher: optionally filter by specific student
      if (studentIdParam) where.studentId = studentIdParam
      // else no filter — teacher sees all
    } else if (student) {
      // Student: always scope to their own narratives
      where.studentId = student.id
    } else {
      // Neither found — could be a new account, return empty safely
      return NextResponse.json({ narratives: [], pagination: { page, limit, total: 0, totalPages: 0 } })
    }

    if (statusParam) where.status = statusParam

    // ── Stats mode ────────────────────────────────────────────
    if (wantsStats) {
      try {
        const now       = new Date()
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const [total, thisWeek, pending] = await Promise.all([
          prisma.narrative.count({ where: { ...where, isDraft: false } }),
          prisma.narrative.count({ where: { ...where, isDraft: false, submissionDate: { gte: weekStart } } }),
          prisma.narrative.count({ where: { ...where, isDraft: false, status: 'pending' } }),
        ])
        return NextResponse.json({ stats: { total, thisWeek, pending } })
      } catch {
        const total = await prisma.narrative.count({ where: { ...where, isDraft: false } }).catch(() => 0)
        return NextResponse.json({ stats: { total, thisWeek: 0, pending: 0 } })
      }
    }

    // ── List mode ─────────────────────────────────────────────
    const [narratives, total] = await Promise.all([
      prisma.narrative.findMany({
        where,
        include: {
          student: { select: { name: true, studentId: true, email: true, company: true } },
          photos:  true,
          reviews: {
            select: {
              id: true, action: true, comment: true,
              teacher: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.narrative.count({ where }),
    ])

    return NextResponse.json({
      narratives,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('GET narratives error:', error)
    return NextResponse.json({ error: 'Failed to fetch narratives' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find student by email (not role — handles stale JWT)
    let student = await getStudentByEmail(session.user.email)

    // Safety net: if no student record exists but this looks like a student,
    // auto-create one so they can submit narratives
    if (!student) {
      // Check if they have a teacher record
      const teacher = await getTeacherByEmail(session.user.email)
      if (teacher) {
        // They signed in as teacher before — create student record too
        try {
          const newStudent = await prisma.student.create({
            data: {
              email:     session.user.email,
              name:      session.user.name ?? session.user.email.split('@')[0],
              studentId: `STU-${Date.now()}`,
              profilePicture: session.user.profilePicture ?? null,
            },
          })
          student = { id: newStudent.id, name: newStudent.name, supervisorId: null }
        } catch {
          // Student with this email may have been created in a race condition
          student = await getStudentByEmail(session.user.email)
        }
      } else {
        // No teacher, no student — auto-create student
        try {
          const newStudent = await prisma.student.create({
            data: {
              email:     session.user.email,
              name:      session.user.name ?? session.user.email.split('@')[0],
              studentId: `STU-${Date.now()}`,
            },
          })
          student = { id: newStudent.id, name: newStudent.name, supervisorId: null }
        } catch {
          student = await getStudentByEmail(session.user.email)
        }
      }
    }

    if (!student) {
      return NextResponse.json({
        error: 'Student account could not be created. Please sign out and sign in again via the Student tab.',
      }, { status: 404 })
    }

    const body = await request.json()
    const { date, content, isDraft, verificationPhotoUrl } = body

    if (!date)    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    const submissionDate = new Date()
    const [year, month, day] = date.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    const sameDay   = submissionDate.toDateString() === localDate.toDateString()
    const verificationStatus = sameDay ? 'on_time' : 'late'

    const h  = submissionDate.getHours()
    const m  = submissionDate.getMinutes()
    const s  = submissionDate.getSeconds()
    const ap = h >= 12 ? 'PM' : 'AM'
    const hh = ((h % 12) || 12).toString().padStart(2, '0')
    const submissionTime = `${hh}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} ${ap}`

    const ua = request.headers.get('user-agent') ?? ''
    const deviceUsed = /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop'

    let narrative
    try {
      narrative = await prisma.narrative.create({
        data: {
          studentId: student.id,
          date:      new Date(date),
          content,
          isDraft:   isDraft ?? false,
          status:    'pending',
          verificationStatus,
          submissionDate,
          submissionTime,
          timezone:  'Asia/Manila',
          deviceUsed,
          ...(verificationPhotoUrl && !isDraft ? {
            photos: { create: [{ url: verificationPhotoUrl, filename: `verification-${Date.now()}.jpg`, isVerified: true }] },
          } : {}),
        },
        include: { photos: true },
      })
    } catch (createError) {
      console.error('Full create failed, trying minimal:', createError)
      narrative = await prisma.narrative.create({
        data: { studentId: student.id, date: new Date(date), content, isDraft: isDraft ?? false, submissionTime },
        include: { photos: true },
      })
    }

    await prisma.auditLog.create({
      data: { userId: student.id, userType: 'student', action: isDraft ? 'draft_saved' : 'narrative_submitted',
        description: `Narrative ${isDraft ? 'draft' : 'submitted'} for ${date}`,
        metadata: JSON.stringify({ narrativeId: narrative.id }) },
    }).catch(() => {})

    if (!isDraft && student.supervisorId) {
      await prisma.notification.create({
        data: { userId: student.supervisorId, userType: 'teacher', type: 'new_submission',
          title: 'New Narrative Submitted', message: `${student.name} submitted a narrative`,
          link: `/teacher/narratives/${narrative.id}` },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, narrative })
  } catch (error) {
    console.error('POST narrative error:', error)
    return NextResponse.json({ error: 'Failed to create narrative', detail: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
