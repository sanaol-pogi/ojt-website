'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { useProfilePicture } from './ProfilePictureContext'

/* ─── Badge counts for student nav ──────────────────────── */
interface NavBadges {
  narratives: number    // pending review
  requirements: number  // incomplete items
  announcements: number // unread
}

/* ─── Avatar ─────────────────────────────────────────────── */
export function Avatar({ src, name, size = 34, round = true }: {
  src?: string | null; name?: string | null; size?: number; round?: boolean
}) {
  const [err, setErr] = useState(false)
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
  const radius = round ? '50%' : 10

  if (src && !err) return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
      <Image src={src} alt={name ?? 'Profile'} width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        unoptimized={src.startsWith('data:')} onError={() => setErr(true)} />
    </div>
  )
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 800, fontSize: Math.round(size * 0.36),
    }}>{initials}</div>
  )
}

/* ─── Strand gradient for header ────────────────────────── */
const STRAND_GRAD: Record<string, string> = {
  STEM:    'linear-gradient(135deg,#3B82F6 0%,#60A5FA 55%,#93C5FD 100%)',
  ABM:     'linear-gradient(135deg,#10B981 0%,#34D399 55%,#6EE7B7 100%)',
  HUMSS:   'linear-gradient(135deg,#A855F7 0%,#C084FC 55%,#D8B4FE 100%)',
  TVL:     'linear-gradient(135deg,#F97316 0%,#FB923C 55%,#FDBA74 100%)',
  TEACHER: 'linear-gradient(135deg,#F97316 0%,#FB923C 50%,#FED7AA 100%)',
  DEFAULT: 'linear-gradient(135deg,#F97316 0%,#FB923C 50%,#FED7AA 100%)',
}

