import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/teacher/my-section
 * Returns the section this teacher is assigned to + its students + pending narratives
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await prisma.teacher.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

    // Get the section this teacher is assigned to
    const section = await prisma.section.findFirst({
      where: { teacherId: teacher.id },
      include: {
        strand: { select: { id: true, name: true } },
        students: {
          select: {
            id: true, studentId: true, name: true, email: true,
            profilePicture: true,
            narratives: {
              select: { id: true, status: true, submissionDate: true, isDraft: true, date: true },
              orderBy: { submissionDate: 'desc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!section) return NextResponse.json({ section: null })

    // Pending narratives for this section's students
    const studentIds = section.students.map(s => s.id)
    const pendingNarratives = await prisma.narrative.findMany({
      where: { studentId: { in: studentIds }, status: 'pending', isDraft: false },
      include: {
        student: { select: { id: true, name: true, studentId: true, email: true } },
        photos:  { select: { url: true, isVerified: true }, take: 1 },
      },
      orderBy: { submissionDate: 'desc' },
    }).catch(() => [])

    // Announcements posted to this section
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { targetType: 'all' },
          { targetType: 'section',  sectionId: section.id },
          { targetType: 'strand',   strandId:  section.strandId },
        ],
      },
      include: { teacher: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => [])

    // Checklists for this section
    const checklists = await prisma.checklist.findMany({
      where: {
        OR: [
          { targetType: 'all' },
          { targetType: 'section',  sectionId: section.id },
          { targetType: 'strand',   strandId:  section.strandId },
        ],
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    }).catch(() => [])

    return NextResponse.json({
      section: {
        ...section,
        studentCount:   section.students.length,
        pendingCount:   pendingNarratives.length,
      },
      pendingNarratives,
      announcements,
      checklists,
    })
  } catch (error) {
    console.error('my-section error:', error)
    return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 })
  }
}
