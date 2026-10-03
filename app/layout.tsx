import type { Metadata, Viewport } from "next"
import { SessionProvider } from "@/components/SessionProvider"
import PageEffects from "@/components/PageEffects"
import "./globals.css"

/* ── Metadata ─────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default: "Work Immersion Program",
    template: "%s — Work Immersion Program",
  },
  description:
    "Digital platform for tracking and managing student work immersion experiences — daily narratives, requirements, and progress monitoring.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Work Immersion",
  },
  openGraph: {
    type: "website",
    title: "Work Immersion Program",
    description:
      "Track your work immersion journey — daily narratives, requirements, and more.",
    siteName: "Work Immersion Program",
  },
}

/* ── Viewport ─────────────────────────────────────────────────────────────── */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F97316" },
    { media: "(prefers-color-scheme: dark)",  color: "#EA580C" },
  ],
}

/* ── Root layout ──────────────────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon"             href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased bg-mesh">
        <PageEffects />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
