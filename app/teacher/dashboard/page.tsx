'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import AppShell from '@/components/AppShell'
import { Button } from '@/components/ui/Button'

/* ─── Types ──────────────────────────────────────────────── */
interface Student {
  id: string; studentId: string; name: string; email: string
  profilePicture?: string | null
  section?: { name: string }
  strand?: { name: string }
  narratives: { id: string; status: string }[]
}
interface Section {
  id: string; name: string
  strand: { id?: string; name: string }
  teacher?: { id: string; name: string; email: string } | null
  students: Student[]
}
interface Teacher {
  id: string; teacherId: string; name: string; email: string
  profilePicture?: string | null
  role: string; accessLevel: string; createdAt: string
  sections: { id: string; name: string }[]
}
interface Announcement {
  id: string; title: string; content: string; type: string
  targetType: string; publishedAt: string
  teacher: { name: string; email: string }
}

/* ─── Avatar ─────────────────────────────────────────────── */
function Ava({ src, name, size = 40, round = false }: {
  src?: string | null; name: string; size?: number; round?: boolean
}) {
  const [err, setErr] = useState(false)
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const radius = round ? '50%' : 10
  const base = {
    width: size, height: size, borderRadius: radius,
    flexShrink: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 700,
    fontSize: Math.round(size * 0.36), color: 'white',
  }
  if (src && !err) return (
    <div style={{ ...base, overflow: 'hidden' }}>
      <Image src={src} alt={name} width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        unoptimized={src.startsWith('data:')} onError={() => setErr(true)} />
    </div>
  )
  return (
    <div style={{ ...base, background: 'linear-gradient(135deg,#F97316,#FB923C)' }}>
      {initials}
    </div>
  )
}

/* ─── Stat Card ──────────────────────────────────────────── */
function StatCard({ label, value, icon, bg }: {
  label: string; value: number; icon: React.ReactNode; bg: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 18, padding: '18px 20px', color: 'white',
      display: 'flex', flexDirection: 'column', gap: 10,
      minWidth: 140, flex: '0 0 auto',
      boxShadow: '0 4px 16px rgba(249,115,22,0.18)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* shine */}
      <div style={{ position:'absolute', top:0, right:0, width:60, height:60,
        background:'radial-gradient(circle at top right,rgba(255,255,255,0.2),transparent 65%)',
        pointerEvents:'none' }}/>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{value}</p>
      </div>
    </div>
  )
}

/* ─── Tab Button ─────────────────────────────────────────── */
function Tab({ label, active, count, onClick, dataTut }: {
  label: string; active: boolean; count?: number; onClick: () => void; dataTut?: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      data-tutorial={dataTut}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700,
        border: active ? 'none' : `1.5px solid ${hov ? '#F97316' : '#FFE4C4'}`,
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.34,1.2,0.64,1)',
        background: active
          ? 'linear-gradient(135deg,#F97316,#FB923C)'
          : hov ? '#FFF3E8' : 'white',
        color: active ? 'white' : hov ? '#F97316' : '#78716C',
        display: 'flex', alignItems: 'center', gap: 6,
        flex: '1 1 auto', whiteSpace: 'nowrap',
        justifyContent: 'center', minWidth: 0,
        boxShadow: active
          ? '0 3px 12px rgba(249,115,22,0.35)'
          : hov ? '0 2px 8px rgba(249,115,22,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
        transform: hov && !active ? 'translateY(-1px)' : 'none',
      }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : hov ? '#F97316' : '#FEE2CC',
          color: active || hov ? 'white' : '#EA580C',
          fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
          minWidth: 20, textAlign: 'center',
          transition: 'all 0.18s ease',
        }}>{count}</span>
      )}
    </button>
  )
}

