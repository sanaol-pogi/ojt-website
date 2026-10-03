import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/teacher/sections/assign
 * Teacher assigns themselves to a section.
 * Body: { sectionId: string | null }  — null to unassign
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await prisma.teacher.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    const { sectionId } = await req.json() as { sectionId: string | null }

    // Unassign from all current sections first
    await prisma.section.updateMany({
      where: { teacherId: teacher.id },
      data:  { teacherId: null },
    })

    if (sectionId) {
      // Verify section exists
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        include: { strand: { select: { name: true } } },
      })
      if (!section) {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 })
      }

      // Assign teacher to this section
      await prisma.section.update({
        where: { id: sectionId },
        data:  { teacherId: teacher.id },
      })

      return NextResponse.json({
        success: true,
        section: {
          id:        section.id,
          name:      section.name,
          strandName: section.strand.name,
        },
      })
    }

    return NextResponse.json({ success: true, section: null })
  } catch (error) {
    console.error('Assign section error:', error)
    return NextResponse.json({ error: 'Failed to assign section' }, { status: 500 })
  }
}
