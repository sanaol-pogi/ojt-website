'use client'

import Header from './Header'
import HelpButton from './HelpButton'
import InstallPrompt from './InstallPrompt'
import { TutorialProvider } from './tutorial/TutorialContext'
import TutorialOverlay from './tutorial/TutorialOverlay'
import { TutorialAutoStart, TutorialHowToUseButton } from './tutorial/TutorialTrigger'

interface AppShellProps {
  children: React.ReactNode
  strandCode?: string
  forceTeacher?: boolean
  className?: string
}

export default function AppShell({ children, strandCode, forceTeacher, className = '' }: AppShellProps) {
  return (
    <TutorialProvider>
      <TutorialAutoStart />
      <TutorialOverlay />
      <div style={{
        minHeight: '100vh',
        background: '#FFF8F0',
        backgroundImage: [
          'radial-gradient(at 0% 0%,   rgba(251,146,60,0.18) 0, transparent 50%)',
          'radial-gradient(at 100% 0%, rgba(253,186,116,0.14) 0, transparent 50%)',
          'radial-gradient(at 50% 100%,rgba(254,215,170,0.12) 0, transparent 50%)',
        ].join(','),
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Header strandCode={strandCode} forceTeacher={forceTeacher} />
        <main style={{ flex: 1, width: '100%', clipPath: 'inset(0)' }} className={className}>
          <div
            className="dashboard-container"
            style={{
              maxWidth: '1280px',
              marginLeft: 'auto',
              marginRight: 'auto',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '24px',
              paddingBottom: '32px',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            {children}
          </div>
        </main>
        <TutorialHowToUseButton />
        <HelpButton />
        <InstallPrompt />
      </div>
    </TutorialProvider>
  )
}
