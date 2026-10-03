'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'

interface Announcement {
  id: string; title: string; content: string; type: string
  targetType: string; expiresAt?: string; createdAt: string
  teacher: { name: string }
}

function isExpiringSoon(expiresAt?: string): boolean {
  if (!expiresAt) return false
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  return days > 0 && days <= 3
}
function isExpired(expiresAt?: string): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() < Date.now()
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  reminder:        { bg: '#DBEAFE', color: '#1E40AF' },
  deadline:        { bg: '#FEE2E2', color: '#991B1B' },
  schedule_change: { bg: '#FEF3C7', color: '#92400E' },
  instruction:     { bg: '#D1FAE5', color: '#065F46' },
  meeting:         { bg: '#EDE9FE', color: '#5B21B6' },
  document:        { bg: '#FFEDD5', color: '#92400E' },
  emergency:       { bg: '#FEE2E2', color: '#991B1B' },
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading,        setLoading]       = useState(true)
  const [apiError,       setApiError]      = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/announcements')
      .then(r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`)
        return r.json()
      })
      .then(d => { if (!cancelled) { setAnnouncements(d.announcements ?? []); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setApiError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #FFEDD5',
          borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    </AppShell>
  )

  if (apiError) return (
    <AppShell>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
          Could not load announcements
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>{apiError}</p>
        <button onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#F97316,#FB923C)',
            color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/dashboard')} style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280',
          background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8, padding: 0, fontFamily: 'inherit',
        }}>
          <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Announcements</h1>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
          {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
        </p>
      </div>

      {announcements.length === 0 ? (
        <div className="reveal" style={{ background: 'white', borderRadius: 16, border: '1px solid #E5E7EB',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '64px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#F3F4F6', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: 28, height: 28, color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No announcements yet</p>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>Important updates from your teachers will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
          {announcements.map(a => {
            const expired  = isExpired(a.expiresAt)
            const expiring = isExpiringSoon(a.expiresAt)
            const tc = TYPE_COLORS[a.type] ?? { bg: '#F3F4F6', color: '#6B7280' }
            const label = a.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            const dateStr = new Date(a.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })
            return (
              <div key={a.id} className="card-entrance card-hover" style={{
                background: a.type === 'emergency' ? '#FFF5F5' : expiring ? '#FFFBEB' : 'white',
                borderRadius: 16,
                border: `1px solid ${a.type === 'emergency' ? '#FECACA' : expiring ? '#FDE68A' : '#E5E7EB'}`,
                padding: '18px 20px', boxSizing: 'border-box',
                opacity: expired ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: 0 }}>{a.title}</h3>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                    background: tc.bg, color: tc.color }}>{label}</span>
                  {expiring && !expired && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: '#FEF3C7', color: '#92400E' }}>Expiring Soon</span>
                  )}
                  {expired && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: '#F3F4F6', color: '#9CA3AF' }}>Expired</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9CA3AF', marginBottom: 10 }}>
                  <span>👤 {a.teacher.name}</span>
                  <span>📅 {dateStr}</span>
                </div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0,
                  whiteSpace: 'pre-wrap' }}>{a.content}</p>
                {a.expiresAt && !expired && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
                    Valid until {new Date(a.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
