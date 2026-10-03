'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import AppShell from '@/components/AppShell'

/* ─── Types ──────────────────────────────────────────────── */
interface Student {
  id: string; studentId: string; name: string; email: string
  profilePicture?: string | null
  narratives: { id: string; status: string; isDraft: boolean; date: string; submissionDate?: string }[]
}
interface Section {
  id: string; name: string; gradeLevel: number; strandId: string
  strand: { id: string; name: string }
  students: Student[]
  studentCount: number; pendingCount: number
}
interface PendingNarrative {
  id: string; status: string; date: string; submissionDate?: string; content?: string
  student: { id: string; name: string; studentId: string; email: string }
  photos: { url: string; isVerified: boolean }[]
}
interface Announcement {
  id: string; title: string; content: string; type: string
  targetType: string; publishedAt?: string; createdAt: string
  teacher: { name: string }
}
interface ChecklistItem { id: string; title: string; requirementType: string }
interface Checklist { id: string; name: string; description?: string | null; targetType: string; items: ChecklistItem[] }

type ActiveTab = 'students' | 'narratives' | 'announcements' | 'requirements'

/* ─── Avatar ─────────────────────────────────────────────── */
function Ava({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  if (src && !err) return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <Image src={src} alt={name} width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        unoptimized={src.startsWith('data:')} onError={() => setErr(true)} />
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#F97316,#FB923C)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: Math.round(size * 0.36) }}>
      {initials}
    </div>
  )
}

/* ─── Tab ────────────────────────────────────────────────── */
function Tab({ label, active, count, onClick }: {
  label: string; active: boolean; count?: number; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
        border: active ? 'none' : `1.5px solid ${hov ? '#F97316' : '#FFE4C4'}`,
        cursor: 'pointer', transition: 'all 0.18s ease',
        background: active ? 'linear-gradient(135deg,#F97316,#FB923C)' : hov ? '#FFF3E8' : 'white',
        color: active ? 'white' : hov ? '#F97316' : '#78716C',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
        boxShadow: active ? '0 3px 12px rgba(249,115,22,0.35)' : hov ? '0 2px 8px rgba(249,115,22,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
        transform: hov && !active ? 'translateY(-1px)' : 'none',
      }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : '#FEE2CC',
          color: active ? 'white' : '#EA580C',
          fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, minWidth: 20, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  )
}

