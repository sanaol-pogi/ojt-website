'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'

export const dynamic = 'force-dynamic'

/* --- Strand data ------------------------------------------ */
const STRANDS = [
  {
    code: 'STEM', name: 'Science, Technology, Engineering & Mathematics',
    desc: 'Explore technology, science, engineering, and analytical careers.',
    color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)',
    icon: (
      <svg style={{ width: 28, height: 28 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    code: 'ABM', name: 'Accountancy, Business & Management',
    desc: 'Develop professional experience in business, finance, and entrepreneurship.',
    color: '#10B981', bg: 'rgba(16,185,129,0.12)',
    icon: (
      <svg style={{ width: 28, height: 28 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    code: 'HUMSS', name: 'Humanities & Social Sciences',
    desc: 'Explore careers in communication, society, culture, and human behavior.',
    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',
    icon: (
      <svg style={{ width: 28, height: 28 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    code: 'TVL', name: 'Technical-Vocational-Livelihood',
    desc: 'Build practical skills and workplace experience through vocational training.',
    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',
    icon: (
      <svg style={{ width: 28, height: 28 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

/* --- Google icon ------------------------------------------ */
function GoogleIcon() {
  return (
    <svg style={{ width: 20, height: 20, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

/* --- Page ------------------------------------------------- */
function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  // Read NextAuth error from URL � e.g. ?error=AlreadyStudent
  const authError = searchParams.get('error')
  const authErrorMsg = authError === 'AlreadyStudent'
    ? 'This Google account is already registered as a Student. Please sign in using the Student tab.'
    : authError === 'AlreadyTeacher'
    ? 'This Google account is already registered as a Teacher. Please sign in using the Teacher / Admin tab.'
    : authError === 'OAuthCallback'
    ? 'Sign-in failed. Please try again.'
    : null

  const [loading,       setLoading]       = useState(false)
  const [userType,      setUserType]      = useState<'student' | 'teacher'>('student')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPw,        setShowPw]        = useState(false)
  const [error,         setError]         = useState('')
  const [hoveredStrand, setHoveredStrand] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = session.user.role
      // Only redirect once the role is resolved (not 'pending')
      if (role === 'teacher') router.push('/teacher/dashboard')
      else if (role === 'student') router.push('/dashboard')
      // role === 'pending' means finalize hasn't run yet � stay on login
    }
  }, [status, session, router])

  const handleGoogleSignIn = async (asTeacher = false) => {
    setLoading(true); setError('')
    try {
      const finalDest   = asTeacher ? '/teacher/dashboard' : '/dashboard'
      const callbackUrl = `/api/auth/finalize?intent=${asTeacher ? 'teacher' : 'student'}&next=${encodeURIComponent(finalDest)}`
      await signIn('google', { callbackUrl, redirect: true, prompt: 'select_account' })
    } catch { setError('An error occurred. Please try again.'); setLoading(false) }
  }

  const handleCancelSignIn = () => {
    setLoading(false)
    setError('')
  }

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await signIn('credentials', {
        email, password, role: 'teacher', callbackUrl: '/teacher/dashboard', redirect: false,
      })
      if (res?.error) {
        setError(res.error.includes('No teacher') ? 'No teacher account found with this email.' :
                 res.error.includes('Incorrect')  ? 'Incorrect password. Please try again.' :
                 'Invalid email or password.')
        setLoading(false)
      } else if (res?.url) { router.push(res.url) }
    } catch { setError('An error occurred.'); setLoading(false) }
  }

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg,#B45309,#E8971F)' }}
      className="bg-animated-gradient">
      <div style={{ width: 44, height: 44, border: '4px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* -- LEFT SIDE: Branding ---------------------------- */}
      <div style={{
        display: 'none',
        flex: 1, background: 'linear-gradient(145deg,#F97316 0%,#FB923C 45%,#FED7AA 100%)',
        padding: '48px', position: 'relative', overflow: 'hidden',
        flexDirection: 'column', justifyContent: 'space-between',
      }} className="login-left">

        {/* Animated background circles */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 16, background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: 4, flexShrink: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/psbc-logo.jpg" onError={(e) => { (e.target as HTMLImageElement).src = "/psbc-logo.svg" }} alt="PSBC Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 900, fontSize: 17, margin: 0, lineHeight: 1.2,
                textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                Paete Science and<br />Business College Inc.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '4px 0 0' }}>
                Paete, Laguna
              </p>
            </div>
          </div>

          <h1 style={{ fontSize: 38, fontWeight: 900, color: 'white', lineHeight: 1.15, margin: '0 0 18px',
            textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            Work Immersion<br />
            <span style={{ color: '#FEF3C7' }}>Management</span><br />
            Portal
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, margin: 0, maxWidth: 360 }}>
            Manage your requirements, track your progress, connect with partner companies,
            and document your daily immersion experience.
          </p>
        </div>

        {/* Strand cards */}
        <div style={{ position: 'relative' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            Available Strands
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {STRANDS.map(s => (
              <div
                key={s.code}
                onMouseEnter={() => setHoveredStrand(s.code)}
                onMouseLeave={() => setHoveredStrand(null)}
                style={{
                  background: hoveredStrand === s.code ? s.bg : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${hoveredStrand === s.code ? s.color + '50' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  transition: 'all 0.2s ease', cursor: 'default',
                  transform: hoveredStrand === s.code ? 'translateY(-2px)' : 'none',
                }}
              >
                <div style={{ color: hoveredStrand === s.code ? s.color : 'rgba(255,255,255,0.5)',
                  marginBottom: 8, transition: 'color 0.2s' }}>
                  {s.icon}
                </div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 13, margin: '0 0 3px' }}>{s.code}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                  {hoveredStrand === s.code ? s.desc : s.name}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, margin: 0, position: 'relative' }}>
          &copy; {new Date().getFullYear()} Work Immersion Portal � Senior High School Management System
        </p>
      </div>

      {/* -- RIGHT SIDE: Login card ------------------------- */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FFF8F0',
        backgroundImage: [
          'radial-gradient(at 0% 0%,   rgba(251,146,60,0.2) 0, transparent 50%)',
          'radial-gradient(at 100% 0%, rgba(253,186,116,0.16) 0, transparent 45%)',
          'radial-gradient(at 50% 100%,rgba(254,215,170,0.14) 0, transparent 50%)',
        ].join(','),
        padding: '32px 24px', minHeight: '100vh', position: 'relative', overflow: 'hidden',
      }}>
        {/* Colorful background blobs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)',
          pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 260, height: 260,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,83,9,0.08) 0%, transparent 70%)',
          pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '10%', width: 180, height: 180,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,151,31,0.06) 0%, transparent 70%)',
          pointerEvents: 'none' }} />
        <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}
          className="animate-slide-up">

          {/* Mobile logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }} className="login-mobile-logo">
            <div style={{
              width: 72, height: 72, borderRadius: 18, background: 'white',
              border: '3px solid #FDE68A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(232,151,31,0.2)', padding: 4,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/psbc-logo.jpg" onError={(e) => { (e.target as HTMLImageElement).src = "/psbc-logo.svg" }} alt="PSBC" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 900, color: '#111827', margin: 0 }}>
              PSBC Work Immersion Portal
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
              Paete Science and Business College Inc.
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            borderRadius: 24,
            boxShadow: '0 20px 60px rgba(180,83,9,0.1), 0 4px 16px rgba(0,0,0,0.05)',
            border: '1px solid rgba(232,151,31,0.15)',
            overflow: 'hidden',
          }}>
            {/* Role tabs — pill selector */}
            <div style={{ padding: '20px 20px 0', display: 'flex', gap: 8 }}>
              {(['student', 'teacher'] as const).map(t => (
                <button key={t} onClick={() => { setUserType(t); setError('') }}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.22s cubic-bezier(0.34,1.2,0.64,1)',
                    background: userType === t
                      ? 'linear-gradient(135deg,#F97316,#FB923C,#FDBA74)'
                      : '#F3F4F6',
                    color: userType === t ? 'white' : '#9CA3AF',
                    boxShadow: userType === t ? '0 4px 14px rgba(249,115,22,0.3)' : 'none',
                    transform: userType === t ? 'scale(1.03)' : 'scale(1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}>
                  {t === 'student'
                    ? <><svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>Student</>
                    : <><svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Teacher / Admin</>
                  }
                </button>
              ))}
            </div>

            <div style={{ padding: '32px 32px 28px' }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 24px' }}>
                Sign in to your Work Immersion Portal
              </p>

              {/* Auth error from URL (wrong role, OAuth failure) */}
              {authErrorMsg && (
                <div style={{
                  display: 'flex', gap: 10, padding: '14px 16px',
                  background: '#FFFBF0', border: '1.5px solid #FDE68A',
                  borderRadius: 12, marginBottom: 16, fontSize: 13, color: '#92400E',
                  lineHeight: 1.5,
                }}>
                  <svg style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: '#E8971F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  {authErrorMsg}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', gap: 10, padding: '12px 14px',
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#DC2626',
                }}>
                  <svg style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Student � Google only */}
              {userType === 'student' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{
                    background: '#FFFBF0', border: '1px solid #FDE68A',
                    borderRadius: 12, padding: '14px 16px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 3px' }}>
                      Students sign in with Gmail
                    </p>
                    <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
                      Use your school-registered Google account
                    </p>
                  </div>
                  <button
                    onClick={() => handleGoogleSignIn(false)}
                    disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: '13px', background: loading ? '#F3F4F6' : 'white',
                      border: '2px solid #E5E7EB', borderRadius: 12, fontSize: 14, fontWeight: 600,
                      color: '#374151', cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.borderColor = '#E8971F' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB' }}
                  >
                    {loading
                      ? <div style={{ width: 20, height: 20, border: '3px solid #E5E7EB', borderTopColor: '#E8971F', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      : <GoogleIcon />
                    }
                    {loading ? 'Signing in...' : 'Continue with Google'}
                  </button>
                  {loading && (
                    <button onClick={handleCancelSignIn}
                      style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: 'none',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px',
                        textDecoration: 'underline' }}>
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {/* Teacher - Google only */}
              {userType === 'teacher' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{
                    background: 'linear-gradient(135deg,#FFFBF0,#FEF3C7)',
                    border: '1px solid #FDE68A',
                    borderRadius: 12, padding: '14px 16px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 3px' }}>
                      Teachers sign in with Gmail
                    </p>
                    <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
                      Use your school-registered Google account
                    </p>
                  </div>
                  <button
                    onClick={() => handleGoogleSignIn(true)}
                    disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: '13px', background: loading ? '#FDBA74' : 'linear-gradient(135deg,#F97316,#FB923C)',
                      border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                      color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'opacity 0.2s',
                      boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
                    }}
                    onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
                    onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  >
                    {loading
                      ? <div style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      : <GoogleIcon />
                    }
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                  </button>
                  {loading && (
                    <button onClick={handleCancelSignIn}
                      style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', background: 'none',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px',
                        textDecoration: 'underline' }}>
                      Cancel
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 20, lineHeight: 1.6 }}>
            {userType === 'student'
              ? 'First time? Sign in with Google to create your account.'
              : 'Any Google account signed in via Teacher tab becomes a teacher.'}
          </p>
        </div>
      </div>

      {/* -- CSS for responsive two-column ------------------ */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (min-width: 900px) {
          .login-left { display: flex !important; }
          .login-mobile-logo { display: none !important; }
        }

        @media (max-width: 899px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  )
}



// Suspense wrapper required because LoginPageInner uses useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'linear-gradient(135deg,#B45309,#E8971F)' }}>
        <div style={{ width: 44, height: 44, border: '4px solid rgba(255,255,255,0.3)',
          borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}
