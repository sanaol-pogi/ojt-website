'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [prompt,     setPrompt]     = useState<BeforeInstallPromptEvent | null>(null)
  const [show,       setShow]       = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed,  setDismissed]  = useState(false)

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return

    // Don't show if user dismissed within last 3 days
    try {
      const ts = localStorage.getItem('install-dismissed')
      if (ts && Date.now() - parseInt(ts) < 3 * 24 * 60 * 60 * 1000) return
    } catch { /* ignore */ }

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
      if (outcome === 'accepted') { setShow(false); return }
    } finally {
      setInstalling(false)
      setPrompt(null)
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShow(false)
    setDismissed(true)
    try { localStorage.setItem('install-dismissed', Date.now().toString()) } catch { /* ignore */ }
  }

  if (!show || dismissed) return null

  return (
    <>
      <style>{`
        @keyframes installSlideIn {
          from { opacity:0; transform:translateY(20px) scale(0.92); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes spinInstall { to { transform:rotate(360deg); } }
      `}</style>

      {/* Fixed bottom-RIGHT so it never overlaps page content */}
      {/* Sits above the HelpButton (which is at bottom:24, right:20) */}
      <div style={{
        position: 'fixed',
        bottom: 88,     /* above HelpButton */
        right: 16,      /* right side — out of content flow */
        zIndex: 9980,
        animation: 'installSlideIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0,
      }}>
        {/* Dismiss × button */}
        <button
          onClick={handleDismiss}
          style={{
            width: 20, height: 20, borderRadius: '50%',
            background: '#1C1917', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 800, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 4, marginRight: 4,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
          aria-label="Dismiss install prompt"
        >×</button>

        {/* Install pill */}
        <button
          onClick={handleInstall}
          disabled={installing}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: installing
              ? 'linear-gradient(135deg,#FDBA74,#FB923C)'
              : 'linear-gradient(135deg,#F97316,#FB923C)',
            color: 'white', border: 'none', borderRadius: 999,
            padding: '10px 16px 10px 12px',
            fontSize: 13, fontWeight: 700,
            cursor: installing ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(249,115,22,0.5)',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            whiteSpace: 'nowrap',
            WebkitTapHighlightColor: 'transparent',
          }}
          title="Install App"
          aria-label="Install app"
        >
          {installing ? (
            <>
              <div style={{
                width: 15, height: 15,
                border: '2.5px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white', borderRadius: '50%',
                animation: 'spinInstall 0.8s linear infinite', flexShrink: 0,
              }} />
              Installing…
            </>
          ) : (
            <>
              <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Install App
            </>
          )}
        </button>
      </div>
    </>
  )
}
