'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import AppShell from '@/components/AppShell'

/* ─── Types ──────────────────────────────────────────────── */
interface Teacher { id: string; name: string; email: string }
interface Narrative {
  id: string; status: string; date: string
  submissionDate?: string; content: string; isDraft: boolean
}
interface StudentDetail {
  id: string; studentId: string; name: string; email: string
  profilePicture?: string | null; company?: string; gradeLevel?: number
  section?: { name: string }; strand?: { name: string }
  supervisor?: { id: string; name: string; email: string }
  narratives: Narrative[]
}

/* ─── Status config ──────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string; dot: string }> = {
  approved:           { label: 'Approved',       bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  pending:            { label: 'Pending Review', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', dot: '#F59E0B' },
  revision_requested: { label: 'Revision Needed',bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA', dot: '#F97316' },
  draft:              { label: 'Draft',          bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB', dot: '#D1D5DB' },
}
function getCfg(status: string, isDraft: boolean) {
  if (isDraft) return STATUS_CFG.draft
  return STATUS_CFG[status] ?? STATUS_CFG.pending
}

/* ─── Toast ──────────────────────────────────────────────── */
type ToastKind = 'success' | 'error' | 'info'
function Toast({ msg, kind, onClose }: { msg: string; kind: ToastKind; onClose: () => void }) {
  const bg = kind === 'success' ? '#059669' : kind === 'error' ? '#DC2626' : '#1E293B'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      borderRadius: 12, background: bg, color: 'white', fontSize: 13, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)', minWidth: 240, maxWidth: 340,
      animation: 'slideInRight 0.3s cubic-bezier(0.34,1.3,0.64,1)' }}>
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  )
}

