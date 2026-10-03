import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/** Find or auto-create Teacher record */
async function ensureTeacher(email: string, name?: string | null, image?: string | null) {
  const existing = await prisma.teacher.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.teacher.create({
    data: {
      email,
      name:           name ?? email.split('@')[0],
      teacherId:      `TCH-${Date.now()}`,
      role:           'teacher',
      accessLevel:    'teacher',
      profilePicture: image ?? null,
    },
  })
}

/** Safely try a Prisma call; returns null on error (schema mismatch fallback) */
async function tryQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn() } catch { return null }
}

/* ─── GET ─────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    // Check if teacher record exists (don't auto-create on GET — only reads)
    const isTeacher = !!(await tryQuery(() =>
      prisma.teacher.findUnique({ where: { email: session.user.email! }, select: { id: true } })
    ))

    if (isTeacher) {
      const whereWithActive: Record<string, unknown> = { isActive: true }
      if (type) whereWithActive.type = type
      const whereBasic: Record<string, unknown> = {}
      if (type) whereBasic.type = type

      let announcements = await tryQuery(() =>
        prisma.announcement.findMany({
          where: whereWithActive,
          include: {
            teacher: { select: { name: true, email: true } },
            strand:  { select: { name: true } },
            section: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      )
      if (!announcements) {
        announcements = await tryQuery(() =>
          prisma.announcement.findMany({
            where: whereBasic,
            include: {
              teacher: { select: { name: true, email: true } },
              strand:  { select: { name: true } },
              section: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        )
      }
      return NextResponse.json({ announcements: announcements ?? [] })
    }

    // ── Student ────────────────────────────────────────────
    const student = await prisma.student.findUnique({
      where: { email: session.user.email },
      select: { strandId: true, sectionId: true },
    })
    if (!student) return NextResponse.json({ announcements: [] })

    const studentWhere = {
      OR: [
        { targetType: 'all' },
        { targetType: 'strand',         strandId:  student.strandId  },
        { targetType: 'section',        sectionId: student.sectionId },
        { targetType: 'strand_section', strandId:  student.strandId, sectionId: student.sectionId },
      ],
      ...(type ? { type } : {}),
    }

    let announcements = await tryQuery(() =>
      prisma.announcement.findMany({
        where: { isActive: true, ...studentWhere },
        include: {
          teacher: { select: { name: true, email: true } },
          strand:  { select: { name: true } },
          section: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    )
    if (!announcements) {
      announcements = await tryQuery(() =>
        prisma.announcement.findMany({
          where: studentWhere,
          include: {
            teacher: { select: { name: true, email: true } },
            strand:  { select: { name: true } },
            section: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      )
    }
    return NextResponse.json({ announcements: announcements ?? [] })
  } catch (error) {
    console.error('GET announcements error:', error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}

/* ─── POST ────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only teachers can post announcements — check DB directly
    const teacher = await prisma.teacher.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })
    if (!teacher) {
      return NextResponse.json({
        error: 'Only teachers can post announcements.',
      }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, type = 'reminder', targetType = 'all', strandId, sectionId, expiresAt } = body

    if (!title?.trim())   return NextResponse.json({ error: 'Title is required' },   { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    // Attempt 1: full create with all columns
    let announcement = await tryQuery(() =>
      prisma.announcement.create({
        data: {
          title:     title.trim(),
          content:   content.trim(),
          type,
          targetType,
          strandId:  strandId  || null,
          sectionId: sectionId || null,
          teacherId: teacher.id,
          isActive:  true,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        include: {
          teacher: { select: { name: true, email: true } },
          strand:  { select: { name: true } },
          section: { select: { name: true } },
        },
      })
    )

    // Attempt 2: minimal create (no optional columns — pre-migration DB)
    if (!announcement) {
      console.warn('Full announcement create failed — trying minimal')
      announcement = await tryQuery(() =>
        prisma.announcement.create({
          data: {
            title:     title.trim(),
            content:   content.trim(),
            type,
            targetType,
            teacherId: teacher.id,
          },
          include: {
            teacher: { select: { name: true, email: true } },
            strand:  { select: { name: true } },
            section: { select: { name: true } },
          },
        })
      )
    }

    if (!announcement) {
      return NextResponse.json({
        error: 'Failed to create announcement. Please run RUN_THIS_IN_SUPABASE.sql in your Supabase SQL editor first.',
      }, { status: 500 })
    }

    await prisma.auditLog.create({
      data: {
        userId: teacher.id, userType: 'teacher', action: 'announcement_created',
        description: `Created announcement: ${title}`,
        metadata: JSON.stringify({ announcementId: announcement.id, targetType, type }),
      },
    }).catch(() => {})

    // ── Create notifications for all targeted students ──────
    try {
      // Find all students that match the target
      const studentWhere: Record<string, unknown> = {}
      if (targetType === 'strand'         && strandId)               studentWhere.strandId  = strandId
      if (targetType === 'section'        && sectionId)              studentWhere.sectionId = sectionId
      if (targetType === 'strand_section' && strandId && sectionId) {
        studentWhere.strandId  = strandId
        studentWhere.sectionId = sectionId
      }
      // 'all' → no filter, notify everyone

      const students = await prisma.student.findMany({
        where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
        select: { id: true },
        take: 500, // Safety cap — prevent enormous createMany on very large schools
      })

      if (students.length > 0) {
        // Process in batches of 100 to avoid DB timeout
        const BATCH = 100
        for (let i = 0; i < students.length; i += BATCH) {
          const batch = students.slice(i, i + BATCH)
          await prisma.notification.createMany({
            data: batch.map(s => ({
              userId:    s.id,
              userType:  'student',
              type:      'announcement',
              title:     `📢 ${title.trim().slice(0, 100)}`,
              message:   content.trim().slice(0, 160),
              isRead:    false,
              link:      '/announcements',
            })),
            skipDuplicates: true,
          })
        }
      }
    } catch (notifErr) {
      // Non-fatal — announcement still created even if notifications fail
      console.warn('Notification creation failed (non-fatal):', notifErr)
    }

    return NextResponse.json({ success: true, announcement })
  } catch (error) {
    console.error('POST announcement error:', error)
    const detail = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create announcement', detail }, { status: 500 })
  }
}

/* ─── DELETE ──────────────────────────────────────────────── */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await prisma.teacher.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!teacher) return NextResponse.json({ error: 'Forbidden — not a teacher account' }, { status: 403 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    // SECURITY: verify this announcement belongs to the requesting teacher
    const announcement = await prisma.announcement.findUnique({
      where: { id }, select: { teacherId: true },
    })
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }
    if (announcement.teacherId !== teacher.id) {
      return NextResponse.json({ error: 'Forbidden — you can only delete your own announcements' }, { status: 403 })
    }

    // Try soft-delete first (isActive=false), fall back to hard delete
    const softDeleted = await tryQuery(() =>
      prisma.announcement.update({ where: { id }, data: { isActive: false } })
    )
    if (!softDeleted) {
      await prisma.announcement.delete({ where: { id } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE announcement error:', error)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
