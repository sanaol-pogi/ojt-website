'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import AppShell from '@/components/AppShell'

/* ─── Types ──────────────────────────────────────────────── */
interface StudentData {
  id: string; name: string; studentId: string; email: string
  profilePicture?: string | null; company?: string; gradeLevel?: number
  strand?: { id: string; name: string }
  section?: { name: string }
  supervisor?: { name: string }
}
interface ChecklistStats { totalItems: number; completedItems: number; progressPercentage: number }
interface NarrativeStats  { total: number; thisWeek: number; pending: number }
interface RecentNarrative {
  id: string; date: string; content: string; status: string
  isDraft: boolean; submissionDate?: string
}

/* ─── Strand themes ──────────────────────────────────────── */
const STRAND_THEME: Record<string, { grad: string; accent: string }> = {
  STEM:    { grad: 'linear-gradient(135deg,#3B82F6 0%,#60A5FA 50%,#BAE6FD 100%)', accent: '#3B82F6' },
  ABM:     { grad: 'linear-gradient(135deg,#10B981 0%,#34D399 50%,#A7F3D0 100%)', accent: '#10B981' },
  HUMSS:   { grad: 'linear-gradient(135deg,#A855F7 0%,#C084FC 50%,#E9D5FF 100%)', accent: '#A855F7' },
  TVL:     { grad: 'linear-gradient(135deg,#F97316 0%,#FB923C 50%,#FDBA74 100%)', accent: '#F97316' },
  DEFAULT: { grad: 'linear-gradient(135deg,#F97316 0%,#FB923C 50%,#FED7AA 100%)', accent: '#F97316' },
}

const STATUS_CFG: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  approved:           { bg: '#D1FAE5', color: '#065F46', dot: '#10B981', label: 'Approved' },
  pending:            { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', label: 'Pending' },
  revision_requested: { bg: '#FFFBF0', color: '#92400E', dot: '#E8971F', label: 'Revision' },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function getGreetingEmoji() {
  const h = new Date().getHours()
  if (h < 12) return '\u2600\uFE0F'  // ☀ sun (single codepoint)
  if (h < 17) return '\u26C5'         // ⛅ (single codepoint)
  return '\uD83C\uDF19'               // 🌙 crescent moon
}

/* ─── Avatar ─────────────────────────────────────────────── */
function Avatar({ src, name, size = 56 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
  if (src && !err) return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      border: '3px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      <Image src={src} alt={name ?? 'Profile'} width={size} height={size}
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

/* ─── Animated progress circle ───────────────────────────── */
function ProgressCircle({ pct, size = 120, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const [anim, setAnim] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnim(pct), 300); return () => clearTimeout(t) }, [pct])
  const offset = circ - (anim / 100) * circ
  const color = pct >= 100 ? '#10B981' : pct >= 60 ? '#F97316' : '#FB923C'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 900, color: 'white', lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: size * 0.1, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>done</span>
      </div>
      {pct >= 100 && <div style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22,
        background: color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
        <svg width={12} height={12} fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
        </svg>
      </div>}
    </div>
  )
}

/* ─── Animated counter ───────────────────────────────────── */
function AnimCount({ to, duration = 900 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(Math.round(eased * to))
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [to, duration])
  return <>{v}</>
}

/* ─── Stat card ──────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, bg, onClick }: {
  label: string; value: string | number | React.ReactNode; sub?: string; icon: React.ReactNode
  bg: string; onClick?: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: bg, borderRadius: 20, padding: '20px 22px', color: 'white',
        display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', width: '100%',
        boxShadow: hov ? '0 12px 32px rgba(0,0,0,0.22)' : '0 4px 16px rgba(0,0,0,0.12)',
        transform: hov ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
        border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: onClick ? 'pointer' : 'default',
        position: 'relative', boxSizing: 'border-box' }}>
      {/* shine strip */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: 'radial-gradient(circle at top right, rgba(255,255,255,0.15), transparent 60%)',
        pointerEvents: 'none' }} />
      <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.2)', borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
          color: 'rgba(255,255,255,0.75)', margin: '0 0 4px' }}>{label}</p>
        <p style={{ fontSize: 32, fontWeight: 900, color: 'white', lineHeight: 1, margin: 0 }}>{value}</p>
        {sub && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>{sub}</p>}
      </div>
    </button>
  )
}

