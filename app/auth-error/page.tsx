'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback:    'Sign-in failed. Please try again.',
  OAuthSignin:      'Could not start sign-in. Please try again.',
  Callback:         'Sign-in callback failed. Please try again.',
  OAuthCreateAccount: 'Could not create account. Please try again.',
  AccessDenied:     'Access denied.',
  Verification:     'Verification link expired. Please sign in again.',
  Default:          'An unexpected error occurred. Please try again.',
}

function AuthErrorInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error') ?? 'Default'
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF8F0, #FDE68A)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '40px 36px', maxWidth: 420, width: '100%',
        boxShadow: '0 20px 60px rgba(180,83,9,0.12)', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg style={{ width: 28, height: 28, color: '#DC2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
          Sign-in Error
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.6 }}>
          {message}
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #F97316, #FB923C)',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
          }}
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#FFF8F0' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #FDE68A',
          borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <AuthErrorInner />
    </Suspense>
  )
}
