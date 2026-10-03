import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/teacher/my-section
 * Returns the section this teacher is assigned to + students + pending narratives
 * All queries run in parallel for speed.
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

    // Get assigned section first (lightweight query)
    const section = await prisma.section.findFirst({
      where: { teacherId: teacher.id },
      select: {
        id: true, name: true, gradeLevel: true, strandId: true,
        strand: { select: { id: true, name: true } },
        students: {
          select: {
            id: true, studentId: true, name: true, email: true,
            profilePicture: true,
            narratives: {
              select: { id: true, status: true, isDraft: true, date: true, submissionDate: true },
              orderBy: { submissionDate: 'desc' },
              take: 20, // limit for speed
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!section) return NextResponse.json({ section: null })

    const studentIds = section.students.map(s => s.id)

    // Run remaining queries in parallel
    const [pendingNarratives, announcements, checklists] = await Promise.all([
      prisma.narrative.findMany({
        where: { studentId: { in: studentIds }, status: 'pending', isDraft: false },
        select: {
          id: true, status: true, date: true, submissionDate: true,
          student: { select: { id: true, name: true, studentId: true, email: true } },
          photos:  { select: { url: true, isVerified: true }, where: { isVerified: true }, take: 1 },
        },
        orderBy: { submissionDate: 'desc' },
        take: 50,
      }).catch(() => []),

      prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [
            { targetType: 'all' },
            { targetType: 'section',  sectionId: section.id },
            { targetType: 'strand',   strandId:  section.strandId },
          ],
        },
        select: {
          id: true, title: true, content: true, type: true,
          targetType: true, createdAt: true,
          teacher: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []),

      prisma.checklist.findMany({
        where: {
          OR: [
            { targetType: 'all' },
            { targetType: 'section', sectionId: section.id },
            { targetType: 'strand',  strandId:  section.strandId },
          ],
        },
        select: {
          id: true, name: true, description: true, targetType: true,
          items: { select: { id: true, title: true, requirementType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []),
    ])

    return NextResponse.json({
      section: {
        ...section,
        studentCount: section.students.length,
        pendingCount: pendingNarratives.length,
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