/* ─── Review Modal ───────────────────────────────────────── */
function ReviewModal({ narrative, onClose, onDone }: {
  narrative: Narrative
  onClose: () => void
  onDone: (id: string, action: 'approved' | 'revision_requested', comment: string) => void
}) {
  const [tab,        setTab]        = useState<'approve' | 'revise'>('approve')
  const [comment,    setComment]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err,        setErr]        = useState('')
  const title = narrative.content.match(/\*\*Activity:\*\*\s*(.+)/i)?.[1] ?? 'Daily Activity'
  const dateStr = new Date(narrative.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const handleSubmit = async () => {
    if (tab === 'revise' && !comment.trim()) { setErr('Please provide feedback for the student.'); return }
    setSubmitting(true); setErr('')
    try {
      const res = await fetch(`/api/narratives/${narrative.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: tab === 'approve' ? 'approved' : 'revision_requested',
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      onDone(narrative.id, tab === 'approve' ? 'approved' : 'revision_requested', comment)
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 16, animation: 'fadeIn 0.15s ease' }}>
      <div style={{ background: 'white', borderRadius: 22, maxWidth: 480, width: '100%',
        boxShadow: '0 32px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
        animation: 'scaleIn 0.25s cubic-bezier(0.34,1.3,0.64,1)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
              letterSpacing: '0.07em', margin: '0 0 3px' }}>Reviewing Narrative</p>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>{title}</h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>{dateStr}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%',
            background: '#F3F4F6', border: 'none', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Tab toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {(['approve', 'revise'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setErr('') }}
                style={{ padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  border: tab === t ? 'none' : '1.5px solid #E5E7EB', cursor: 'pointer',
                  background: tab === t
                    ? (t === 'approve' ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F97316,#EA580C)')
                    : 'white',
                  color: tab === t ? 'white' : '#6B7280',
                  boxShadow: tab === t ? '0 3px 12px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.18s ease', fontFamily: 'inherit' }}>
                {t === 'approve' ? '✓ Approve' : '↩ Request Revision'}
              </button>
            ))}
          </div>

          {/* Content by tab */}
          {tab === 'approve' ? (
            <div>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12,
                padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#065F46', margin: '0 0 4px' }}>
                  ✓ Approve this narrative
                </p>
                <p style={{ fontSize: 12, color: '#059669', margin: 0, lineHeight: 1.5 }}>
                  This marks the narrative as reviewed and approved. The student will be notified.
                </p>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                  Feedback (optional)
                </label>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  rows={3} placeholder="Leave a comment for the student (optional)..."
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB',
                    borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none',
                    resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' as const }}
                  onFocus={e => { e.target.style.borderColor = '#10B981' }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB' }} />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12,
                padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>
                  ↩ Request revision
                </p>
                <p style={{ fontSize: 12, color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                  Explain what the student needs to improve. The student will receive a notification.
                </p>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                  Revision Feedback <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea value={comment} onChange={e => { setComment(e.target.value); setErr('') }}
                  rows={4} placeholder="e.g. Your reflection section needs more detail. Please describe what you learned and how it applies to your career goals..."
                  style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${err ? '#EF4444' : '#E5E7EB'}`,
                    borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none',
                    resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' as const }}
                  onFocus={e => { e.target.style.borderColor = '#F97316' }}
                  onBlur={e => { e.target.style.borderColor = err ? '#EF4444' : '#E5E7EB' }} />
              </div>
            </div>
          )}

          {err && <p style={{ fontSize: 13, color: '#EF4444', marginTop: 8, fontWeight: 600 }}>{err}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6',
          display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={submitting}
            style={{ flex: 1, padding: '11px', background: '#F3F4F6', color: '#374151',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex: 2, padding: '11px',
              background: submitting ? '#D1D5DB'
                : tab === 'approve' ? 'linear-gradient(135deg,#10B981,#059669)'
                : 'linear-gradient(135deg,#F97316,#EA580C)',
              color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {submitting ? (
              <><div style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
              Processing…</>
            ) : tab === 'approve' ? '✓ Approve Narrative' : '↩ Send Revision Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Avatar ─────────────────────────────────────────────── */
function Ava({ src, name, size = 72 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  if (src && !err) return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      border: '3px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
      <Image src={src} alt={name} width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        unoptimized={src.startsWith('data:')} onError={() => setErr(true)} />
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 900, fontSize: Math.round(size * 0.36),
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
      {initials}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   PAGE
═════════════════════════════════════════════════════════════ */
export default function TeacherStudentDetailPage() {
  const router    = useRouter()
  const params    = useParams()
  const { data: session, status } = useSession()

  const [student,       setStudent]       = useState<StudentDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [loadErr,       setLoadErr]       = useState('')
  const [teachers,      setTeachers]      = useState<Teacher[]>([])
  const [assigningSuper, setAssigningSuper] = useState(false)
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('')
  const [reviewTarget,  setReviewTarget]  = useState<Narrative | null>(null)
  const [toasts,        setToasts]        = useState<{ id: number; msg: string; kind: ToastKind }[]>([])
  const toastCounter = useRef(0)

  const studentId = params.id as string

  const addToast = (msg: string, kind: ToastKind = 'success') => {
    const id = ++toastCounter.current
    setToasts(p => [...p, { id, msg, kind }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    Promise.all([
      fetch(`/api/teacher/student-detail/${studentId}`).then(r => r.json()),
      fetch('/api/teacher/list').then(r => r.json()),
    ]).then(([sd, td]) => {
      if (sd.student) {
        setStudent(sd.student)
        setSelectedSupervisor(sd.student.supervisor?.id ?? '')
      }
      else setLoadErr(sd.error ?? 'Student not found')
      setTeachers(td.teachers ?? [])
    }).catch(() => setLoadErr('Failed to load student'))
      .finally(() => setLoading(false))
  }, [session, studentId])

  const handleAssignSupervisor = async (supervisorId: string | null) => {
    setAssigningSuper(true)
    try {
      const res = await fetch(`/api/teacher/students/${studentId}/supervisor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId: supervisorId || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setStudent(prev => prev ? { ...prev, supervisor: d.supervisor ?? undefined } : null)
      setSelectedSupervisor(d.supervisor?.id ?? '')
      addToast(supervisorId ? '✓ Supervisor assigned!' : 'Supervisor removed.', 'success')
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Failed to assign supervisor.', 'error')
    } finally { setAssigningSuper(false) }
  }

  const handleReviewDone = (id: string, action: 'approved' | 'revision_requested') => {
    setStudent(prev => prev ? {
      ...prev,
      narratives: prev.narratives.map(n => n.id === id ? { ...n, status: action } : n),
    } : null)
    addToast(action === 'approved' ? '✓ Narrative approved!' : '↩ Revision request sent.', 'success')
  }

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading || status === 'loading') return null

  if (loadErr || !student) return (
    <AppShell forceTeacher>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>Student Not Found</p>
        <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 24px' }}>{loadErr}</p>
        <button onClick={() => router.push('/teacher/dashboard')}
          style={{ padding: '11px 28px', background: 'linear-gradient(135deg,#F97316,#EA580C)',
            color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}>
          ← Back to Dashboard
        </button>
      </div>
    </AppShell>
  )

  /* ── Derived ─────────────────────────────────────────────── */
  const submitted  = student.narratives.filter(n => !n.isDraft)
  const approved   = submitted.filter(n => n.status === 'approved').length
  const pending    = submitted.filter(n => n.status === 'pending').length
  const revision   = submitted.filter(n => n.status === 'revision_requested').length
  const pct        = submitted.length > 0 ? Math.round((approved / submitted.length) * 100) : 0

  return (
    <AppShell forceTeacher>
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fadeIn     { from { opacity:0 } to { opacity:1 } }
        @keyframes scaleIn    { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideUp    { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        .narr-row:hover       { background: #FAFAFA !important; }
        .action-btn:hover     { opacity: 0.85; transform: scale(1.02); }
        .action-btn:active    { transform: scale(0.97); }
      `}</style>

      {/* Toast container */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast msg={t.msg} kind={t.kind} onClose={() => setToasts(p => p.filter(x => x.id !== t.id))} />
          </div>
        ))}
      </div>

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          narrative={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onDone={handleReviewDone}
        />
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', animation: 'slideUp 0.4s ease both' }}>

        {/* ── Back button ───────────────────────────────── */}
        <button onClick={() => router.push('/teacher/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9CA3AF',
            background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20,
            padding: '4px 0', fontFamily: 'inherit', transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F97316' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF' }}>
          <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Teacher Dashboard
        </button>

        {/* ══════════════════════════════════════════════
            STUDENT HERO BANNER
        ══════════════════════════════════════════════ */}
        <div style={{ background: 'linear-gradient(135deg,#F97316 0%,#EA580C 55%,#FBBF24 100%)',
          borderRadius: 22, padding: '28px 28px 24px', color: 'white',
          boxShadow: '0 8px 32px rgba(249,115,22,0.3)', marginBottom: 16,
          position: 'relative', overflow: 'hidden' }}>
          {/* dot pattern */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '22px 22px' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <Ava src={student.profilePicture} name={student.name} size={72} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: '0 0 5px', lineHeight: 1.2 }}>
                {student.name}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 14px' }}>{student.email}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {[
                  student.studentId && `🪪 ${student.studentId}`,
                  student.strand?.name && `📚 ${student.strand.name}`,
                  student.section?.name && `📋 ${student.section.name}`,
                  student.gradeLevel && `Grade ${student.gradeLevel}`,
                ].filter(Boolean).map(tag => (
                  <span key={String(tag)} style={{ background: 'rgba(255,255,255,0.2)',
                    color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 12px',
                    borderRadius: 999, border: '1px solid rgba(255,255,255,0.25)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            STAT PILLS ROW
        ══════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Submitted',  value: submitted.length, bg: '#FFF7ED', color: '#F97316', border: '#FED7AA' },
            { label: 'Approved',   value: approved,         bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
            { label: 'Pending',    value: pending,          bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
            { label: 'Revisions',  value: revision,         bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
            { label: 'Approval %', value: `${pct}%`,        bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 14, padding: '14px 16px', boxSizing: 'border-box' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase',
                letterSpacing: '0.07em', margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            INFO DETAILS
        ══════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Company',   value: student.company },
            { label: 'Supervisor', value: student.supervisor?.name },
            { label: 'Strand',    value: student.strand?.name },
            { label: 'Section',   value: student.section?.name },
          ].map(p => (
            <div key={p.label} style={{ background: 'white', border: '1px solid #E5E7EB',
              borderRadius: 14, padding: '14px 16px', boxSizing: 'border-box' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase',
                letterSpacing: '0.08em', margin: '0 0 5px' }}>{p.label}</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0,
                color: p.value ? '#111827' : '#D1D5DB', fontStyle: p.value ? 'normal' : 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.value || 'Not set'}
              </p>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            PROGRESS BAR
        ══════════════════════════════════════════════ */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16,
          padding: '18px 22px', marginBottom: 16, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#111827', margin: 0 }}>
              Narrative Approval Progress
            </p>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#F97316' }}>{pct}% approved</span>
          </div>
          <div style={{ height: 10, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, transition: 'width 1s ease',
              background: pct >= 100 ? 'linear-gradient(90deg,#10B981,#059669)'
                : pct >= 60 ? 'linear-gradient(90deg,#F59E0B,#D97706)'
                : 'linear-gradient(90deg,#F97316,#EA580C)' }} />
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>
            {approved} of {submitted.length} submitted narratives approved
          </p>
        </div>

        {/* ══════════════════════════════════════════════
            ASSIGN SUPERVISOR
        ══════════════════════════════════════════════ */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16,
          padding: '18px 22px', marginBottom: 16, boxSizing: 'border-box' }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#111827', margin: '0 0 4px' }}>
            Assign Supervisor
          </p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 14px' }}>
            Current: <strong style={{ color: '#374151' }}>{student.supervisor?.name ?? 'None assigned'}</strong>
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <select
                value={selectedSupervisor}
                onChange={e => setSelectedSupervisor(e.target.value)}
                style={{ width: '100%', padding: '10px 36px 10px 14px', border: '1.5px solid #FFE4C4',
                  borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: 'white',
                  outline: 'none', boxSizing: 'border-box' as const, appearance: 'none' as const,
                  cursor: 'pointer', color: '#1C1917' }}>
                <option value="">— No Supervisor —</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
              <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 16, height: 16, color: '#9CA3AF', pointerEvents: 'none' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </div>
            <button onClick={() => handleAssignSupervisor(selectedSupervisor || null)}
              disabled={assigningSuper}
              style={{ padding: '10px 22px', background: assigningSuper ? '#FED7AA' : 'linear-gradient(135deg,#F97316,#FB923C)',
                color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: assigningSuper ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', boxShadow: assigningSuper ? 'none' : '0 3px 10px rgba(249,115,22,0.3)',
                display: 'flex', alignItems: 'center', gap: 6 }}>
              {assigningSuper ? (
                <><div style={{ width: 14, height: 14, border: '2.5px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />Saving…</>
              ) : 'Assign'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            The supervisor will be notified when this student submits a narrative.
          </p>
        </div>

        {/* ══════════════════════════════════════════════
            NARRATIVE JOURNEY TIMELINE
        ══════════════════════════════════════════════ */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16,
          overflow: 'hidden', marginBottom: 16 }}>
          {/* Header */}
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8, background: '#FAFAFA' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: '#111827', margin: '0 0 2px' }}>
                📖 Work Immersion Journey
              </p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                {student.narratives.length} entr{student.narratives.length === 1 ? 'y' : 'ies'}
                {pending > 0 && (
                  <span style={{ marginLeft: 8, color: '#D97706', fontWeight: 700 }}>
                    · {pending} awaiting review
                  </span>
                )}
              </p>
            </div>
            {pending > 0 && (
              <button onClick={() => {
                const firstPending = student.narratives.find(n => n.status === 'pending' && !n.isDraft)
                if (firstPending) setReviewTarget(firstPending)
              }}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#F97316,#EA580C)',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 3px 10px rgba(249,115,22,0.35)' }}>
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                Review Next
              </button>
            )}
          </div>

          {student.narratives.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>
                No narratives yet
              </p>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                This student hasn't submitted any narratives yet.
              </p>
            </div>
          ) : (
            <div>
              {student.narratives.map((n, i) => {
                const cfg    = getCfg(n.status, n.isDraft)
                const title  = n.content.match(/\*\*Activity:\*\*\s*(.+)/i)?.[1] ?? 'Daily Activity'
                const dateStr = new Date(n.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                const subDate = n.submissionDate
                  ? new Date(n.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : null
                const dayNum = String(i + 1).padStart(2, '0')

                return (
                  <div key={n.id} className="narr-row"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '16px 22px', boxSizing: 'border-box', transition: 'background 0.15s',
                      borderBottom: i < student.narratives.length - 1 ? '1px solid #F9FAFB' : 'none' }}>

                    {/* Day number + timeline dot */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 0, flexShrink: 0, minWidth: 48 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%',
                        background: n.isDraft ? '#F3F4F6'
                          : n.status === 'approved' ? 'linear-gradient(135deg,#10B981,#059669)'
                          : n.status === 'revision_requested' ? 'linear-gradient(135deg,#F97316,#EA580C)'
                          : 'linear-gradient(135deg,#F59E0B,#D97706)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: n.isDraft ? '#9CA3AF' : 'white', fontWeight: 800, fontSize: 12,
                        boxShadow: n.isDraft ? 'none' : '0 2px 8px rgba(0,0,0,0.15)' }}>
                        {n.status === 'approved' ? '✓' : n.isDraft ? '…' : dayNum}
                      </div>
                      {i < student.narratives.length - 1 && (
                        <div style={{ width: 2, height: 16, background: '#F3F4F6', marginTop: 4 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                        gap: 7, marginBottom: 5 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                          Day {dayNum} — {title}
                        </p>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px',
                          borderRadius: 999, background: cfg.bg, color: cfg.color,
                          border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10,
                        fontSize: 12, color: '#9CA3AF', marginBottom: 10 }}>
                        <span>📅 {dateStr}</span>
                        {subDate && <span>⏰ Submitted {subDate}</span>}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {/* View */}
                        <button onClick={() => router.push(`/narratives/${n.id}`)}
                          className="action-btn"
                          style={{ padding: '6px 14px', background: 'white', color: '#374151',
                            border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          View
                        </button>

                        {/* Review — pending only */}
                        {!n.isDraft && n.status === 'pending' && (
                          <button onClick={() => setReviewTarget(n)}
                            className="action-btn"
                            style={{ padding: '6px 14px',
                              background: 'linear-gradient(135deg,#F97316,#EA580C)',
                              color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                              boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
                              display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
                            </svg>
                            Review
                          </button>
                        )}

                        {/* Re-review revision_requested */}
                        {!n.isDraft && n.status === 'revision_requested' && (
                          <button onClick={() => setReviewTarget(n)}
                            className="action-btn"
                            style={{ padding: '6px 14px', background: '#FFF7ED', color: '#C2410C',
                              border: '1.5px solid #FED7AA', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                            Re-review
                          </button>
                        )}

                        {/* Download — approved only */}
                        {!n.isDraft && n.status === 'approved' && (
                          <a href={`/api/narratives/${n.id}/download`} download
                            className="action-btn"
                            style={{ padding: '6px 14px', background: '#ECFDF5', color: '#059669',
                              border: '1.5px solid #A7F3D0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              textDecoration: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
                              display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