/* ─── Page ───────────────────────────────────────────────── */
export default function MySectionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [section, setSection]   = useState<Section | null>(null)
  const [pending, setPending]   = useState<PendingNarrative[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('students')
  const [search, setSearch]     = useState('')

  // Announcement form
  const [annoForm, setAnnoForm] = useState({ title: '', content: '', type: 'reminder' })
  const [annoSubmitting, setAnnoSubmitting] = useState(false)
  const [annoMsg, setAnnoMsg]   = useState('')

  // Requirement form
  const [reqForm, setReqForm]   = useState({
    name: '', description: '',
    items: [{ title: '', requirementType: 'general' }],
  })
  const [reqSubmitting, setReqSubmitting] = useState(false)
  const [reqMsg, setReqMsg]     = useState('')

  // Review
  const [reviewingId, setReviewingId]     = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/teacher/my-section')
      if (res.ok) {
        const d = await res.json()
        setSection(d.section)
        setPending(d.pendingNarratives ?? [])
        setAnnouncements(d.announcements ?? [])
        setChecklists(d.checklists ?? [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') loadData()
  }, [status, loadData, router])

  const handleReview = async (narrativeId: string, action: 'approved' | 'revision_requested') => {
    setReviewSubmitting(true)
    try {
      const res = await fetch(`/api/narratives/${narrativeId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: reviewComment.trim() || undefined }),
      })
      if (res.ok) {
        setPending(prev => prev.filter(n => n.id !== narrativeId))
        setReviewingId(null); setReviewComment('')
      }
    } catch { /* silent */ }
    finally { setReviewSubmitting(false) }
  }

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault(); setAnnoMsg('')
    if (!section) return
    setAnnoSubmitting(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...annoForm,
          targetType: 'section',
          sectionId: section.id,
          strandId:  section.strandId,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setAnnouncements(prev => [d.announcement, ...prev])
        setAnnoForm({ title: '', content: '', type: 'reminder' })
        setAnnoMsg('✓ Announcement posted!')
        setTimeout(() => setAnnoMsg(''), 3000)
      } else { setAnnoMsg(d.error ?? 'Failed') }
    } catch { setAnnoMsg('Failed to post') }
    finally { setAnnoSubmitting(false) }
  }

  const handlePostRequirement = async (e: React.FormEvent) => {
    e.preventDefault(); setReqMsg('')
    if (!section) return
    setReqSubmitting(true)
    try {
      const validItems = reqForm.items.filter(i => i.title.trim())
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       reqForm.name,
          description: reqForm.description || undefined,
          targetType: 'section',
          sectionId:  section.id,
          items:      validItems.map(i => ({ ...i, isRequired: true })),
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setChecklists(prev => [d.checklist ?? d, ...prev])
        setReqForm({ name: '', description: '', items: [{ title: '', requirementType: 'general' }] })
        setReqMsg('✓ Requirement checklist created!')
        setTimeout(() => setReqMsg(''), 3000)
      } else { setReqMsg(d.error ?? 'Failed') }
    } catch { setReqMsg('Failed to create') }
    finally { setReqSubmitting(false) }
  }

  if (loading || status === 'loading') return null

  if (!section) return (
    <AppShell forceTeacher>
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🏫</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1C1917', marginBottom: 8 }}>
          No Section Assigned
        </h2>
        <p style={{ fontSize: 14, color: '#78716C', marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
          You haven&apos;t been assigned to a section yet. Go to your dashboard to assign yourself.
        </p>
        <button onClick={() => router.push('/teacher/dashboard')}
          style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#F97316,#FB923C)',
            color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>
          ← Go to Dashboard
        </button>
      </div>
    </AppShell>
  )

  const filteredStudents = section.students.filter(s =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId.toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #FFE4C4',
    borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: 'white',
    outline: 'none', boxSizing: 'border-box', color: '#1C1917',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
  }

  return (
    <AppShell forceTeacher>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Banner ──────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg,#F97316 0%,#FB923C 55%,#FED7AA 100%)',
          borderRadius: 20, padding: '22px 24px', color: 'white',
          boxShadow: '0 8px 28px rgba(249,115,22,0.22)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px' }}/>
          <div style={{ position: 'relative' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              My Section Dashboard
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 2, lineHeight: 1.2 }}>
              {section.name}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
              {section.strand.name} • {section.studentCount} student{section.studentCount !== 1 ? 's' : ''}
            </p>
            {/* Quick stats */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Students', val: section.studentCount },
                { label: 'Pending',  val: pending.length },
                { label: 'Announcements', val: announcements.length },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '7px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{s.val}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}
          className="hide-scrollbar teacher-tabs">
          <Tab label="Students"     active={activeTab==='students'}     count={section.studentCount} onClick={() => setActiveTab('students')} />
          <Tab label="Narratives"   active={activeTab==='narratives'}   count={pending.length}       onClick={() => setActiveTab('narratives')} />
          <Tab label="Announcements" active={activeTab==='announcements'} count={announcements.length} onClick={() => setActiveTab('announcements')} />
          <Tab label="Requirements" active={activeTab==='requirements'}                              onClick={() => setActiveTab('requirements')} />
        </div>

        {/* ════ STUDENTS ════ */}
        {activeTab === 'students' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
              padding: '14px 18px', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search students..." style={inputStyle} />
            </div>
            <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
              overflow: 'hidden', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #FEF3C7',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1C1917', margin: 0 }}>
                  {section.name} Students
                </p>
                <span style={{ fontSize: 12, color: '#78716C' }}>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
              </div>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: '#9CA3AF' }}>No students found</p>
                </div>
              ) : filteredStudents.map((s, i) => {
                const submitted = s.narratives.filter(n => !n.isDraft)
                const pend = submitted.filter(n => n.status === 'pending').length
                const approved = submitted.filter(n => n.status === 'approved').length
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                    borderBottom: i < filteredStudents.length - 1 ? '1px solid #F9FAFB' : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFFBF5' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <Ava src={s.profilePicture} name={s.name} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: '#1C1917', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: '#78716C', margin: '1px 0 0' }}>{s.email}</p>
                      <p style={{ fontSize: 11, color: '#A8A29E', margin: '1px 0 0' }}>
                        {s.studentId} · {approved} approved · {submitted.length} total
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                      {pend > 0 && (
                        <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11,
                          fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                          {pend} pending
                        </span>
                      )}
                      <button onClick={() => router.push(`/teacher/students/${s.id}`)}
                        style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white',
                          border: 'none', cursor: 'pointer' }}>
                        View
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════ NARRATIVES ════ */}
        {activeTab === 'narratives' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Review modal */}
            {reviewingId && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
                <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 440, width: '100%' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1C1917', marginBottom: 8 }}>Add Comment (Optional)</h3>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                    rows={3} placeholder="Leave feedback for the student..."
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setReviewingId(null); setReviewComment('') }}
                      style={{ flex: 1, padding: '10px', background: '#F3F4F6', color: '#374151',
                        border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={() => handleReview(reviewingId, 'revision_requested')} disabled={reviewSubmitting}
                      style={{ flex: 1, padding: '10px', background: '#FFFBF0', color: '#92400E',
                        border: '1px solid #FDE68A', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {reviewSubmitting ? '...' : 'Request Revision'}
                    </button>
                    <button onClick={() => handleReview(reviewingId, 'approved')} disabled={reviewSubmitting}
                      style={{ flex: 1, padding: '10px', background: '#D1FAE5', color: '#065F46',
                        border: '1px solid #A7F3D0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {reviewSubmitting ? '...' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
              overflow: 'hidden', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB',
                display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1C1917', margin: 0 }}>Pending Narratives</p>
                <span style={{ fontSize: 12, color: '#78716C' }}>{pending.length} awaiting review</span>
              </div>
              {pending.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>All caught up!</p>
                </div>
              ) : pending.map((n, i) => (
                <div key={n.id} style={{ padding: '14px 20px',
                  borderBottom: i < pending.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {n.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.photos[0].url} alt="photo"
                        style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover',
                          border: '2px solid #A7F3D0', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: '#F97316', margin: '0 0 2px' }}>{n.student.name}</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                        {n.student.studentId} · {new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => router.push(`/narratives/${n.id}`)}
                        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: '#F3F4F6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                        View
                      </button>
                      <button onClick={() => { setReviewingId(n.id); setReviewComment('') }}
                        style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white',
                          border: 'none', cursor: 'pointer' }}>
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ ANNOUNCEMENTS ════ */}
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
              padding: '20px 22px', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1C1917', marginBottom: 4 }}>
                Post Announcement to {section.name}
              </p>
              <p style={{ fontSize: 12, color: '#78716C', marginBottom: 16 }}>
                This will notify all students in {section.name} — {section.strand.name}.
              </p>
              {annoMsg && (
                <div style={{ padding: '10px 14px', background: annoMsg.startsWith('✓') ? '#ECFDF5' : '#FEF2F2',
                  border: `1px solid ${annoMsg.startsWith('✓') ? '#A7F3D0' : '#FECACA'}`,
                  borderRadius: 10, fontSize: 13, color: annoMsg.startsWith('✓') ? '#065F46' : '#DC2626',
                  marginBottom: 14 }}>{annoMsg}</div>
              )}
              <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input type="text" required value={annoForm.title}
                    onChange={e => setAnnoForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Reminder: Submit your narratives" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Content *</label>
                  <textarea required rows={3} value={annoForm.content}
                    onChange={e => setAnnoForm(p => ({ ...p, content: e.target.value }))}
                    placeholder="Write your announcement..." style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={annoForm.type} onChange={e => setAnnoForm(p => ({ ...p, type: e.target.value }))}
                    style={{ ...inputStyle, appearance: 'auto' }}>
                    <option value="reminder">Reminder</option>
                    <option value="deadline">Deadline</option>
                    <option value="instruction">Instruction</option>
                    <option value="meeting">Meeting</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <button type="submit" disabled={annoSubmitting}
                  style={{ padding: '12px', background: annoSubmitting ? '#FDBA74' : 'linear-gradient(135deg,#F97316,#FB923C)',
                    color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                    cursor: annoSubmitting ? 'not-allowed' : 'pointer' }}>
                  {annoSubmitting ? 'Posting...' : `Post to ${section.name}`}
                </button>
              </form>
            </div>

            {/* Existing announcements */}
            {announcements.length > 0 && (
              <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
                overflow: 'hidden', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#1C1917', margin: 0 }}>
                    Announcements ({announcements.length})
                  </p>
                </div>
                {announcements.map((a, i) => (
                  <div key={a.id} style={{ padding: '14px 20px',
                    borderBottom: i < announcements.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#1C1917', margin: '0 0 3px' }}>{a.title}</p>
                        <p style={{ fontSize: 13, color: '#78716C', margin: '0 0 3px', lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content}</p>
                        <p style={{ fontSize: 11, color: '#A8A29E', margin: 0 }}>
                          By {a.teacher.name} · {new Date(a.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: '#FFF7ED', color: '#F97316', whiteSpace: 'nowrap' }}>
                        {a.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ REQUIREMENTS ════ */}
        {activeTab === 'requirements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
              padding: '20px 22px', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1C1917', marginBottom: 4 }}>
                Create Requirement for {section.name}
              </p>
              <p style={{ fontSize: 12, color: '#78716C', marginBottom: 16 }}>
                Students in this section will see and complete these requirements.
              </p>
              {reqMsg && (
                <div style={{ padding: '10px 14px', background: reqMsg.startsWith('✓') ? '#ECFDF5' : '#FEF2F2',
                  border: `1px solid ${reqMsg.startsWith('✓') ? '#A7F3D0' : '#FECACA'}`,
                  borderRadius: 10, fontSize: 13, color: reqMsg.startsWith('✓') ? '#065F46' : '#DC2626',
                  marginBottom: 14 }}>{reqMsg}</div>
              )}
              <form onSubmit={handlePostRequirement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Checklist Name *</label>
                  <input type="text" required value={reqForm.name}
                    onChange={e => setReqForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Work Immersion Documents" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Description (optional)</label>
                  <input type="text" value={reqForm.description}
                    onChange={e => setReqForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Requirement Items *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reqForm.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8 }}>
                        <input type="text" value={item.title}
                          onChange={e => {
                            const items = [...reqForm.items]
                            items[idx] = { ...items[idx], title: e.target.value }
                            setReqForm(p => ({ ...p, items }))
                          }}
                          placeholder={`Item ${idx + 1}`} style={{ ...inputStyle, flex: 1 }} />
                        {reqForm.items.length > 1 && (
                          <button type="button"
                            onClick={() => setReqForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                            style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626',
                              border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => setReqForm(p => ({ ...p, items: [...p.items, { title: '', requirementType: 'general' }] }))}
                    style={{ marginTop: 8, padding: '7px 16px', background: '#F3F4F6', color: '#374151',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Add Item
                  </button>
                </div>
                <button type="submit" disabled={reqSubmitting}
                  style={{ padding: '12px', background: reqSubmitting ? '#FDBA74' : 'linear-gradient(135deg,#F97316,#FB923C)',
                    color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                    cursor: reqSubmitting ? 'not-allowed' : 'pointer' }}>
                  {reqSubmitting ? 'Creating...' : `Create for ${section.name}`}
                </button>
              </form>
            </div>

            {checklists.length > 0 && (
              <div style={{ background: 'white', border: '1px solid #FFE4C4', borderRadius: 16,
                overflow: 'hidden', boxShadow: '0 2px 8px rgba(249,115,22,0.06)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#1C1917', margin: 0 }}>
                    Active Requirements ({checklists.length})
                  </p>
                </div>
                {checklists.map((c, i) => (
                  <div key={c.id} style={{ padding: '14px 20px',
                    borderBottom: i < checklists.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#1C1917', margin: '0 0 2px' }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: '#78716C', margin: 0 }}>
                      {c.items.length} item{c.items.length !== 1 ? 's' : ''} · {c.targetType}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  )
}
