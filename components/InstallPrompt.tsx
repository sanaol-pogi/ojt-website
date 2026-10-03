'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow]         = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isIOS, setIsIOS]       = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA → hide completely
    if (window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
      setIsInstalled(true)
      return
    }

    // iOS detection
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream
    if (ios) {
      setIsIOS(true)
      setShow(true)
      return
    }

    // Android / Chrome — capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Fallback: show button after 2s even without the event
    // (handles Chrome that already dismissed it but app is not installed)
    const t = setTimeout(() => {
      // Only show fallback if not already installed
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShow(true)
      }
    }, 2000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(t)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShow(false)
      }
      setDeferredPrompt(null)
      setExpanded(false)
    } else {
      // No prompt available — open instructions
      setExpanded(v => !v)
    }
  }

  if (isInstalled || !show) return null

  return (
    <>
      <style>{`
        @keyframes installIn { from{opacity:0;transform:scale(0.7) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes installExpand { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      {/* Floating install button — always visible bottom-left */}
      <div style={{
        position: 'fixed', bottom: 80, left: 16, zIndex: 9990,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
      }}>

        {/* Expanded panel */}
        {expanded && (
          <div style={{
            background: 'white', borderRadius: 18,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(249,115,22,0.12)',
            padding: '18px 20px', width: 'min(290px, calc(100vw - 48px))',
            animation: 'installExpand 0.28s cubic-bezier(0.34,1.3,0.64,1) both',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-72.png" alt="App"
                style={{ width: 40, height: 40, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
              <div>
                <p style={{ fontWeight: 800, fontSize: 13, color: '#1C1917', margin: 0 }}>Install Work Immersion</p>
                <p style={{ fontSize: 11, color: '#78716C', margin: 0 }}>Add to Home Screen</p>
              </div>
            </div>

            {isIOS ? (
              <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7,
                background: '#FFFBF0', borderRadius: 10, padding: '10px 12px',
                border: '1px solid #FDE68A' }}>
                <p style={{ fontWeight: 700, margin: '0 0 4px' }}>To install on iOS:</p>
                <ol style={{ margin: 0, paddingLeft: 16 }}>
                  <li>Tap <strong>Share ⬆</strong> in Safari</li>
                  <li>Tap <strong>"Add to Home Screen"</strong></li>
                  <li>Tap <strong>"Add"</strong></li>
                </ol>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#78716C', lineHeight: 1.6,
                background: '#FFF8F0', borderRadius: 10, padding: '10px 12px',
                border: '1px solid #FFE4C4' }}>
                <p style={{ margin: 0 }}>
                  In Chrome, tap the <strong>⋮ menu</strong> → <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
                </p>
              </div>
            )}

            {/* Install button (Android only when prompt available) */}
            {!isIOS && deferredPrompt && (
              <button onClick={handleInstall}
                style={{ marginTop: 12, width: '100%', padding: '11px',
                  background: 'linear-gradient(135deg,#F97316,#FB923C)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Install App
              </button>
            )}
          </div>
        )}

        {/* The floating pill button */}
        <button
          onClick={deferredPrompt ? handleInstall : () => setExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg,#F97316,#FB923C)',
            color: 'white', border: 'none', borderRadius: 999,
            padding: '10px 16px 10px 12px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(249,115,22,0.45)',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            animation: 'installIn 0.4s cubic-bezier(0.34,1.5,0.64,1) both',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(249,115,22,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(249,115,22,0.45)' }}
          title="Install App"
        >
          <svg style={{ width: 18, height: 18, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Install App
        </button>
      </div>
    </>
  )
}
