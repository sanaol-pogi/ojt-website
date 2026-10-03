'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/AppShell'

/* ─── Types ──────────────────────────────────────────────── */
interface Photo { id: string; url: string; isVerified: boolean; uploadedAt: string }
interface Narrative {
  id: string; date: string; content: string; status: string
  isDraft: boolean; submissionDate?: string | null; submittedAt?: string | null
  photos: Photo[]
}
type Filter = 'all' | 'submitted' | 'draft' | 'pending' | 'approved' | 'revision'

/* ─── Helpers ────────────────────────────────────────────── */
function getTitle(content: string) {
  const m = content.match(/\*\*Activity:\*\*\s*(.+)/i)
  return m ? m[1].trim() : 'Daily Activity'
}
function getExcerpt(content: string) {
  return content
    .replace(/\*\*[^*]+:\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 160)
}

/* ─── Status config ──────────────────────────────────────── */
const STATUS: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  approved:           { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', label: 'Approved',       icon: '✓' },
  pending:            { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: 'Pending Review',  icon: '⏳' },
  revision_requested: { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA', label: 'Revision Needed', icon: '↻' },
}

/* ─── Skeleton card ──────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFCF5)', borderRadius: 20, border: '1px solid #FEE9C5', padding: '20px 22px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div className="skeleton" style={{ width: 60, height: 60, borderRadius: 14, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 10, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 10, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 12, width: '80%', borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 12, width: '55%', marginTop: 6, borderRadius: 8 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {[80, 100, 90].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 34, width: w, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  )
}

/* ─── Status tooltip ──────────────────────────────────────── */
const STATUS_DESC: Record<string, string> = {
  draft:              'Saved but not yet submitted for review.',
  pending:            'Submitted and waiting for your teacher to review.',
  approved:           'Reviewed and approved by your teacher. ✓',
  revision_requested: 'Your teacher requested changes. Open to view feedback.',
}

/* ════════════════════════════════════════════════════════════
   PAGE
═════════════════════════════════════════════════════════════ */
export default function NarrativesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [narratives,  setNarratives]  = useState<Narrative[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<Filter>('all')
  const [search,      setSearch]      = useState('')
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [apiError,    setApiError]    = useState('')

  // Teachers → redirect
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'teacher')
      router.replace('/teacher/dashboard')
  }, [status, session?.user?.role, router])

  const load = useCallback(() => {
    setLoading(true); setApiError('')
    fetch('/api/narratives')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setApiError(d.error); setNarratives([]) }
        else         { setNarratives(d.narratives ?? []) }
      })
      .catch(() => setApiError('Failed to load narratives'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true); setDeleteError('')
    try {
      const res = await fetch(`/api/narratives/${deleteId}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed to delete')
      setNarratives(prev => prev.filter(n => n.id !== deleteId))
      setDeleteId(null)
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Deletion failed')
    } finally { setDeleting(false) }
  }

  /* ── Derived ────────────────────────────────────────────── */
  const counts = {
    all:       narratives.length,
    submitted: narratives.filter(n => !n.isDraft).length,
    draft:     narratives.filter(n =>  n.isDraft).length,
    pending:   narratives.filter(n => !n.isDraft && n.status === 'pending').length,
    approved:  narratives.filter(n => !n.isDraft && n.status === 'approved').length,
    revision:  narratives.filter(n => !n.isDraft && n.status === 'revision_requested').length,
  }
  const filtered = narratives
    .filter(n => {
      if (filter === 'all')       return true
      if (filter === 'draft')     return n.isDraft
      if (filter === 'submitted') return !n.isDraft
      if (filter === 'pending')   return !n.isDraft && n.status === 'pending'
      if (filter === 'approved')  return !n.isDraft && n.status === 'approved'
      if (filter === 'revision')  return !n.isDraft && n.status === 'revision_requested'
      return true
    })
    .filter(n => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return getTitle(n.content).toLowerCase().includes(q)
        || n.content.toLowerCase().includes(q)
        || new Date(n.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toLowerCase().includes(q)
    })

  /* ── Filter pill ──────────────────────────────────────── */
  const FilterPill = ({ f, label, accent }: { f: Filter; label: string; accent?: string }) => {
    const active = filter === f
    const color  = accent ?? '#F97316'
    return (
      <button onClick={() => setFilter(f)} style={{
        padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
        border: active ? 'none' : '1.5px solid #E5E7EB',
        background: active ? color : 'white',
        color: active ? 'white' : '#6B7280',
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: active ? `0 4px 12px ${color}4D` : 'none',
        transition: 'all 0.18s ease', transform: active ? 'scale(1.04)' : 'scale(1)',
      }}>
        {label}
        {counts[f] > 0 && (
          <span style={{ marginLeft: 5, opacity: 0.8, fontWeight: 600 }}>({counts[f]})</span>
        )}
      </button>
    )
  }

  return (
    <AppShell>
      <style>{`
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .narr-card{transition:box-shadow 0.22s ease,transform 0.22s cubic-bezier(0.34,1.2,0.64,1)}
        .narr-card:hover{box-shadow:0 12px 36px rgba(0,0,0,0.10);transform:translateY(-3px)}
        .action-btn{transition:all 0.15s ease} .action-btn:hover{opacity:0.85;transform:scale(1.02)}
        .action-btn:active{transform:scale(0.97)}
      `}</style>

      {/* ── Delete modal ──────────────────────────────────── */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 16, animation: 'scaleIn 0.2s ease' }}>
          <div style={{ background: 'white', borderRadius: 24, padding: '32px 28px',
            maxWidth: 400, width: '100%', boxShadow: '0 32px 64px rgba(0,0,0,0.25)',
            animation: 'scaleIn 0.25s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <div style={{ width: 56, height: 56, background: '#FEE2E2', borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg style={{ width: 28, height: 28, color: '#DC2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Delete Narrative?</h2>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
              This will permanently delete this narrative and its verification photo.{' '}
              <strong style={{ color: '#374151' }}>This cannot be undone.</strong>
            </p>
            {deleteError && (
              <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 12, padding: '8px 12px',
                background: '#FEF2F2', borderRadius: 8 }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setDeleteId(null); setDeleteError('') }} disabled={deleting}
                style={{ flex: 1, padding: '12px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: '12px', background: deleting ? '#FCA5A5' : '#DC2626',
                  color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {deleting ? (
                  <><div style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.4)',
                    borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />Deleting…</>
                ) : '🗑 Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>

        {/* ── Page header ───────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => router.push('/dashboard')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9CA3AF',
            background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10,
            padding: '4px 0', fontFamily: 'inherit', transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F97316' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF' }}>
            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Dashboard
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>📖 My Narratives</h1>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                View, create, edit, and manage your Work Immersion experiences.
              </p>
            </div>
            <button onClick={() => router.push('/narratives/create')}
              data-tutorial="new-narrative"
              className="btn-premium"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px',
                fontSize: 14, flexShrink: 0, borderRadius: 12 }}>
              <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
              New Narrative
            </button>
          </div>
        </div>

        {/* ── Search + filters ──────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFCF5)', borderRadius: 16, border: '1px solid #FEE9C5',
          padding: '16px 18px', marginBottom: 20, boxSizing: 'border-box',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 16, height: 16, color: '#9CA3AF', pointerEvents: 'none' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search narratives by title, content, or date…"
              className="search-input"
              style={{ paddingLeft: 40 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)', background: '#E5E7EB', border: 'none', borderRadius: '50%',
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#6B7280', fontSize: 14, lineHeight: 1 }}>×</button>
            )}
          </div>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FilterPill f="all"       label="All" />
            <FilterPill f="pending"   label="⏳ Pending"  accent="#F97316" />
            <FilterPill f="approved"  label="✓ Approved"  accent="#10B981" />
            <FilterPill f="revision"  label="↻ Revision"  accent="#8B5CF6" />
            <FilterPill f="submitted" label="Submitted" />
            <FilterPill f="draft"     label="Drafts" />
          </div>
        </div>

        {/* ── API error ─────────────────────────────────── */}
        {apiError && (
          <div style={{ padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 14, marginBottom: 16, fontSize: 13, color: '#DC2626',
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg style={{ width: 18, height: 18, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <span style={{ flex: 1 }}>
              {apiError === 'Student not found'
                ? 'Your student account was not found. Please complete your profile first.'
                : `Couldn't load narratives — ${apiError}`}
            </span>
            <button onClick={load} style={{ fontSize: 12, fontWeight: 700, color: '#DC2626',
              background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
              fontFamily: 'inherit' }}>Retry</button>
          </div>
        )}

        {/* ── Search result count ───────────────────────── */}
        {search && !loading && (
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, fontWeight: 500 }}>
            {filtered.length === 0
              ? `No results for "${search}"`
              : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`}
          </p>
        )}

        {/* ── Loading skeletons ──────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (

          /* ── Empty state ─────────────────────────────── */
          <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFCF5)', borderRadius: 20, border: '1px solid #FEE9C5',
            padding: '64px 32px', textAlign: 'center', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {filter === 'draft' ? '📝' : filter === 'submitted' ? '📬' : '📖'}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
              {search
                ? 'No narratives found'
                : filter === 'draft' ? 'No drafts yet'
                : filter === 'submitted' ? 'No submissions yet'
                : 'Start Your Work Immersion Journey'}
            </h3>
            <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 24px', lineHeight: 1.7, maxWidth: 360, marginInline: 'auto' }}>
              {search
                ? `No narratives match "${search}". Try a different search term.`
                : filter === 'draft' ? 'Save a narrative as draft to continue editing it later.'
                : filter === 'submitted' ? 'Submit a narrative for your teacher to review.'
                : 'Document what you experience each day — from Day 1 to completion.'}
            </p>
            {!search && (
              <button onClick={() => router.push('/narratives/create')}
                className="btn-premium" style={{ padding: '12px 32px', fontSize: 14, borderRadius: 12 }}>
                ✍️ Write First Narrative
              </button>
            )}
            {search && (
              <button onClick={() => setSearch('')}
                style={{ padding: '10px 24px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear Search
              </button>
            )}
          </div>

        ) : (

          /* ── Narrative cards ──────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((n, idx) => {
              const verPhoto = n.photos?.find(p => p.isVerified)
              const dateStr  = new Date(n.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              const submitDate = n.submissionDate ?? n.submittedAt
              const submitStr = submitDate
                ? new Date(submitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : null
              const badge = STATUS[n.status] ?? STATUS.pending
              const statusKey = n.isDraft ? 'draft' : n.status
              const statusDesc = STATUS_DESC[statusKey] ?? ''

              return (
                <div key={n.id} className="narr-card"
                  style={{ background: 'linear-gradient(135deg,#FFFFFF,#FFFCF5)', borderRadius: 20, border: '1px solid #FEE9C5',
                    overflow: 'hidden', boxSizing: 'border-box',
                    animation: `fadeSlideUp 0.4s ${idx * 60}ms ease both` }}>

                  {/* Card body */}
                  <div style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

                      {/* Photo or icon */}
                      <div style={{ flexShrink: 0 }}>
                        {verPhoto ? (
                          <div style={{ width: 62, height: 62, borderRadius: 14, overflow: 'hidden',
                            border: '2.5px solid #A7F3D0', boxShadow: '0 3px 10px rgba(0,0,0,0.1)' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={verPhoto.url} alt="Verification"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: 62, height: 62, borderRadius: 14, flexShrink: 0,
                            background: n.isDraft ? '#F3F4F6' : '#FFF7ED',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2px solid ${n.isDraft ? '#E5E7EB' : '#FED7AA'}` }}>
                            <svg style={{ width: 26, height: 26, color: n.isDraft ? '#9CA3AF' : '#F97316' }}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title + badges row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                          <h3 style={{ fontWeight: 800, fontSize: 15, color: '#111827', margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                            {getTitle(n.content)}
                          </h3>
                          {/* Status badge with tooltip */}
                          <div className="tooltip-wrap">
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px',
                              borderRadius: 999, whiteSpace: 'nowrap', cursor: 'default',
                              background: n.isDraft ? '#F3F4F6' : badge.bg,
                              color:      n.isDraft ? '#6B7280' : badge.color,
                              border:     `1px solid ${n.isDraft ? '#E5E7EB' : badge.border}` }}>
                              {n.isDraft ? 'Draft' : `${badge.icon} ${badge.label}`}
                            </span>
                            <div className="tooltip-box">{statusDesc}</div>
                          </div>
                          {verPhoto && !n.isDraft && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5',
                              color: '#065F46', padding: '2px 8px', borderRadius: 999,
                              border: '1px solid #A7F3D0' }}>
                              ✓ Photo Verified
                            </span>
                          )}
                        </div>

                        {/* Meta row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12,
                          fontSize: 12, color: '#9CA3AF', marginBottom: 8, alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            {dateStr}
                          </span>
                          {submitStr && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Submitted {submitStr}
                            </span>
                          )}
                        </div>

                        {/* Excerpt */}
                        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.55, margin: 0,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden' }}>
                          {getExcerpt(n.content) || 'No content preview available.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div style={{ borderTop: '1px solid #F3F4F6', padding: '12px 22px',
                    background: '#FAFAFA', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>

                    {/* View */}
                    <button onClick={() => router.push(`/narratives/${n.id}`)}
                      className="action-btn"
                      style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        border: '1.5px solid #E5E7EB', background: 'white', color: '#374151',
                        cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      View
                    </button>

                    {/* Continue draft */}
                    {n.isDraft && (
                      <button onClick={() => router.push(`/narratives/create?draft=${n.id}`)}
                        className="action-btn"
                        style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          border: 'none', background: '#F97316', color: 'white',
                          cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
                          boxShadow: '0 3px 10px rgba(249,115,22,0.3)' }}>
                        <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Continue
                      </button>
                    )}

                    {/* Download */}
                    {!n.isDraft && (
                      <a href={`/api/narratives/${n.id}/download`} download
                        className="action-btn"
                        style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          border: '1.5px solid #FED7AA', background: '#FFF7ED', color: '#C2410C',
                          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontFamily: 'inherit' }}>
                        <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Download
                      </a>
                    )}

                    {/* Share */}
                    {!n.isDraft && typeof navigator !== 'undefined' && navigator.share && (
                      <button onClick={async () => {
                        try {
                          await navigator.share({
                            title: `Narrative — ${getTitle(n.content)}`,
                            text: `Work Immersion narrative: ${new Date(n.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
                            url: `${window.location.origin}/narratives/${n.id}`,
                          })
                        } catch { /* user cancelled */ }
                      }}
                        className="action-btn"
                        style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8',
                          cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                        </svg>
                        Share
                      </button>
                    )}

                    {/* Spacer */}
                    <div style={{ flex: 1 }} />

                    {/* Delete */}
                    <button onClick={() => { setDeleteId(n.id); setDeleteError('') }}
                      className="action-btn"
                      style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626',
                        cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Footer help strip ──────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div style={{ marginTop: 24, padding: '14px 18px', background: '#F9FAFB',
            borderRadius: 14, border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <svg style={{ width: 16, height: 16, color: '#6B7280', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0, flex: 1 }}>
              Hover over a status badge to see what it means. Download your narrative for your personal records.
            </p>
            <button onClick={() => router.push('/help')}
              style={{ fontSize: 12, fontWeight: 700, color: '#F97316', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Help →
            </button>
          </div>
        )}

      </div>
    </AppShell>
  )
}
