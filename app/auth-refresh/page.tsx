'use client'

import { useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * /auth-refresh?dest=/teacher/dashboard
 *
 * After finalize switches the DB record, we land here.
 * We call session.update({ refreshRole: true }) which triggers the jwt callback
 * to clear the cached role and re-read from DB, then navigate to the dashboard.
 */
function AuthRefreshInner() {
  const { update, data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dest = searchParams.get('dest') ?? '/dashboard'

  useEffect(() => {
    if (status === 'loading') return

    // Force JWT to re-read role from DB by triggering an update
    update({ refreshRole: true }).then(() => {
      // Navigate to destination — the updated token now has the correct role
      router.replace(dest)
    }).catch(() => {
      router.replace(dest)
    })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF8F0, #FDE68A)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 44, height: 44, border: '4px solid rgba(249,115,22,0.2)',
          borderTopColor: '#F97316', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ color: '#92400E', fontSize: 14, fontWeight: 600, margin: 0 }}>
          Setting up your account...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function AuthRefreshPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#FFF8F0' }}>
        <div style={{ width: 44, height: 44, border: '4px solid #FDE68A',
          borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <AuthRefreshInner />
    </Suspense>
  )
}
