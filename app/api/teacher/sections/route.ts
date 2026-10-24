import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run all queries in parallel — no sequential awaits
    const [allStudents, sections, pendingNarratives] = await Promise.all([
      // Fetch ALL students — no email exclusion filter.
      // The signIn callback now guarantees that a single email can only exist
      // in either the Student table OR the Teacher table, never both.
      // Filtering by teacher emails was hiding students who had a dual-role
      // due to previous bugs; that exclusion is no longer needed.
      prisma.student.findMany({
        select: {
          id: true, studentId: true, name: true, email: true,
          profilePicture: true, gradeLevel: true, sectionId: true,
          section: { select: { name: true } },
          strand:  { select: { name: true } },
          narratives: {
            select: { id: true, status: true, submissionDate: true, isDraft: true },
            orderBy: { submissionDate: 'desc' },
            take: 5,
          },
        },
        orderBy: { name: 'asc' },
      }),

      prisma.section.findMany({
        include: {
          strand:  { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true, email: true } },
          students: {
            select: {
              id: true, studentId: true, name: true, email: true,
              profilePicture: true, gradeLevel: true, sectionId: true,
              section: { select: { name: true } },
              strand:  { select: { name: true } },
              narratives: {
                select: { id: true, status: true, submissionDate: true, isDraft: true },
                orderBy: { submissionDate: 'desc' },
                take: 5,
              },
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: [{ strand: { name: 'asc' } }, { name: 'asc' }],
      }),

      prisma.narrative.count({
        where: { status: 'pending', isDraft: false },
      }).catch(() => 0),
    ])

    // Virtual "Unassigned" section for students with no section
    const unassigned = allStudents.filter(s => !s.sectionId)
    const allSections = [
      ...sections,
      ...(unassigned.length > 0 ? [{
        id: 'unassigned', name: 'Unassigned', gradeLevel: 0,
        strandId: null, teacherId: null, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
        strand: { id: 'none', name: 'No Strand' },
        teacher: null,
        students: unassigned,
      }] : []),
    ]

    return NextResponse.json({
      sections:    allSections,
      allStudents,
      stats: {
        totalStudents:    allStudents.length,
        totalSections:    sections.length,
        pendingNarratives,
      },
    })
  } catch (error) {
    console.error('Error fetching teacher sections:', error)
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
  }
}
