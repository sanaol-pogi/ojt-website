'use client'

import { useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * /auth-refresh?dest=/teacher/dashboard
 *
 * Intermediate page that forces NextAuth to re-read the role from DB
 * by calling update({ refreshRole: true }), then navigates to `dest`.
 *
 * This is needed because the JWT caches the role after first sign-in.
 * After finalize-teacher/student switches the DB record, we land here
 * to bust the cache before the user sees the dashboard.
 */
function AuthRefreshInner() {
  const { update, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dest = searchParams.get('dest') ?? '/dashboard'

  useEffect(() => {
    if (status === 'loading') return

    // Trigger JWT refresh — the jwt callback in auth.ts sets role=pending
    // and userId=undefined when session.refreshRole is true, forcing a DB re-read
    update({ refreshRole: true }).then(() => {
      // Small delay to let the new token propagate, then navigate
      setTimeout(() => router.replace(dest), 300)
    })
  }, [status, update, router, dest])

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
