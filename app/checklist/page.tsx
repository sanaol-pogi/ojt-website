'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'

interface ChecklistItem {
  id: string; title: string; description?: string; order: number
  requirementType: string; isRequired: boolean; targetCount?: number
  progress: { status: string; completedCount: number; completedAt?: string; notes?: string }
}
interface Checklist {
  id: string; name: string; description?: string
  items: ChecklistItem[]
  stats: { totalItems: number; completedItems: number; progressPercentage: number }
}

export default function ChecklistPage() {
  const router = useRouter()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading,    setLoading]    = useState(true)
  const [apiError,   setApiError]   = useState('')
  const [updating,   setUpdating]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/checklists/my-checklist')
      .then(r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`)
        return r.json()
      })
      .then(d => { if (!cancelled) { setChecklists(d.checklists ?? []); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setApiError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const handleToggle = async (checklistId: string, itemId: string, currentStatus: string) => {
    const done = currentStatus !== 'completed'
    setUpdating(itemId)
    try {
      const res = await fetch('/api/checklists/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItemId: itemId, checklistId, done }),
      })
      if (res.ok) {
        setChecklists(prev => prev.map(cl => {
          if (cl.id !== checklistId) return cl
          const newItems = cl.items.map(item => {
            if (item.id !== itemId) return item
            return { ...item, progress: { ...item.progress, status: done ? 'completed' : 'pending' } }
          })
          const completed = newItems.filter(i => i.progress.status === 'completed').length
          const total = newItems.length
          return {
            ...cl, items: newItems,
            stats: { ...cl.stats, completedItems: completed, progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0 },
          }
        }))
      }
    } catch { /* silent */ }
    finally { setUpdating(null) }
  }

  const statusIcon = (status: string) => {
    if (status === 'completed') return (
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10B981',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg style={{ width: 14, height: 14, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
    if (status === 'in_progress') return (
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F59E0B',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg style={{ width: 12, height: 12, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
    return (
      <div style={{ width: 24, height: 24, borderRadius: '50%',
        border: '2px solid #D1D5DB', background: 'white', flexShrink: 0 }} />
    )
  }

  if (loading) return (
    <AppShell>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #FFEDD5',
          borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    </AppShell>
  )

  if (apiError) return (
    <AppShell>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
          Could not load your requirements
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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Requirements Checklist</h1>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Track your work immersion requirements</p>
      </div>

      {checklists.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E5E7EB',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '64px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#F3F4F6', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: 28, height: 28, color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No requirements assigned yet</p>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>Your teacher will assign a checklist soon.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {checklists.map(cl => {
            const pct = cl.stats.progressPercentage
            const barColor = pct === 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F97316'
            return (
              <div key={cl.id} style={{ background: 'white', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: 0 }}>{cl.name}</h2>
                      {cl.description && <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{cl.description}</p>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 28, fontWeight: 900, color: '#F97316', lineHeight: 1, margin: 0 }}>{pct}%</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                        {cl.stats.completedItems}/{cl.stats.totalItems} done
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 14, height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor,
                      borderRadius: 999, transition: 'width 0.6s ease' }} />
                  </div>
                </div>

                {/* Items */}
                {cl.items.map((item, idx) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 24px',
                    borderBottom: idx < cl.items.length - 1 ? '1px solid #F9FAFB' : 'none',
                    boxSizing: 'border-box',
                  }}>
                    {/* Checkbox — clickable for non-narrative items */}
                    <button
                      onClick={() => item.requirementType !== 'narrative' && handleToggle(cl.id, item.id, item.progress.status)}
                      disabled={updating === item.id || item.requirementType === 'narrative'}
                      style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        border: item.progress.status === 'completed' ? 'none' : '2px solid #D1D5DB',
                        background: item.progress.status === 'completed' ? '#10B981' : 'white',
                        cursor: item.requirementType === 'narrative' ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, transition: 'all 0.15s',
                        opacity: updating === item.id ? 0.5 : 1,
                      }}>
                      {item.progress.status === 'completed' && (
                        <svg style={{ width: 14, height: 14, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.progress.status === 'in_progress' && (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
                      )}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{item.title}</span>
                        {item.isRequired && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: '#FEE2E2',
                            color: '#DC2626', padding: '2px 8px', borderRadius: 999 }}>Required</span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                          background: item.progress.status === 'completed' ? '#D1FAE5' :
                                      item.progress.status === 'in_progress' ? '#FEF3C7' : '#F3F4F6',
                          color: item.progress.status === 'completed' ? '#065F46' :
                                 item.progress.status === 'in_progress' ? '#92400E' : '#6B7280',
                        }}>
                          {item.progress.status === 'in_progress' ? 'In Progress' :
                           item.progress.status === 'completed' ? 'Done' : 'Pending'}
                        </span>
                      </div>
                      {item.description && (
                        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>{item.description}</p>
                      )}
                      {item.targetCount != null && (
                        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {item.progress.completedCount} / {item.targetCount}
                        </p>
                      )}
                      {item.progress.notes && (
                        <div style={{ marginTop: 6, padding: '6px 10px', background: '#EFF6FF',
                          borderRadius: 8, fontSize: 12, color: '#1E40AF' }}>
                          Note: {item.progress.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          {/* Help */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14,
            padding: '16px 20px', display: 'flex', gap: 12 }}>
            <svg style={{ width: 18, height: 18, color: '#3B82F6', flexShrink: 0, marginTop: 1 }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF', marginBottom: 6 }}>How requirements are tracked</p>
              <ul style={{ fontSize: 12, color: '#1E40AF', paddingLeft: 16, margin: 0, lineHeight: 1.8 }}>
                <li>Narrative-type requirements update automatically</li>
                <li>Documents are verified by your teacher</li>
                <li>Check back regularly to see your progress</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