/* ─── Confirm Modal ──────────────────────────────────────── */
function ConfirmModal({ title, body, confirmLabel = 'Confirm', danger = false,
  onConfirm, onCancel, loading }: {
  title: string; body: React.ReactNode; confirmLabel?: string
  danger?: boolean; onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 32,
        maxWidth: 420, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          width: 56, height: 56, background: danger ? '#FEE2E2' : '#EFF6FF',
          borderRadius: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 20,
        }}>
          <svg style={{ width: 28, height: 28, color: danger ? '#DC2626' : '#3B82F6' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={danger
                ? 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
                : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>{title}</h2>
        <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>{body}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: '#F3F4F6', color: '#374151', border: 'none', cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: danger ? '#DC2626' : '#3B82F6', color: 'white',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────── */
type ActiveTab = 'students' | 'teachers' | 'announcements' | 'narratives' | 'requirements' | 'users' | 'my-section'

interface PendingNarrative {
  id: string; date: string; content: string; status: string
  submissionDate?: string; submissionTime?: string
  student: { id: string; name: string; studentId: string; email: string }
  photos: { url: string; isVerified: boolean }[]
}

interface AllUser {
  id: string; name: string; email: string; role: 'student' | 'teacher'
  profilePicture?: string | null; createdAt: string
  // student-specific
  studentId?: string; narrativeCount?: number
  strandName?: string | null; sectionName?: string | null; supervisorName?: string | null
  // teacher-specific
  teacherId?: string; accessLevel?: string
}

export default function TeacherDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    // Initialize from URL ?tab= param if available
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('tab')
      const valid = ['students','teachers','announcements','narratives','requirements']
      if (param && valid.includes(param)) return param as ActiveTab
    }
    return 'students'
  })

  // Students state
  const [sections,  setSections]  = useState<Section[]>([])
  const [students,  setStudents]  = useState<Student[]>([])
  const [sectionFilter, setSectionFilter] = useState('all')
  const [search,    setSearch]    = useState('')

  // Teachers state
  const [teachers,  setTeachers]  = useState<Teacher[]>([])
  const [teacherSearch, setTeacherSearch] = useState('')

  // All registered users (for Users tab)
  const [allUsers,      setAllUsers]      = useState<{ students: AllUser[]; teachers: AllUser[]; total: { students: number; teachers: number } } | null>(null)
  const [usersLoading,  setUsersLoading]  = useState(false)

  // Narratives state
  const [pendingNarratives, setPendingNarratives] = useState<PendingNarrative[]>([])
  const [reviewingId,       setReviewingId]       = useState<string | null>(null)
  const [reviewComment,     setReviewComment]     = useState('')
  const [reviewSubmitting,  setReviewSubmitting]  = useState(false)

  // Requirements state
  const [reqForm, setReqForm] = useState({
    name: '', description: '', targetType: 'all',
    items: [{ title: '', requirementType: 'general', isRequired: true }],
  })
  const [reqSubmitting,  setReqSubmitting]  = useState(false)
  const [reqSuccess,     setReqSuccess]     = useState('')
  const [reqError,       setReqError]       = useState('')
  const [existingReqs,   setExistingReqs]   = useState<{id:string;name:string;description?:string|null;targetType:string;_count:{progress:number};items:{id:string;title:string}[]}[]>([])
  const [deletingReqId,  setDeletingReqId]  = useState<string|null>(null)

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [annoForm, setAnnoForm] = useState({
    title: '', content: '', type: 'reminder', targetType: 'all',
    strandId: '', sectionId: '',
  })
  const [annoStrands, setAnnoStrands] = useState<{id:string;name:string}[]>([])
  const [annoSections, setAnnoSections] = useState<{id:string;name:string;strandId:string}[]>([])
  const [annoSubmitting, setAnnoSubmitting] = useState(false)
  const [annoError,      setAnnoError]      = useState('')
  const [annoSuccess,    setAnnoSuccess]    = useState('')

  // Delete states
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false)
  const [deletingAccount,      setDeletingAccount]      = useState(false)
  const [deleteStudentTarget,  setDeleteStudentTarget]  = useState<Student | null>(null)
  const [deletingStudent,      setDeletingStudent]      = useState(false)
  const [deleteTeacherTarget,  setDeleteTeacherTarget]  = useState<Teacher | null>(null)
  const [deletingTeacher,      setDeletingTeacher]      = useState(false)

  // Delete teacher from the All Users tab (AllUser type)
  const [deleteAllUserTeacher,    setDeleteAllUserTeacher]    = useState<AllUser | null>(null)
  const [deletingAllUserTeacher,  setDeletingAllUserTeacher]  = useState(false)

  // My Section assignment
  const [mySection,        setMySection]        = useState<{ id: string; name: string; strandName: string } | null>(null)
  const [assigningSection, setAssigningSection] = useState(false)
  const [sectionPickerId,  setSectionPickerId]  = useState('')

  /* ── Load all data ──────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all three in parallel — each error is handled independently
      const [secRes, teachRes, annoRes, narrRes] = await Promise.all([
        fetch('/api/teacher/sections').catch(() => null),
        fetch('/api/teacher/list').catch(() => null),
        fetch('/api/announcements').catch(() => null),
        fetch('/api/narratives?status=pending&limit=50').catch(() => null),
      ])
      if (secRes?.ok) {
        try {
          const d = await secRes.json()
          setSections(d.sections ?? [])
          setStudents((d.allStudents ?? []).sort((a: Student, b: Student) =>
            a.name.localeCompare(b.name)))
        } catch (e) { console.error('sections parse error', e) }
      } else {
        console.warn('sections API status:', secRes?.status)
      }

      if (teachRes?.ok) {
        try {
          const d = await teachRes.json()
          setTeachers(d.teachers ?? [])
        } catch (e) { console.error('teachers parse error', e) }
      } else {
        console.warn('teachers API status:', teachRes?.status)
      }

      if (annoRes?.ok) {
        try {
          const d = await annoRes.json()
          setAnnouncements(d.announcements ?? [])
        } catch (e) { console.error('announcements parse error', e) }
      } else {
        console.warn('announcements API status:', annoRes?.status)
      }

      if (narrRes?.ok) {
        try {
          const d = await narrRes.json()
          setPendingNarratives(d.narratives ?? [])
        } catch (e) { console.error('narratives parse error', e) }
      }

      // Load existing checklists
      const reqRes = await fetch('/api/checklists').catch(() => null)
      if (reqRes?.ok) {
        try {
          const d = await reqRes.json()
          setExistingReqs(d.checklists ?? [])
        } catch { /* silent */ }
      }

      // Load strands + sections for announcement targeting
      const [strandRes, secAnnoRes] = await Promise.all([
        fetch('/api/strands').catch(() => null),
        fetch('/api/sections').catch(() => null),
      ])
      if (strandRes?.ok) {
        try { const d = await strandRes.json(); setAnnoStrands(d.strands ?? []) } catch { /* silent */ }
      }
      if (secAnnoRes?.ok) {
        try { const d = await secAnnoRes.json(); setAnnoSections(d.sections ?? []) } catch { /* silent */ }
      }

      // Load teacher's assigned section
      const mySectionRes = await fetch('/api/teacher/my-section').catch(() => null)
      if (mySectionRes?.ok) {
        try {
          const d = await mySectionRes.json()
          if (d.section) {
            setMySection({ id: d.section.id, name: d.section.name, strandName: d.section.strand?.name ?? '' })
            setSectionPickerId(d.section.id)
          }
        } catch { /* silent */ }
      }
    } catch (e) {
      console.error('loadData error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated') void loadData()
  }, [status, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Filtered students ──────────────────────────────────── */
  const filteredStudents = students
    .filter(s => {
      if (sectionFilter === 'all') return true
      if (sectionFilter === 'Unassigned') return !s.section?.name
      return s.section?.name === sectionFilter
    })
    .filter(s => !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()))

  const filteredTeachers = teachers.filter(t =>
    !teacherSearch.trim() ||
    t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
    t.email.toLowerCase().includes(teacherSearch.toLowerCase()))

  const stats = {
    students:  students.length,
    sections:  sections.filter(s => s.id !== 'unassigned').length,
    pending:   students.reduce((n, s) =>
      n + s.narratives.filter(x => x.status === 'pending').length, 0),
  }

  /* ── Delete own account ─────────────────────────────────── */
  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const res = await fetch('/api/teacher/delete-account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      await signOut({ callbackUrl: '/login', redirect: true })
    } catch {
      setDeletingAccount(false)
      setDeleteAccountConfirm(false)
      alert('Failed to delete account. Please try again.')
    }
  }

  /* ── Delete student ─────────────────────────────────────── */
  const handleDeleteStudent = async () => {
    if (!deleteStudentTarget) return
    setDeletingStudent(true)
    try {
      const res = await fetch(`/api/teacher/students/${deleteStudentTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setStudents(prev => prev.filter(s => s.id !== deleteStudentTarget.id))
      setSections(prev => prev.map(sec => ({
        ...sec, students: sec.students.filter(s => s.id !== deleteStudentTarget.id),
      })))
      setDeleteStudentTarget(null)
    } catch {
      alert('Failed to delete student.')
    } finally {
      setDeletingStudent(false)
    }
  }

  /* ── Delete teacher ─────────────────────────────────────── */
  const handleDeleteTeacher = async () => {
    if (!deleteTeacherTarget) return
    setDeletingTeacher(true)
    try {
      const res = await fetch(`/api/teacher/teachers/${deleteTeacherTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setTeachers(prev => prev.filter(t => t.id !== deleteTeacherTarget.id))
      setDeleteTeacherTarget(null)
    } catch {
      alert('Failed to delete teacher account.')
    } finally {
      setDeletingTeacher(false)
    }
  }

  /* ── Delete teacher from All Users tab ─────────────────── */
  const handleDeleteAllUserTeacher = async () => {
    if (!deleteAllUserTeacher) return
    setDeletingAllUserTeacher(true)
    try {
      const res = await fetch(`/api/teacher/teachers/${deleteAllUserTeacher.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setAllUsers(prev => prev ? {
        ...prev,
        teachers: prev.teachers.filter(t => t.id !== deleteAllUserTeacher.id),
        total: { ...prev.total, teachers: prev.total.teachers - 1 },
      } : prev)
      // Also keep the Teachers tab in sync
      setTeachers(prev => prev.filter(t => t.id !== deleteAllUserTeacher.id))
      setDeleteAllUserTeacher(null)
    } catch {
      alert('Failed to delete teacher account.')
    } finally {
      setDeletingAllUserTeacher(false)
    }
  }

  /* ── Assign teacher to section ─────────────────────────── */
  const handleAssignSection = async () => {
    setAssigningSection(true)
    try {
      const res = await fetch('/api/teacher/sections/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: sectionPickerId || null }),
      })
      const d = await res.json()
      if (res.ok) {
        setMySection(d.section ?? null)
        if (d.section) router.push('/teacher/my-section')
      }
    } catch { /* silent */ }
    finally { setAssigningSection(false) }
  }

  /* ── Review narrative ───────────────────────────────────── */
  const handleReview = async (narrativeId: string, action: 'approved' | 'revision_requested') => {
    setReviewSubmitting(true)
    try {
      const res = await fetch(`/api/narratives/${narrativeId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: reviewComment.trim() || undefined }),
      })
      if (res.ok) {
        // Remove from pending list or update status
        setPendingNarratives(prev => prev.filter(n => n.id !== narrativeId))
        setReviewingId(null)
        setReviewComment('')
      }
    } catch { /* silent */ }
    finally { setReviewSubmitting(false) }
  }

  /* ── Delete requirement checklist ──────────────────────── */
  const handleDeleteReq = async (id: string) => {
    setDeletingReqId(id)
    try {
      const res = await fetch(`/api/checklists/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setExistingReqs(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('Failed to delete checklist.')
    } finally {
      setDeletingReqId(null)
    }
  }

  /* ── Post requirement ──────────────────────────────────── */
  const handlePostRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqError(''); setReqSuccess('')
    if (!reqForm.name.trim()) { setReqError('Checklist name is required.'); return }
    const validItems = reqForm.items.filter(i => i.title.trim())
    if (!validItems.length) { setReqError('At least one item is required.'); return }
    setReqSubmitting(true)
    try {
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       reqForm.name.trim(),
          description: reqForm.description.trim() || undefined,
          targetType: reqForm.targetType,
          items:      validItems,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      // Refresh full list instead of adding partial object (avoids type mismatch crash)
      const reqRes = await fetch('/api/checklists').catch(() => null)
      if (reqRes?.ok) {
        const rd = await reqRes.json().catch(() => ({}))
        setExistingReqs(rd.checklists ?? [])
      }
      setReqSuccess('Requirement checklist created! Students will be notified.')
      setReqForm({ name: '', description: '', targetType: 'all',
        items: [{ title: '', requirementType: 'general', isRequired: true }] })
      setTimeout(() => setReqSuccess(''), 5000)
    } catch (err: unknown) {
      setReqError(err instanceof Error ? err.message : 'Failed to create requirement.')
    } finally { setReqSubmitting(false) }
  }

  /* ── Post announcement ──────────────────────────────────── */
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnnoError(''); setAnnoSuccess('')
    if (!annoForm.title.trim()) { setAnnoError('Title is required.'); return }
    if (!annoForm.content.trim()) { setAnnoError('Content is required.'); return }
    setAnnoSubmitting(true)
    try {
      const payload = {
        ...annoForm,
        strandId: annoForm.strandId || undefined,
        sectionId: annoForm.sectionId || undefined,
      }
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setAnnouncements(prev => [d.announcement, ...prev])
      setAnnoForm({ title: '', content: '', type: 'reminder', targetType: 'all', strandId: '', sectionId: '' })
      setAnnoSuccess('Announcement posted successfully!')
      setTimeout(() => setAnnoSuccess(''), 3000)
    } catch (err: unknown) {
      setAnnoError(err instanceof Error ? err.message : 'Failed to post announcement.')
    } finally {
      setAnnoSubmitting(false)
    }
  }

  /* ── Delete announcement ────────────────────────────────── */
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await fetch('/api/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch { /* silent */ }
  }

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading || status === 'loading') return null

  const userName = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'Teacher'

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#6B7280', textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', marginBottom: 6,
  }
  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB',
    borderRadius: 10, fontSize: 14, outline: 'none', background: 'white',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }
  const selectStyle = { ...inputStyle, appearance: 'auto' as const }

  return (
    <AppShell forceTeacher>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Welcome Banner ──────────────────────────────── */}
        <div data-tutorial="teacher-banner" style={{
          background: 'linear-gradient(135deg,#F97316 0%,#FB923C 55%,#FED7AA 100%)',
          borderRadius: 22, padding: '22px 22px 20px', color: 'white',
          boxShadow: '0 8px 28px rgba(249,115,22,0.22)', boxSizing: 'border-box',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* subtle dot pattern */}
          <div style={{ position:'absolute', inset:0, opacity:0.07, pointerEvents:'none',
            backgroundImage:'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize:'20px 20px' }}/>
          {/* shine */}
          <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160,
            borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.15),transparent 65%)',
            pointerEvents:'none' }}/>

          <div style={{ position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'0.1em', color:'rgba(255,255,255,0.7)', marginBottom:5 }}>
                Teacher Dashboard
              </p>
              <h1 style={{ fontSize:22, fontWeight:900, marginBottom:3, lineHeight:1.2,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                Welcome, {userName}! 👋
              </h1>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.5 }}>
                Manage students &amp; review narratives
              </p>
            </div>
            {/* Quick action: delete account */}
            <button onClick={() => setDeleteAccountConfirm(true)} style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)',
              cursor:'pointer', color:'white',
            }} title="Delete My Account">
              <svg style={{ width:16, height:16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Quick stats strip */}
          <div style={{ position:'relative', display:'flex', gap:10, marginTop:16, flexWrap:'wrap' }}>
            {[
              { label:'Students', val: stats.students },
              { label:'Pending',  val: stats.pending  },
              { label:'Teachers', val: teachers.length },
            ].map(s => (
              <div key={s.label} style={{
                background:'rgba(255,255,255,0.18)', borderRadius:10,
                padding:'8px 14px', display:'flex', alignItems:'center', gap:8,
                backdropFilter:'blur(4px)',
              }}>
                <span style={{ fontSize:20, fontWeight:900, color:'white', lineHeight:1 }}>{s.val}</span>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stat Cards — horizontal scroll on mobile ────── */}
        <div data-tutorial="teacher-stats" style={{
          display:'flex', gap:12, overflowX:'auto', paddingBottom:6,
          scrollbarWidth:'none', WebkitOverflowScrolling:'touch',
        }} className="hide-scrollbar">
          <StatCard label="Total Students" value={stats.students}
            bg="linear-gradient(135deg,#F97316,#FB923C,#FDBA74)"
            icon={<svg style={{ width:20, height:20, color:'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
          />
          <StatCard label="Teachers" value={teachers.length}
            bg="linear-gradient(135deg,#FB923C,#FCA070,#FED7AA)"
            icon={<svg style={{ width:20, height:20, color:'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>}
          />
          <StatCard label="Pending Reviews" value={stats.pending}
            bg="linear-gradient(135deg,#FBBF24,#FCD34D,#FDE68A)"
            icon={<svg style={{ width:20, height:20, color:'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
          <StatCard label="Sections" value={stats.sections}
            bg="linear-gradient(135deg,#FDE68A,#FEF3C7,#FFFBEB)"
            icon={<svg style={{ width:20, height:20, color:'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>}
          />
        </div>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div style={{
          display:'flex', gap:6, overflowX:'auto', paddingBottom:2,
          scrollbarWidth:'none', WebkitOverflowScrolling:'touch',
        }} className="hide-scrollbar teacher-tabs">
          <style>{`
            .hide-scrollbar::-webkit-scrollbar{display:none}
            @media(min-width:640px){.teacher-tabs>button{flex:1 1 0!important}}
          `}</style>
          <Tab label="Students"      active={activeTab==='students'}      count={students.length}          onClick={()=>setActiveTab('students')}      dataTut="students-tab" />
          <Tab label="Teachers"      active={activeTab==='teachers'}      count={teachers.length}          onClick={()=>setActiveTab('teachers')} />
          <Tab label="Narratives"    active={activeTab==='narratives'}    count={pendingNarratives.length} onClick={()=>setActiveTab('narratives')}    dataTut="narratives-tab" />
          <Tab label="Requirements"  active={activeTab==='requirements'}                                  onClick={()=>setActiveTab('requirements')}  dataTut="requirements-tab" />
          <Tab label="Announcements" active={activeTab==='announcements'} count={announcements.length}    onClick={()=>setActiveTab('announcements')} dataTut="announcements-tab" />
          <Tab label="👥 All Users"  active={activeTab==='users'}                                         dataTut="all-users-tab"
            onClick={async () => {
              setActiveTab('users')
              if (!allUsers) {
                setUsersLoading(true)
                try {
                  const res = await fetch('/api/admin/users')
                  if (res.ok) { const d = await res.json(); setAllUsers(d) }
                } catch { /* silent */ }
                finally { setUsersLoading(false) }
              }
            }} />
          <Tab label={mySection ? `📚 ${mySection.name}` : '📚 My Section'} active={activeTab==='my-section'}
            onClick={() => {
              if (mySection) { router.push('/teacher/my-section') }
              else { setActiveTab('my-section') }
            }} />
        </div>

        {/* ════════════════════════════════════════════════
            STUDENTS TAB
        ════════════════════════════════════════════════ */}
        {activeTab === 'students' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Section filter + search */}
            <div style={{ background:'white', border:'1px solid #FFE4C4', borderRadius:16, padding:'16px 18px',
              boxShadow:'0 2px 8px rgba(249,115,22,0.06)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[{ key: 'all', label: `All (${students.length})` },
                  ...sections.map(s => ({ key: s.name, label: `${s.name} (${s.students.length})` }))
                ].map(tab => (
                  <button key={tab.key} onClick={() => setSectionFilter(tab.key)} style={{
                    padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: sectionFilter === tab.key ? 'linear-gradient(135deg,#E8971F,#F5A623)' : '#F3F4F6',
                    color: sectionFilter === tab.key ? 'white' : '#4B5563',
                  }}>{tab.label}</button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  width: 16, height: 16, color: '#9CA3AF', pointerEvents: 'none' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search students by name, email, or ID..."
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  onFocus={e => { e.target.style.borderColor = '#F97316' }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
                />
              </div>
            </div>

            {/* Student list */}
            <div style={{ background:'white', border:'1px solid #FFE4C4', borderRadius:16, overflow:'hidden',
              boxShadow:'0 2px 8px rgba(249,115,22,0.06)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                  Students {sectionFilter !== 'all' && `— ${sectionFilter}`}
                </p>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
              </div>

              {filteredStudents.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, background: '#F3F4F6', borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg style={{ width: 24, height: 24, color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    {search ? 'No students match your search' : 'No students yet'}
                  </p>
                </div>
              ) : (
                filteredStudents.map((s, i) => {
                  const pending = s.narratives.filter(n => n.status === 'pending').length
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, padding: '12px 20px', flexWrap: 'wrap',
                      borderBottom: i < filteredStudents.length - 1 ? '1px solid #F9FAFB' : 'none',
                      boxSizing: 'border-box',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <Ava src={s.profilePicture} name={s.name} size={42} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: '#111827',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                          <p style={{ fontSize: 12, color: '#6B7280',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                            {s.studentId}{s.strand?.name ? ` · ${s.strand.name}` : ''}{s.section?.name ? ` · ${s.section.name}` : ' · No section'}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {pending > 0 && (
                          <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11,
                            fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                            {pending} pending
                          </span>
                        )}
                        <Button size="sm" variant="outline"
                          onClick={() => router.push(`/teacher/students/${s.id}`)}>
                          View
                        </Button>
                        <button onClick={() => setDeleteStudentTarget(s)} style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                          cursor: 'pointer',
                        }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TEACHERS TAB
        ════════════════════════════════════════════════ */}
        {activeTab === 'teachers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background:'white', border:'1px solid #FFE4C4', borderRadius:16, padding:'14px 18px',
              boxShadow:'0 2px 8px rgba(249,115,22,0.06)' }}>
              <input type="text" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)}
                placeholder="Search teachers by name or email..."
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#F97316' }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
              />
            </div>

            <div style={{ background:'white', border:'1px solid #FFE4C4', borderRadius:16, overflow:'hidden',
              boxShadow:'0 2px 8px rgba(249,115,22,0.06)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Registered Teachers</p>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''}</span>
              </div>

              {filteredTeachers.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: '#9CA3AF' }}>No teachers found</p>
                </div>
              ) : (
                filteredTeachers.map((t, i) => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                    borderBottom: i < filteredTeachers.length - 1 ? '1px solid #F9FAFB' : 'none',
                    boxSizing: 'border-box',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <Ava src={t.profilePicture} name={t.name} size={44} round />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.name}</p>
                        {t.email === session?.user?.email && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: '#EEF2FF',
                            color: '#4F46E5', padding: '2px 8px', borderRadius: 999 }}>YOU</span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 600, background: '#F3F4F6',
                          color: '#6B7280', padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>
                          {t.accessLevel}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{t.email}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                        ID: {t.teacherId}
                        {t.sections.length > 0 && ` · ${t.sections.length} section${t.sections.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                      {t.email !== session?.user?.email && (
                        <button onClick={() => setDeleteTeacherTarget(t)} style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>Delete</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Delete teacher confirm modal — OUTSIDE tab blocks so it always renders */}
        {deleteTeacherTarget && (
          <ConfirmModal
            title="Delete Teacher Account?"
            body={<>This will permanently delete <strong>{deleteTeacherTarget.name}</strong>&apos;s account. Their students will be unassigned.</>}
            confirmLabel={deletingTeacher ? 'Deleting...' : 'Yes, Delete'}
            danger
            loading={deletingTeacher}
            onConfirm={handleDeleteTeacher}
            onCancel={() => setDeleteTeacherTarget(null)}
          />
        )}

        {/* ════════════════════════════════════════════════
            NARRATIVES TAB — review pending submissions
        ════════════════════════════════════════════════ */}
        {activeTab === 'narratives' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Review comment modal */}
            {reviewingId && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 200, padding: 16 }}>
                <div style={{ background: 'white', borderRadius: 20, padding: 28,
                  maxWidth: 440, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                    Add a Comment (Optional)
                  </h3>
                  <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
                    Leave feedback for the student — they will receive a notification.
                  </p>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="e.g. Great work! Keep it up. / Please add more detail about your tasks."
                    rows={4}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB',
                      borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                      outline: 'none', boxSizing: 'border-box' as const }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={() => { setReviewingId(null); setReviewComment('') }}
                      disabled={reviewSubmitting}
                      style={{ flex: 1, padding: '10px', background: '#F3F4F6', color: '#374151',
                        border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReview(reviewingId, 'revision_requested')}
                      disabled={reviewSubmitting}
                      style={{ flex: 1, padding: '10px', background: '#FFFBF0', color: '#92400E',
                        border: '1px solid #FDE68A', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        cursor: reviewSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                      {reviewSubmitting ? '...' : 'Request Revision'}
                    </button>
                    <button
                      onClick={() => handleReview(reviewingId, 'approved')}
                      disabled={reviewSubmitting}
                      style={{ flex: 1, padding: '10px', background: '#D1FAE5', color: '#065F46',
                        border: '1px solid #A7F3D0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        cursor: reviewSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                      {reviewSubmitting ? '...' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>
                  Pending Narratives
                </p>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {pendingNarratives.length} awaiting review
                </span>
              </div>

              {pendingNarratives.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, background: '#D1FAE5', borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg style={{ width: 26, height: 26, color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>All caught up!</p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>No narratives pending review.</p>
                </div>
              ) : (
                pendingNarratives.map((n, i) => {
                  const title = n.content.match(/\*\*Activity:\*\*\s*(.+)/i)?.[1] ?? 'Daily Activity'
                  const dateStr = new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  const submitStr = n.submissionDate
                    ? new Date(n.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (n.submissionTime ? ` ${n.submissionTime}` : '')
                    : null
                  const verPhoto = n.photos?.find(p => p.isVerified)
                  return (
                    <div key={n.id} style={{
                      padding: '14px 20px',
                      borderBottom: i < pendingNarratives.length - 1 ? '1px solid #F9FAFB' : 'none',
                      boxSizing: 'border-box',
                    }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        {/* Verification photo thumbnail */}
                        {verPhoto && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={verPhoto.url} alt="Verification"
                            style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover',
                              border: '2px solid #A7F3D0', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>{title}</p>
                            {verPhoto && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: 999 }}>
                                Photo Verified
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#E8971F', margin: '0 0 3px' }}>
                            {n.student.name}
                            <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · {n.student.studentId}</span>
                          </p>
                          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                            Activity: {dateStr}{submitStr ? ` · Submitted: ${submitStr}` : ''}
                          </p>
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => router.push(`/narratives/${n.id}`)}
                            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: '#F3F4F6', color: '#374151', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            View
                          </button>
                          <button
                            onClick={() => { setReviewingId(n.id); setReviewComment('') }}
                            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              background: 'linear-gradient(135deg,#E8971F,#F5A623)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Review
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            REQUIREMENTS TAB — create checklists for students
        ════════════════════════════════════════════════ */}
        {activeTab === 'requirements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Existing checklists ── */}
            {existingReqs.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>
                    Active Checklists ({existingReqs.length})
                  </p>
                </div>
                {existingReqs.map((req, i) => (
                  <div key={req.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, padding: '12px 20px',
                    borderBottom: i < existingReqs.length - 1 ? '1px solid #F9FAFB' : 'none',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: '#111827', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.name}
                      </p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
                        {req.items.length} item{req.items.length !== 1 ? 's' : ''}
                        {' · '}{req.targetType === 'all' ? 'All students' : req.targetType}
                        {' · '}{req._count.progress} progress records
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteReq(req.id)}
                      disabled={deletingReqId === req.id}
                      style={{ padding: '6px 14px', background: '#FEF2F2', color: '#DC2626',
                        border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: deletingReqId === req.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: deletingReqId === req.id ? 0.6 : 1 }}>
                      {deletingReqId === req.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Create new checklist ── */}
            <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, padding: '20px 24px' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>
                Create Requirement Checklist
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                Students will be notified and can check off items as they complete them.
              </p>

              {reqSuccess && (
                <div style={{ padding: '12px 16px', background: '#D1FAE5', border: '1px solid #A7F3D0',
                  borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 600 }}>
                  ✓ {reqSuccess}
                </div>
              )}
              {reqError && (
                <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                  {reqError}
                </div>
              )}

              <form onSubmit={handlePostRequirement} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Checklist name */}
                <div>
                  <label style={labelStyle}>Checklist Name *</label>
                  <input type="text" value={reqForm.name}
                    onChange={e => setReqForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Work Immersion Requirements"
                    style={inputStyle} />
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>Description (optional)</label>
                  <input type="text" value={reqForm.description}
                    onChange={e => setReqForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of this checklist"
                    style={inputStyle} />
                </div>

                {/* Target */}
                <div>
                  <label style={labelStyle}>Assign To</label>
                  <select value={reqForm.targetType}
                    onChange={e => setReqForm(p => ({ ...p, targetType: e.target.value }))}
                    style={selectStyle}>
                    <option value="all">All Students</option>
                    <option value="strand">By Strand</option>
                    <option value="section">By Section</option>
                  </select>
                </div>

                {/* Items */}
                <div>
                  <label style={labelStyle}>Requirement Items *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reqForm.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="text" value={item.title}
                          onChange={e => {
                            const items = [...reqForm.items]
                            items[idx] = { ...items[idx], title: e.target.value }
                            setReqForm(p => ({ ...p, items }))
                          }}
                          placeholder={`Item ${idx + 1} — e.g. Submit medical certificate`}
                          style={{ ...inputStyle, flex: 1 }} />
                        <select value={item.requirementType}
                          onChange={e => {
                            const items = [...reqForm.items]
                            items[idx] = { ...items[idx], requirementType: e.target.value }
                            setReqForm(p => ({ ...p, items }))
                          }}
                          style={{ ...selectStyle, width: 130 }}>
                          <option value="general">General</option>
                          <option value="narrative">Narrative</option>
                          <option value="document">Document</option>
                        </select>
                        {reqForm.items.length > 1 && (
                          <button type="button"
                            onClick={() => setReqForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                            style={{ padding: '8px 10px', background: '#FEF2F2', color: '#DC2626',
                              border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer',
                              fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => setReqForm(p => ({ ...p, items: [...p.items, { title: '', requirementType: 'general', isRequired: true }] }))}
                    style={{ marginTop: 8, padding: '7px 16px', background: '#F3F4F6', color: '#374151',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Add Item
                  </button>
                </div>

                <button type="submit" disabled={reqSubmitting} style={{
                  padding: '12px', background: reqSubmitting ? '#FDBA74' : 'linear-gradient(135deg,#F97316,#FB923C)',
                  color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: reqSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>
                  {reqSubmitting ? 'Creating...' : 'Create & Notify Students'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ANNOUNCEMENTS TAB
        ════════════════════════════════════════════════ */}
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Create announcement form */}
            <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, padding: '20px 24px' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 16 }}>
                Post New Announcement
              </p>

              {annoError && (
                <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 10, fontSize: 13, color: '#DC2626', marginBottom: 12 }}>
                  {annoError}
                </div>
              )}
              {annoSuccess && (
                <div style={{ padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0',
                  borderRadius: 10, fontSize: 13, color: '#065F46', marginBottom: 12 }}>
                  {annoSuccess}
                </div>
              )}

              <form onSubmit={handlePostAnnouncement}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input type="text" value={annoForm.title} required
                    onChange={e => setAnnoForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Reminder: Submit your narratives"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#6366F1' }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Content *</label>
                  <textarea value={annoForm.content} required rows={4}
                    onChange={e => setAnnoForm(p => ({ ...p, content: e.target.value }))}
                    placeholder="Write your announcement here..."
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => { e.target.style.borderColor = '#6366F1' }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={annoForm.type}
                      onChange={e => setAnnoForm(p => ({ ...p, type: e.target.value }))}
                      style={selectStyle}>
                      <option value="reminder">Reminder</option>
                      <option value="deadline">Deadline</option>
                      <option value="instruction">Instruction</option>
                      <option value="schedule_change">Schedule Change</option>
                      <option value="meeting">Meeting</option>
                      <option value="document">Document</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Target</label>
                    <select value={annoForm.targetType}
                      onChange={e => setAnnoForm(p => ({ ...p, targetType: e.target.value, strandId: '', sectionId: '' }))}
                      style={selectStyle}>
                      <option value="all">All Students</option>
                      <option value="strand">By Strand</option>
                      <option value="section">By Section</option>
                    </select>
                  </div>
                </div>

                {/* Strand picker — shown when target is "strand" or "section" */}
                {(annoForm.targetType === 'strand' || annoForm.targetType === 'section') && (
                  <div>
                    <label style={labelStyle}>Strand</label>
                    <select value={annoForm.strandId}
                      onChange={e => setAnnoForm(p => ({ ...p, strandId: e.target.value, sectionId: '' }))}
                      style={selectStyle}>
                      <option value="">— All Strands —</option>
                      {annoStrands.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Section picker — shown when target is "section" */}
                {annoForm.targetType === 'section' && (
                  <div>
                    <label style={labelStyle}>Section</label>
                    <select value={annoForm.sectionId}
                      onChange={e => setAnnoForm(p => ({ ...p, sectionId: e.target.value }))}
                      style={selectStyle}>
                      <option value="">— All Sections —</option>
                      {annoSections
                        .filter(sec => !annoForm.strandId || sec.strandId === annoForm.strandId)
                        .map(sec => (
                          <option key={sec.id} value={sec.id}>{sec.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                <button type="submit" disabled={annoSubmitting} style={{
                  padding: '12px 0', background: annoSubmitting ? '#FDBA74' : 'linear-gradient(135deg,#F97316,#FB923C)',
                  color: 'white', border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: annoSubmitting ? 'not-allowed' : 'pointer',
                }}>
                  {annoSubmitting ? 'Posting...' : 'Post Announcement'}
                </button>
              </form>
            </div>

            {/* Existing announcements */}
            <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                  All Announcements ({announcements.length})
                </p>
              </div>

              {announcements.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: '#9CA3AF' }}>No announcements yet. Post one above.</p>
                </div>
              ) : (
                announcements.map((a, i) => (
                  <div key={a.id} style={{
                    padding: '14px 20px',
                    borderBottom: i < announcements.length - 1 ? '1px solid #F9FAFB' : 'none',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{a.title}</p>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            background: '#EEF2FF', color: '#4F46E5',
                          }}>{a.type.replace(/_/g, ' ').toUpperCase()}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                            background: '#F3F4F6', color: '#6B7280',
                          }}>{a.targetType === 'all' ? 'All Students' : a.targetType}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.content}
                        </p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                          By {a.teacher.name} · {new Date(a.publishedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteAnnouncement(a.id)} style={{
                        flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                        background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            USERS TAB — all registered accounts
        ════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, padding: '18px 22px' }}>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: '#111827', margin: '0 0 4px' }}>
                👥 All Registered Accounts
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                Every Gmail that has signed into the portal and their role.
              </p>
            </div>

            {usersLoading ? (
              <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF0)', border: '1px solid #FDE68A', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, border: '4px solid #FEF3C7', borderTopColor: '#E8971F',
                  borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, color: '#9CA3AF' }}>Loading accounts...</p>
              </div>
            ) : !allUsers ? (
              <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: '#9CA3AF' }}>Failed to load users.</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'linear-gradient(135deg,#F97316,#FB923C,#FDBA74)', borderRadius: 14, padding: '16px 20px', color: 'white' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)', margin: '0 0 4px' }}>Students</p>
                    <p style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>{allUsers.total.students}</p>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg,#FB923C,#FCA070,#FED7AA)', borderRadius: 14, padding: '16px 20px', color: 'white' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)', margin: '0 0 4px' }}>Teachers</p>
                    <p style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>{allUsers.total.teachers}</p>
                  </div>
                </div>

                {/* Students list */}
                <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', background: '#FFFBEB',
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>👨‍🎓</span>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#92400E', margin: 0 }}>
                      Students ({allUsers.total.students})
                    </p>
                  </div>
                  {allUsers.students.length === 0 ? (
                    <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: '#9CA3AF' }}>No students registered yet.</p>
                    </div>
                  ) : (
                    allUsers.students.map((u, i) => (
                      <div key={u.id} style={{ padding: '14px 20px', boxSizing: 'border-box',
                        borderBottom: i < allUsers.students.length - 1 ? '1px solid #F9FAFB' : 'none',
                        display: 'flex', alignItems: 'center', gap: 14 }}>
                        <Ava src={u.profilePicture} name={u.name} size={40} round />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>{u.name}</p>
                            <span style={{ fontSize: 10, fontWeight: 800, background: '#FFFBF0', color: '#E8971F',
                              border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: 999 }}>STUDENT</span>
                          </div>
                          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                            {u.studentId && <span style={{ fontSize: 11, color: '#9CA3AF' }}>ID: {u.studentId}</span>}
                            {u.strandName && <span style={{ fontSize: 11, color: '#9CA3AF' }}>• {u.strandName}</span>}
                            {u.sectionName && <span style={{ fontSize: 11, color: '#9CA3AF' }}>• {u.sectionName}</span>}
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>• {u.narrativeCount ?? 0} narrative{u.narrativeCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 11, color: '#D1D5DB', margin: 0 }}>
                            Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Teachers list */}
                <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFBF5)', border: '1px solid #FEE9C5', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', background: '#FFFBEB',
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>👩‍🏫</span>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#92400E', margin: 0 }}>
                      Teachers ({allUsers.total.teachers})
                    </p>
                  </div>
                  {allUsers.teachers.length === 0 ? (
                    <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: '#9CA3AF' }}>No teachers registered yet.</p>
                    </div>
                  ) : (
                    allUsers.teachers.map((u, i) => (
                      <div key={u.id} style={{ padding: '14px 20px', boxSizing: 'border-box',
                        borderBottom: i < allUsers.teachers.length - 1 ? '1px solid #F9FAFB' : 'none',
                        display: 'flex', alignItems: 'center', gap: 14 }}>
                        <Ava src={u.profilePicture} name={u.name} size={40} round />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>{u.name}</p>
                            <span style={{ fontSize: 10, fontWeight: 800, background: '#ECFDF5', color: '#065F46',
                              border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: 999 }}>TEACHER</span>
                            {u.email === session?.user?.email && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8',
                                padding: '2px 8px', borderRadius: 999 }}>YOU</span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </p>
                          {u.teacherId && (
                            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>ID: {u.teacherId}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                          <p style={{ fontSize: 11, color: '#D1D5DB', margin: 0 }}>
                            Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {/* Only show delete for other teachers, not yourself */}
                          {u.email !== session?.user?.email && (
                            <button
                              onClick={() => setDeleteAllUserTeacher(u)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 8,
                                background: '#FEF2F2', color: '#DC2626',
                                border: '1px solid #FECACA',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                fontFamily: 'inherit', transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEE2E2' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
                            >
                              <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            MY SECTION TAB — assign yourself to a section
        ════════════════════════════════════════════════ */}
        {activeTab === 'my-section' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 20,
              padding: '24px', boxShadow: '0 4px 16px rgba(249,115,22,0.08)' }}>
              <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🏫</div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1C1917', textAlign: 'center', marginBottom: 6 }}>
                Assign Yourself to a Section
              </h2>
              <p style={{ fontSize: 13, color: '#78716C', textAlign: 'center', lineHeight: 1.6, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
                Choose the section and strand you teach. You&apos;ll get a dedicated dashboard to manage that section — post announcements, create requirements, and review their narratives.
              </p>

              {mySection && (
                <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14,
                  padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#92400E', margin: '0 0 2px' }}>
                      Currently assigned to:
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#F97316', margin: 0 }}>
                      {mySection.name} <span style={{ color: '#78716C', fontWeight: 500, fontSize: 13 }}>— {mySection.strandName}</span>
                    </p>
                  </div>
                  <button onClick={() => router.push('/teacher/my-section')}
                    style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#F97316,#FB923C)',
                      color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', boxShadow: '0 3px 10px rgba(249,115,22,0.3)', whiteSpace: 'nowrap' }}>
                    Open My Section →
                  </button>
                </div>
              )}

              {/* Section picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C',
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    Select Section
                  </label>
                  <select value={sectionPickerId}
                    onChange={e => setSectionPickerId(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #FFE4C4',
                      borderRadius: 12, fontSize: 14, fontFamily: 'inherit', background: 'white',
                      outline: 'none', color: '#1C1917', boxSizing: 'border-box', appearance: 'auto',
                      cursor: 'pointer' }}>
                    <option value="">— No Section (unassign) —</option>
                    {sections.filter(s => s.id !== 'unassigned').map(s => (
                      <option key={s.id} value={s.id}>
                        {s.strand?.name ? `[${s.strand.name}] ` : ''}{s.name}
                        {s.teacher?.name ? ` — ${s.teacher.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button onClick={handleAssignSection} disabled={assigningSection}
                  style={{ padding: '13px', background: assigningSection ? '#FDBA74' : 'linear-gradient(135deg,#F97316,#FB923C)',
                    color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800,
                    cursor: assigningSection ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {assigningSection ? (
                    <><div style={{ width: 16, height: 16, border: '3px solid rgba(255,255,255,0.4)',
                      borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }}/>Assigning...</>
                  ) : sectionPickerId ? (
                    <><span>📚</span> Assign Me to This Section</>
                  ) : (
                    <><span>❌</span> Remove My Section Assignment</>
                  )}
                </button>
              </div>

              <div style={{ marginTop: 20, padding: '14px 16px', background: '#F9FAFB', borderRadius: 12,
                fontSize: 12, color: '#78716C', lineHeight: 1.7 }}>
                <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>What you get with a section:</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>📢 Post announcements directly to your section&apos;s students</li>
                  <li>✅ Create and track requirements for your section</li>
                  <li>📖 Review narratives submitted by your section&apos;s students</li>
                  <li>👥 See all students in your section at a glance</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Delete Account Modal ─────────────────────────── */}
      {deleteAccountConfirm && (
        <ConfirmModal
          title="Delete Your Account?"
          danger
          confirmLabel={deletingAccount ? 'Deleting...' : 'Yes, Delete Account'}
          loading={deletingAccount}
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteAccountConfirm(false)}
          body={
            <span>
              This is <strong>permanent and cannot be undone.</strong><br />
              Your students will remain but be unassigned from you.
            </span>
          }
        />
      )}

      {/* ── Delete Student Modal ─────────────────────────── */}
      {deleteStudentTarget && (
        <ConfirmModal
          title="Delete Student Account?"
          danger
          confirmLabel={deletingStudent ? 'Deleting...' : 'Yes, Delete Student'}
          loading={deletingStudent}
          onConfirm={handleDeleteStudent}
          onCancel={() => setDeleteStudentTarget(null)}
          body={
            <div>
              <p style={{ marginBottom: 12 }}>You are about to permanently delete:</p>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px' }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{deleteStudentTarget.name}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{deleteStudentTarget.email}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>ID: {deleteStudentTarget.studentId}</p>
              </div>
              <p style={{ marginTop: 12, color: '#EF4444', fontWeight: 500, fontSize: 13 }}>
                All their narratives and data will be permanently deleted.
              </p>
            </div>
          }
        />
      )}

      {/* ── Delete Teacher (All Users tab) Modal ─────────── */}
      {deleteAllUserTeacher && (
        <ConfirmModal
          title="Delete Teacher Account?"
          danger
          confirmLabel={deletingAllUserTeacher ? 'Deleting...' : 'Yes, Delete Teacher'}
          loading={deletingAllUserTeacher}
          onConfirm={handleDeleteAllUserTeacher}
          onCancel={() => setDeleteAllUserTeacher(null)}
          body={
            <div>
              <p style={{ marginBottom: 12 }}>You are about to permanently delete:</p>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px' }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{deleteAllUserTeacher.name}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{deleteAllUserTeacher.email}</p>
                {deleteAllUserTeacher.teacherId && (
                  <p style={{ fontSize: 12, color: '#9CA3AF' }}>ID: {deleteAllUserTeacher.teacherId}</p>
                )}
              </div>
              <p style={{ marginTop: 12, color: '#EF4444', fontWeight: 500, fontSize: 13 }}>
                This action is permanent and cannot be undone.
              </p>
            </div>
          }
        />
      )}

    </AppShell>
  )
}
