'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [prompt,      setPrompt]      = useState<BeforeInstallPromptEvent | null>(null)
  const [show,        setShow]        = useState(false)
  const [installing,  setInstalling]  = useState(false)

  useEffect(() => {
    // Already installed as PWA — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setShow(false)
    } finally {
      setInstalling(false)
      setPrompt(null)
    }
  }

  if (!show) return null

  return (
    <>
      <style>{`
        @keyframes installSlideIn {
          from { opacity:0; transform:translateY(8px) scale(0.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
      {/* Simple floating pill — one click installs, no expand panel */}
      <button
        onClick={handleInstall}
        disabled={installing}
        style={{
          position: 'fixed', bottom: 80, left: 16, zIndex: 9990,
          display: 'flex', alignItems: 'center', gap: 8,
          background: installing
            ? 'linear-gradient(135deg,#FDBA74,#FB923C)'
            : 'linear-gradient(135deg,#F97316,#FB923C)',
          color: 'white', border: 'none', borderRadius: 999,
          padding: '10px 18px 10px 12px',
          fontSize: 13, fontWeight: 700, cursor: installing ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 16px rgba(249,115,22,0.45)',
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          animation: 'installSlideIn 0.4s cubic-bezier(0.34,1.5,0.64,1) both',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
          opacity: installing ? 0.8 : 1,
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseEnter={e => {
          if (!installing) {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(249,115,22,0.55)'
          }
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.transform = ''
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(249,115,22,0.45)'
        }}
        title="Install App"
        aria-label="Install app"
      >
        {installing ? (
          <>
            <div style={{
              width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.4)',
              borderTopColor: 'white', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
            Installing...
          </>
        ) : (
          <>
            <svg style={{ width: 17, height: 17, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Install App
          </>
        )}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