/* ─── Quick action ───────────────────────────────────────── */
function QuickAction({ label, desc, icon, onClick, accent = '#F97316', badge }: {
  label: string; desc: string; icon: React.ReactNode
  onClick: () => void; accent?: string; badge?: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
        borderRadius: 16, border: `1.5px solid ${hov ? accent + '50' : '#E5E7EB'}`,
        background: hov ? accent + '08' : 'white', cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.2s ease', fontFamily: 'inherit',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? `0 8px 24px ${accent}20` : '0 1px 4px rgba(0,0,0,0.04)',
        boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: hov ? accent : '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? 'white' : '#6B7280', transition: 'all 0.2s ease' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: '0 0 2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, lineHeight: 1.4 }}>{desc}</p>
      </div>
      {badge && (
        <span style={{ background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 800,
          padding: '2px 7px', borderRadius: 999, flexShrink: 0 }}>{badge}</span>
      )}
      <svg style={{ width: 16, height: 16, color: hov ? accent : '#D1D5DB', flexShrink: 0 }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  )
}

/* ─── Notification item ──────────────────────────────────── */
function NotifIcon({ type }: { type: string }) {
  if (type === 'narrative_approved') return (
    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#D1FAE5',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg style={{ width: 16, height: 16, color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
      </svg>
    </div>
  )
  if (type === 'revision_requested') return (
    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FFFBF0',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg style={{ width: 16, height: 16, color: '#E8971F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
    </div>
  )
  return (
    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EFF6FF',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg style={{ width: 16, height: 16, color: '#2563EB' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    </div>
  )
}

/* ─── Icons ──────────────────────────────────────────────── */
const ip = { width: 22, height: 22, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' } as const
const icons = {
  narratives: <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  week:       <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  pending:    <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  progress:   <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  pen:        <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  list:       <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  check:      <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
  bell:       <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  announce:   <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>,
  question:   <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  company:    <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
  user:       <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  grad:       <svg {...ip}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>,
}

/* ════════════════════════════════════════════════════════════
   PAGE
═════════════════════════════════════════════════════════════ */
export default function StudentDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [student,          setStudent]          = useState<StudentData | null>(null)
  const [cl,               setCl]               = useState<ChecklistStats>({ totalItems: 0, completedItems: 0, progressPercentage: 0 })
  const [ns,               setNs]               = useState<NarrativeStats>({ total: 0, thisWeek: 0, pending: 0 })
  const [loading,          setLoading]          = useState(true)
  const [recentNarratives, setRecentNarratives] = useState<RecentNarrative[]>([])
  const [notifications,    setNotifications]    = useState<{ id: string; title: string; message: string; isRead: boolean; link?: string; type: string }[]>([])
  const [showNotif,        setShowNotif]        = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.isRead).length

  const markAllRead = async () => {
    setNotifications(p => p.map(n => ({ ...n, isRead: true })))
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
  }

  // Close notif on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role === 'teacher') router.push('/teacher/dashboard')
  }, [status, session?.user?.role, router])

  useEffect(() => {
    if (!session?.user) return
    const load = async () => {
      try {
        const [pRes, cRes, nRes, notifRes, recentRes] = await Promise.all([
          fetch('/api/students/profile'),
          fetch('/api/checklists/my-checklist'),
          fetch('/api/narratives?stats=true'),
          fetch('/api/notifications'),
          fetch('/api/narratives?limit=5&page=1'),
        ])
        if (pRes.ok)      { const { student: s } = await pRes.json(); setStudent(s) }
        if (cRes.ok)      { const { checklists } = await cRes.json(); if (checklists?.length > 0) setCl(checklists[0].stats) }
        if (nRes.ok)      { const { stats } = await nRes.json(); if (stats) setNs(stats) }
        if (notifRes.ok)  { const { notifications: n } = await notifRes.json(); if (n) setNotifications(n) }
        if (recentRes.ok) { const { narratives: nr } = await recentRes.json(); if (nr) setRecentNarratives(nr.slice(0, 5)) }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [session])

  /* ── Loading ──────────────────────────────────────────── */
  if (loading || status === 'loading') return null

  const strandKey = student?.strand?.name?.toUpperCase().split(' ')
    .find(w => ['STEM', 'ABM', 'HUMSS', 'TVL'].includes(w)) ?? 'DEFAULT'
  const theme    = STRAND_THEME[strandKey] ?? STRAND_THEME.DEFAULT
  const pct      = Math.min(cl.progressPercentage, 100)
  const userName = student?.name ?? session?.user?.name ?? 'Student'
  const firstName = userName.split(' ')[0]
  const progressColor = pct >= 100 ? '#10B981' : pct >= 60 ? '#F97316' : '#FB923C'
  const progressLabel = pct >= 100 ? 'Complete! 🎉' : pct >= 60 ? 'In Progress' : 'Getting Started'

  return (
    <AppShell strandCode={strandKey !== 'DEFAULT' ? strandKey : undefined}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ══════════════════════════════════════════════════
            WELCOME BANNER — gradient + progress circle
        ═══════════════════════════════════════════════════ */}
        <div data-tutorial="dashboard-banner" className="gradient-banner" style={{ background: theme.grad, animation: 'fadeSlideUp 0.5s ease both' }}>
          <div className="gradient-banner-dots" />

          {/* Top: avatar + name + action buttons */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>

            {/* Left: avatar + greeting */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 0 }}>
              <div style={{ flexShrink: 0, position: 'relative' }}>
                <Avatar src={student?.profilePicture ?? session?.user?.profilePicture} name={userName} size={60} />
                {unread > 0 && (
                  <div style={{ position: 'absolute', bottom: 0, right: -2, width: 14, height: 14,
                    background: '#EF4444', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.8)' }} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, margin: '0 0 3px' }}>
                  {getGreeting()} {getGreetingEmoji()}
                </p>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', lineHeight: 1.15,
                  margin: '0 0 5px', wordBreak: 'break-word' }}>
                  {firstName}!
                </h1>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                  Keep your Work Immersion journey documented.
                </p>
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button onClick={() => router.push('/profile/edit')}
                style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10,
                  color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                ✏️ Edit Profile
              </button>
              {/* Notification bell */}
              <div style={{ position: 'relative' }} ref={notifRef}>
                <button data-tutorial="notifications" onClick={() => { setShowNotif(v => !v); if (unread > 0) markAllRead() }}
                  style={{ width: '100%', position: 'relative', background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10,
                    padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6, transition: 'all 0.15s', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
                  {icons.bell}
                  {unread > 0 && (
                    <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18,
                      background: '#EF4444', borderRadius: 999, fontSize: 10, fontWeight: 800, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                      border: '2px solid white', animation: 'pulseGlow 2s ease infinite' }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {/* Notif dropdown */}
                {showNotif && (
                  <div style={{ position: 'fixed', top: 68, right: 8,
                    width: 'min(320px, calc(100vw - 16px))',
                    background: 'white', borderRadius: 18, zIndex: 200,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
                    overflow: 'hidden', animation: 'scaleIn 0.2s cubic-bezier(0.34,1.3,0.64,1) both' }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'linear-gradient(135deg,#FFFBF0,#FEF3C7)' }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: '#111827', margin: 0 }}>🔔 Notifications</p>
                      {notifications.length > 0 && (
                        <button onClick={markAllRead} style={{ fontSize: 11, color: '#E8971F',
                          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>All caught up!</p>
                        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>No new notifications.</p>
                      </div>
                    ) : (
                      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {notifications.map(n => (
                          <div key={n.id} onClick={() => { setShowNotif(false); if (n.link) router.push(n.link) }}
                            style={{ padding: '12px 16px', borderBottom: '1px solid #F9FAFB',
                              background: n.isRead ? 'white' : '#FFFBF0',
                              cursor: n.link ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <NotifIcon type={n.type} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: '0 0 2px',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                              </div>
                              {!n.isRead && (
                                <div style={{ width: 8, height: 8, background: '#E8971F', borderRadius: '50%',
                                  flexShrink: 0, marginTop: 4, animation: 'pulseGlow 2s ease infinite' }} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: progress circle + stats row */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <ProgressCircle pct={pct} size={110} stroke={9} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600, margin: '0 0 4px' }}>
                Work Immersion Progress
              </p>
              <p style={{ fontSize: 15, fontWeight: 900, color: 'white', margin: '0 0 12px' }}>
                {cl.completedItems} of {cl.totalItems} requirements done
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white',
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                  {progressLabel}
                </span>
                {student?.studentId && (
                  <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white',
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                    ID: {student.studentId}
                  </span>
                )}
                {strandKey !== 'DEFAULT' && (
                  <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white',
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                    {strandKey}
                  </span>
                )}
                {student?.section?.name && (
                  <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white',
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                    {student.section.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            STATS GRID
        ═══════════════════════════════════════════════════ */}
        <div data-tutorial="stat-cards" className="stats-grid" style={{ animation: 'fadeSlideUp 0.5s 0.1s ease both' }}>
          <StatCard label="Narratives" value={<AnimCount to={ns.total} />} sub="total submissions"
            bg="linear-gradient(135deg,#F97316,#FB923C,#FDBA74)"
            icon={icons.narratives} onClick={() => router.push('/narratives')} />
          <StatCard label="This Week" value={<AnimCount to={ns.thisWeek} />} sub="narratives this week"
            bg="linear-gradient(135deg,#FB923C,#FCA070,#FED7AA)"
            icon={icons.week} onClick={() => router.push('/narratives')} />
          <StatCard label="Pending Review" value={<AnimCount to={ns.pending} />} sub="awaiting feedback"
            bg="linear-gradient(135deg,#FBBF24,#FCD34D,#FDE68A)"
            icon={icons.pending} onClick={() => router.push('/narratives')} />
          <StatCard label="Requirements" value={`${pct}%`} sub={`${cl.completedItems}/${cl.totalItems} done`}
            bg={`linear-gradient(135deg,${progressColor},${progressColor}CC)`}
            icon={icons.progress} onClick={() => router.push('/checklist')} />
        </div>

        {/* ══════════════════════════════════════════════════
            JOURNEY PREVIEW (recent narratives as timeline)
        ═══════════════════════════════════════════════════ */}
        <div style={{ background: 'linear-gradient(135deg,#FFFFFF,#FAFAFA)',
          border: '1px solid #F0F0F0', borderRadius: 20,
          boxShadow: '0 2px 16px rgba(249,115,22,0.07)', overflow: 'hidden',
          animation: 'fadeSlideUp 0.5s 0.2s ease both' }}>
          {/* Header */}
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 3px' }}>
                📖 Recent Activity
              </h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Your latest narrative entries</p>
            </div>
            <button onClick={() => router.push('/narratives')}
              style={{ fontSize: 13, fontWeight: 700, color: theme.accent, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              View All
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {recentNarratives.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>
                Start Your Work Immersion Journey
              </p>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px', lineHeight: 1.6 }}>
                You haven't created any narratives yet.<br/>Document what you experience each day.
              </p>
              <button onClick={() => router.push('/narratives/create')}
                className="btn-premium" style={{ padding: '11px 28px', fontSize: 14 }}>
                ✍️ Write First Narrative
              </button>
            </div>
          ) : (
            <div>
              {recentNarratives.map((n, i) => {
                const title = n.content.match(/\*\*Activity:\*\*\s*(.+)/i)?.[1] ?? 'Daily Activity'
                const dateStr = new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const cfg = n.isDraft
                  ? { bg: '#F3F4F6', color: '#6B7280', dot: '#D1D5DB', label: 'Draft' }
                  : (STATUS_CFG[n.status] ?? STATUS_CFG.pending)
                return (
                  <div key={n.id} onClick={() => router.push(`/narratives/${n.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 22px', cursor: 'pointer', transition: 'background 0.15s',
                      borderBottom: i < recentNarratives.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    {/* Day dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                    {/* Icon */}
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg style={{ width: 18, height: 18, color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>{dateStr}</p>
                    </div>
                    {/* Status badge */}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px',
                      borderRadius: 999, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                    <svg style={{ width: 14, height: 14, color: '#D1D5DB', flexShrink: 0 }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                )
              })}
              {/* Write new CTA row */}
              <div style={{ padding: '14px 22px', background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
                <button onClick={() => router.push('/narratives/create')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFFBF0',
                    border: `2px dashed ${theme.accent}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg style={{ width: 18, height: 18, color: theme.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>Write today's narrative</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            QUICK ACTIONS
        ═══════════════════════════════════════════════════ */}
        <div style={{ animation: 'fadeSlideUp 0.5s 0.3s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>Quick Actions</h2>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          </div>
          <div data-tutorial="narratives-list" className="grid-2">
            <QuickAction label="New Narrative" desc="Document today's work experience"
              accent="#7C3AED" onClick={() => router.push('/narratives/create')} icon={icons.pen} />
            <QuickAction label="My Narratives" desc="View and manage all submissions"
              accent="#6366F1" onClick={() => router.push('/narratives')} icon={icons.list}
              badge={ns.pending > 0 ? String(ns.pending) : undefined} />
            <QuickAction label="Requirements" desc="Track your checklist items"
              accent="#10B981" onClick={() => router.push('/checklist')} icon={icons.check} />
            <QuickAction label="Announcements" desc="Latest updates from teachers"
              accent="#F97316" onClick={() => router.push('/announcements')} icon={icons.announce} />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            PROGRESS DETAIL CARD
        ═══════════════════════════════════════════════════ */}
        <div style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)',
          border: '1px solid #FED7AA', borderRadius: 20,
          boxShadow: '0 2px 12px rgba(249,115,22,0.08)', padding: '22px 24px',
          animation: 'fadeSlideUp 0.5s 0.35s ease both', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 3px' }}>
                📊 Overall Requirements Progress
              </h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                {cl.completedItems} of {cl.totalItems} checklist items completed
              </p>
            </div>
            <span style={{
              padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              background: pct >= 100 ? '#D1FAE5' : pct >= 60 ? '#FEF3C7' : '#FFFBF0',
              color:      pct >= 100 ? '#065F46' : pct >= 60 ? '#92400E' : '#B45309',
            }}>{progressLabel}</span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 12, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999,
              background: `linear-gradient(90deg,${progressColor},${progressColor}BB)`,
              transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: `0 2px 8px ${progressColor}60` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[0, 25, 50, 75, 100].map(m => (
              <span key={m} style={{ fontSize: 10, fontWeight: 700,
                color: pct >= m ? progressColor : '#D1D5DB' }}>{m}%</span>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            INFO PILLS (company / supervisor / grade+section)
        ═══════════════════════════════════════════════════ */}
        <div style={{ animation: 'fadeSlideUp 0.5s 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>My Details</h2>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            <button onClick={() => router.push('/profile/edit')}
              style={{ fontSize: 12, fontWeight: 700, color: theme.accent, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Edit →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}
            className="grid-3">
            {[
              { label: 'Company',       value: student?.company,            icon: icons.company, bg: '#FFFBF0', border: '#FDE68A' },
              { label: 'Supervisor',    value: student?.supervisor?.name,   icon: icons.user,    bg: '#F0FDF4', border: '#A7F3D0' },
              { label: 'Grade & Sec.',
                value: student?.gradeLevel && student?.section?.name
                  ? `G${student.gradeLevel} — ${student.section.name}` : undefined,
                icon: icons.grad, bg: '#EFF6FF', border: '#BFDBFE' },
            ].map(({ label, value, icon, bg, border }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16,
                padding: '14px 12px', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(249,115,22,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase',
                    letterSpacing: '0.06em', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: value ? '#111827' : '#D1D5DB',
                  fontStyle: value ? 'normal' : 'italic', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {value || 'Not set'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            HELP BANNER
        ═══════════════════════════════════════════════════ */}
        <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
          border: '1px solid #BFDBFE', borderRadius: 16, padding: '18px 22px',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          animation: 'fadeSlideUp 0.5s 0.45s ease both', boxSizing: 'border-box' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icons.question}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#1E40AF', margin: '0 0 3px' }}>
              Need help?
            </p>
            <p style={{ fontSize: 13, color: '#3B82F6', margin: 0 }}>
              Visit the Help Center for guides, FAQs, and writing tips.
            </p>
          </div>
          <button onClick={() => router.push('/help')}
            style={{ padding: '9px 18px', background: '#2563EB', color: 'white', border: 'none',
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Open Help →
          </button>
        </div>

      </div>

      <style>{`@keyframes scaleIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}} @keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.4)}50%{box-shadow:0 0 0 8px rgba(249,115,22,0)}}`}</style>
    </AppShell>
  )
}