/* ─── Nav item with optional red badge ───────────────────── */
function NavLink({ label, path, current, onClick, badge }: {
  label: string; path: string; current: boolean; onClick: () => void; badge?: number
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        background: current ? 'rgba(255,255,255,0.18)' : hov ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none', borderRadius: 8, padding: '6px 12px',
        color: current ? 'white' : 'rgba(255,255,255,0.75)',
        fontSize: 13, fontWeight: current ? 700 : 500, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}>
      {label}
      {!!badge && badge > 0 && (
        <span style={{
          position: 'absolute', top: 1, right: 1,
          minWidth: 16, height: 16,
          background: '#EF4444',
          color: 'white', fontSize: 9, fontWeight: 800,
          borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', lineHeight: 1,
          border: '1.5px solid rgba(255,255,255,0.8)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          animation: 'badgePop 0.3s cubic-bezier(0.34,1.5,0.64,1) both',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

/* ─── Header ─────────────────────────────────────────────── */
export default function Header({ strandCode, forceTeacher }: {
  strandCode?: string
  forceTeacher?: boolean  // set to true on teacher pages to bypass stale session
}) {
  const { data: session } = useSession()
  const router      = useRouter()
  const pathname    = usePathname()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [mobileNav,  setMobileNav]  = useState(false)
  const [activeTab,  setActiveTab]  = useState('')
  const [badges,     setBadges]     = useState<NavBadges>({ narratives: 0, requirements: 0, announcements: 0 })
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null)
  const [showInstall,   setShowInstall]   = useState(false)

  // Capture PWA install prompt
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as unknown as { prompt: () => Promise<void> })
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Read ?tab= from URL safely on client only (avoids SSR crash)
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab') ?? ''
    setActiveTab(tab)
  }, [pathname])

  // Fetch badge counts for students only
  useEffect(() => {
    if (!session?.user || session.user.role !== 'student') return
    const fetchBadges = async () => {
      try {
        const [narrRes, checkRes, notifRes] = await Promise.all([
          fetch('/api/narratives?stats=true').catch(() => null),
          fetch('/api/checklists/my-checklist').catch(() => null),
          fetch('/api/notifications').catch(() => null),
        ])
        let narratives = 0, requirements = 0, announcements = 0
        if (narrRes?.ok) {
          const d = await narrRes.json()
          narratives = d.stats?.pending ?? 0
        }
        if (checkRes?.ok) {
          const d = await checkRes.json()
          const cl = d.checklists?.[0]
          if (cl) requirements = (cl.stats?.totalItems ?? 0) - (cl.stats?.completedItems ?? 0)
        }
        if (notifRes?.ok) {
          const d = await notifRes.json()
          announcements = (d.notifications ?? []).filter((n: { isRead: boolean; type: string }) => !n.isRead && n.type === 'announcement').length
        }
        setBadges({ narratives, requirements, announcements })
      } catch { /* silent */ }
    }
    fetchBadges()
  }, [session, pathname])

  if (!session) return null

  // isTeacher: use explicit prop, session role, OR current URL
  const isTeacher = forceTeacher === true
    || session.user?.role === 'teacher'
    || pathname.startsWith('/teacher')
  const dashPath  = isTeacher ? '/teacher/dashboard' : '/dashboard'
  const grad      = isTeacher
    ? STRAND_GRAD.TEACHER
    : strandCode ? (STRAND_GRAD[strandCode.toUpperCase()] ?? STRAND_GRAD.DEFAULT) : STRAND_GRAD.DEFAULT

  const userName   = session.user?.name ?? session.user?.email?.split('@')[0] ?? 'User'
  const userEmail  = session.user?.email ?? ''
  const { picture: ctxPicture } = useProfilePicture()
  // Use context picture (updated instantly) falling back to session
  const profilePic = ctxPicture ?? session.user?.profilePicture ?? null
  const userRole   = isTeacher ? 'Teacher' : 'Student'

  const studentNav = [
    { label: 'Home',          path: '/dashboard',      badge: 0 },
    { label: 'Narratives',    path: '/narratives',     badge: badges.narratives },
    { label: 'Requirements',  path: '/checklist',      badge: badges.requirements },
    { label: 'Announcements', path: '/announcements',  badge: badges.announcements },
    { label: 'Profile',       path: '/profile/edit',   badge: 0 },
  ]
  const teacherNav = [
    { label: 'Dashboard',   path: '/teacher/dashboard', tab: '', badge: 0 },
    { label: 'Students',    path: '/teacher/dashboard?tab=students',      tab: 'students',      badge: 0 },
    { label: 'Announce',    path: '/teacher/dashboard?tab=announcements', tab: 'announcements', badge: 0 },
    { label: 'Teachers',    path: '/teacher/dashboard?tab=teachers',      tab: 'teachers',      badge: 0 },
    { label: 'Profile',     path: '/teacher/profile',                     tab: '',              badge: 0 },
  ]
  const navItems = isTeacher ? teacherNav : studentNav

  const handleSignOut = () => {
    // Clear all NextAuth cookies so next login starts completely fresh
    const cookieNames = [
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      'next-auth.state',
      'next-auth.pkce.code_verifier',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.csrf-token',
      '__Secure-next-auth.callback-url',
      '__Host-next-auth.csrf-token',
    ]
    cookieNames.forEach(name => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
    // Also clear profile picture from sessionStorage for all keys
    try {
      Object.keys(sessionStorage).forEach(k => { if (k.startsWith('profilePicture')) sessionStorage.removeItem(k) })
    } catch { /* private browsing */ }
    signOut({ callbackUrl: '/login', redirect: true })
  }

  return (
    <>
      <header style={{
        background: grad,
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 20px rgba(180,83,9,0.2), 0 1px 0 rgba(255,255,255,0.1)',
      }}
        className="header-glass">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>

            {/* Logo */}
            <button onClick={() => router.push(dashPath)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none',
                border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                background: 'white', flexShrink: 0,
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                border: '2px solid rgba(255,255,255,0.85)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/psbc-logo.jpg"
                  alt="PSBC Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { ;(e.target as HTMLImageElement).src = '/psbc-logo.svg' }}
                />
              </div>
              <div style={{ display: 'none' }} className="header-title">
                <p style={{ color: 'white', fontWeight: 900, fontSize: 13, margin: 0, lineHeight: 1.2,
                  textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                  PSBC Work Immersion
                </p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, margin: 0 }}>
                  Paete, Laguna
                </p>
              </div>
            </button>

            {/* Desktop Nav — stretched across full available width */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1,
              overflowX: 'auto', minWidth: 0, scrollbarWidth: 'none', justifyContent: 'flex-start' }}
              className="header-nav">
              {navItems.map(item => (
                <NavLink
                  key={item.label}
                  label={item.label}
                  path={item.path}
                  badge={(item as { badge?: number }).badge}
                  current={
                    isTeacher
                      ? (item as { tab?: string }).tab
                        ? activeTab === (item as { tab?: string }).tab
                        : pathname === '/teacher/dashboard' && !activeTab
                      : pathname === item.path
                  }
                  onClick={() => router.push(item.path)}
                />
              ))}
            </nav>

            {/* Spacer — only on desktop when nav has room */}
            <div style={{ flex: '0 0 8px' }} className="header-spacer" />

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

              {/* Mobile menu button */}
              <button onClick={() => setMobileNav(v => !v)} className="header-mobile-btn"
                style={{ display: 'none', background: 'rgba(255,255,255,0.15)', border: 'none',
                  borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white' }}>
                <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={mobileNav ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>

              {/* PWA Install button — only when installable */}
              {showInstall && (
                <button
                  onClick={async () => {
                    if (installPrompt) {
                      await installPrompt.prompt()
                      setShowInstall(false)
                    }
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    border: '1.5px solid rgba(255,255,255,0.5)',
                    borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, color: 'white',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    animation: 'badgePop 0.4s cubic-bezier(0.34,1.5,0.64,1) both',
                  }}
                  title="Install App"
                >
                  <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Install
                </button>
              )}

              {/* Share button */}
              <button
                onClick={async () => {
                  const url   = window.location.href
                  const title = 'PSBC Work Immersion Portal'
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    await navigator.share({ title, url }).catch(() => {})
                  } else {
                    await navigator.clipboard.writeText(url).catch(() => {})
                    alert('Link copied!')
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, color: 'white',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
                title="Share this page"
              >
                <svg style={{ width: 15, height: 15, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>

              {/* Profile button */}
              <div style={{ position: 'relative' }}>
                <button data-tutorial="profile-menu" onClick={() => setMenuOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10, padding: '6px 10px 6px 7px', cursor: 'pointer',
                    transition: 'background 0.15s', fontFamily: 'inherit' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
                >
                  <Avatar src={profilePic} name={userName} size={28} />
                  <div style={{ textAlign: 'left' }} className="header-username">
                    <p style={{ color: 'white', fontSize: 12, fontWeight: 700, margin: 0,
                      lineHeight: 1.2, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {userName}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>{userRole}</p>
                  </div>
                  <svg style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.7)',
                    transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                      onClick={() => setMenuOpen(false)} />
                    <div style={{
                      position: 'fixed',
                      top: 68,
                      right: 8,
                      width: 'min(240px, calc(100vw - 16px))',
                      background: 'rgba(255,255,255,0.97)',
                      backdropFilter: 'blur(16px)',
                      borderRadius: 16,
                      boxShadow: '0 20px 60px rgba(180,83,9,0.12), 0 4px 16px rgba(0,0,0,0.06)',
                      border: '1px solid rgba(232,151,31,0.12)', zIndex: 20, overflow: 'hidden',
                      animation: 'fadeIn 0.15s ease',
                    }}>
                      {/* User info */}
                      <div style={{ padding: '16px 18px', borderBottom: '1px solid #F3F4F6',
                        display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden',
                          flexShrink: 0, background: '#FFFBF0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#E8971F', fontWeight: 800, fontSize: 15 }}>
                          {profilePic
                            ? <Image src={profilePic} alt={userName} width={42} height={42}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                unoptimized={profilePic.startsWith('data:')} />
                            : userName.charAt(0).toUpperCase()
                          }
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {userName}
                          </p>
                          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {userEmail}
                          </p>
                          <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 700,
                            background: '#FFFBF0', color: '#E8971F', padding: '1px 8px', borderRadius: 999,
                            textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{userRole}</span>
                        </div>
                      </div>

                      {/* Menu items */}
                      <div style={{ padding: '6px 0' }}>
                        {[
                          { label: 'Dashboard',    path: dashPath,           icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                          ...(isTeacher
                            ? [{ label: 'Edit Profile', path: '/teacher/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }]
                            : [{ label: 'Edit Profile', path: '/profile/edit',    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }]
                          ),
                        ].map(item => (
                          <button key={item.path + item.label}
                            onClick={() => { setMenuOpen(false); router.push(item.path) }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, color: '#374151', fontFamily: 'inherit', textAlign: 'left',
                              transition: 'background 0.1s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <svg style={{ width: 16, height: 16, color: '#9CA3AF', flexShrink: 0 }}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ borderTop: '1px solid #F3F4F6', padding: '6px 0' }}>
                        <button onClick={handleSignOut}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, color: '#EF4444', fontFamily: 'inherit', textAlign: 'left',
                            transition: 'background 0.1s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNav && (
          <div style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 20px',
              display: 'flex', flexDirection: 'column', gap: 4 }}>
              {navItems.map(item => {
                const badge = (item as { badge?: number }).badge ?? 0
                return (
                  <button key={item.path + item.label}
                    onClick={() => { router.push(item.path); setMobileNav(false) }}
                    style={{ padding: '10px 14px', background: pathname === item.path ? 'rgba(255,255,255,0.15)' : 'transparent',
                      border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{item.label}</span>
                    {badge > 0 && (
                      <span style={{ background: '#EF4444', color: 'white', fontSize: 11, fontWeight: 800,
                        borderRadius: 999, padding: '1px 7px', minWidth: 20, textAlign: 'center' }}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                )
              })}
              {/* Install in mobile nav */}
              {showInstall && (
                <button
                  onClick={async () => {
                    setMobileNav(false)
                    if (installPrompt) { await installPrompt.prompt(); setShowInstall(false) }
                  }}
                  style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.15)',
                    border: '1.5px solid rgba(255,255,255,0.4)',
                    borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Install App
                </button>
              )}
              {/* Share in mobile nav */}
              <button
                onClick={async () => {
                  setMobileNav(false)
                  const url = window.location.href
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    await navigator.share({ title: 'PSBC Work Immersion Portal', url }).catch(() => {})
                  } else {
                    await navigator.clipboard.writeText(url).catch(() => {})
                    alert('Link copied!')
                  }
                }}
                style={{ padding: '10px 14px', background: 'transparent', border: 'none',
                  borderRadius: 8, color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share This Page
              </button>
            </div>
          </div>
        )}
      </header>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes badgePop { from { transform:scale(0); opacity:0; } to { transform:scale(1); opacity:1; } }

        @media (min-width: 640px) {
          .header-title { display: block !important; }
          .header-username { display: block !important; }
        }

        @media (min-width: 768px) {
          .header-nav { display: flex !important; }
          .header-spacer { display: block !important; }
          .header-mobile-btn { display: none !important; }
        }

        @media (max-width: 767px) {
          .header-nav { display: none !important; }
          .header-spacer { display: block !important; flex: 1 !important; }
          .header-mobile-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}

