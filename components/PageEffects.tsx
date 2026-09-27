'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * PageEffects
 * Handles: SW registration, scroll progress, scroll-reveal,
 * ripple effects, touch feedback, header glass, page transitions.
 */
export default function PageEffects() {
  const pathname = usePathname()
  const mainRef  = useRef<HTMLElement | null>(null)

  /* ── Register Service Worker (PWA) ─────────────────────── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'activated') window.location.reload()
          })
        })
      })
      .catch(() => {})
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SW_UPDATED') window.location.reload()
    })
  }, [])

  /* ── js-ready class ─────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.classList.add('js-ready')
  }, [])

  /* ── Page transition on route change ─────────────────────
     Uses native View Transitions API when available,
     falls back to CSS class animation.                      */
  const isFirst = useRef(true)
  useEffect(() => {
    // Skip the very first render (initial page load already visible)
    if (isFirst.current) { isFirst.current = false; return }

    const main = document.querySelector('main') ?? document.querySelector('#content-wrapper')
    if (!main) return

    if (!('startViewTransition' in document)) {
      // Fallback: CSS class animation
      main.classList.remove('page-transitioning-in', 'page-transitioning-out')
      void (main as HTMLElement).offsetWidth
      main.classList.add('page-transitioning-in')
      const t = setTimeout(() => main.classList.remove('page-transitioning-in'), 400)
      return () => clearTimeout(t)
    }
    // Native View Transitions — just triggers automatically via CSS
  }, [pathname])

  /* ── Intercept router.push for View Transitions API ──────── */
  useEffect(() => {
    if (!('startViewTransition' in document)) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('#')) return
      e.preventDefault()
      ;(document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => {
          window.history.pushState(null, '', href)
          window.dispatchEvent(new PopStateEvent('popstate'))
        })
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  /* ── Scroll progress bar ─────────────────────────────────── */
  useEffect(() => {
    const bar = document.getElementById('scroll-progress')
    if (!bar) return
    const update = () => {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      bar.style.width = `${total > 0 ? (scrolled / total) * 100 : 0}%`
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  /* ── IntersectionObserver scroll reveal ─────────────────── */
  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
    if (!els.length) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('revealed'), 50)
          obs.unobserve(entry.target)
        }
      })
    }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' })
    els.forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight - 20) setTimeout(() => el.classList.add('revealed'), 100)
      else obs.observe(el)
    })
    return () => obs.disconnect()
  }, [pathname])

  /* ── Ripple effect ───────────────────────────────────────── */
  useEffect(() => {
    const trigger = (clientX: number, clientY: number, target: HTMLElement) => {
      if (target.closest('#page-loader')) return
      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.8
      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${clientX-rect.left-size/2}px;top:${clientY-rect.top-size/2}px;background:rgba(255,255,255,0.22);`
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
      target.style.overflow = 'hidden'
      target.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    }
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest('button,a,[role="button"]') as HTMLElement | null
      if (t) trigger(e.clientX, e.clientY, t)
    }
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0]; if (!touch) return
      const t = (touch.target as HTMLElement).closest('button,a,[role="button"]') as HTMLElement | null
      if (t) trigger(touch.clientX, touch.clientY, t)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('touchstart', onTouch, { passive: true })
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('touchstart', onTouch) }
  }, [])

  /* ── Touch press scale feedback ─────────────────────────── */
  useEffect(() => {
    const SEL = 'button,a,[role="button"],.card-hover,[style*="cursor: pointer"],[style*="cursor:pointer"]'
    const pressed = new WeakSet<Element>()

    const onStart = (e: TouchEvent) => {
      const t = (e.target as HTMLElement).closest(SEL) as HTMLElement | null
      if (!t || pressed.has(t)) return
      pressed.add(t)
      t.dataset.origTransform = t.style.transform || ''
      t.style.transition = 'transform 0.1s ease, opacity 0.1s ease'
      t.style.transform  = 'scale(0.95)'
      t.style.opacity    = '0.82'
    }
    const onEnd = (e: TouchEvent | MouseEvent) => {
      const src = 'changedTouches' in e
        ? (e as TouchEvent).changedTouches[0]?.target
        : (e as MouseEvent).target
      const t = (src as HTMLElement)?.closest?.(SEL) as HTMLElement | null
      if (!t) return
      pressed.delete(t)
      t.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease'
      t.style.transform  = t.dataset.origTransform ?? ''
      t.style.opacity    = '1'
    }

    document.addEventListener('touchstart',  onStart, { passive: true })
    document.addEventListener('touchend',    onEnd as EventListener,   { passive: true })
    document.addEventListener('touchcancel', onEnd as EventListener,   { passive: true })
    return () => {
      document.removeEventListener('touchstart',  onStart)
      document.removeEventListener('touchend',    onEnd as EventListener)
      document.removeEventListener('touchcancel', onEnd as EventListener)
    }
  }, [])

  /* ── Header glass on scroll ──────────────────────────────── */
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const onScroll = () => {
      header.classList.toggle('header-scrolled', window.scrollY > 20)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  return (
    <>
      <div id="scroll-progress" aria-hidden="true" />
    </>
  )
}


  /* ── Register Service Worker (PWA) ─────────────────────── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        // When a new SW takes over, reload the page to get fresh JS/CSS
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') window.location.reload()
          })
        })
      })
      .catch(() => { /* SW not critical */ })

    // Also reload if the SW sends us an SW_UPDATED message
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SW_UPDATED') window.location.reload()
    })
  }, [])
  useEffect(() => {
    // Mark JS as ready — enables scroll-reveal hiding
    document.documentElement.classList.add('js-ready')
  }, [])

  /* ── Page-enter animation on route change ────────────── */
  useEffect(() => {
    // Apply entrance animation to the outermost content wrapper
    const wrapper = document.getElementById('content-wrapper')
    if (!wrapper) return
    wrapper.style.animation = 'none'
    void wrapper.offsetWidth
    wrapper.style.animation = 'blurIn 0.4s cubic-bezier(0.16,1,0.3,1) both'
  }, [pathname])

  /* ── Scroll progress bar ─────────────────────────────── */
  useEffect(() => {
    const bar = document.getElementById('scroll-progress')
    if (!bar) return
    const update = () => {
      const scrolled = window.scrollY
      const total    = document.documentElement.scrollHeight - window.innerHeight
      const pct      = total > 0 ? (scrolled / total) * 100 : 0
      bar.style.width = `${pct}%`
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  /* ── IntersectionObserver scroll reveal ─────────────── */
  useEffect(() => {
    const revealEls = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-scale'
    )
    if (!revealEls.length) return

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Small delay to ensure layout is stable
            setTimeout(() => {
              entry.target.classList.add('revealed')
            }, 50)
            obs.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    )

    revealEls.forEach(el => {
      // Elements already in viewport get revealed immediately
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight - 20) {
        setTimeout(() => el.classList.add('revealed'), 100)
      } else {
        obs.observe(el)
      }
    })
    return () => obs.disconnect()
  }, [pathname])

  /* ── Ripple effect ───────────────────────────────────── */
  useEffect(() => {
    const triggerRipple = (clientX: number, clientY: number, target: HTMLElement) => {
      if (target.closest('#page-loader')) return
      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.8
      const x    = clientX - rect.left - size / 2
      const y    = clientY - rect.top  - size / 2
      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      const isDark = ['#F97316','#EA580C','#10B981','#059669','#6366F1','#8B5CF6','#1E293B']
        .some(c => (target.style?.background ?? '').includes(c))
      ripple.style.cssText = `
        width:${size}px; height:${size}px; left:${x}px; top:${y}px;
        background:${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(249,115,22,0.15)'};
      `
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
      target.style.overflow = 'hidden'
      target.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    }

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button, a, [role="button"]') as HTMLElement | null
      if (!target) return
      triggerRipple(e.clientX, e.clientY, target)
    }

    const handleTouch = (e: TouchEvent) => {
      const touch  = e.touches[0]
      if (!touch) return
      const target = (touch.target as HTMLElement).closest('button, a, [role="button"]') as HTMLElement | null
      if (!target) return
      triggerRipple(touch.clientX, touch.clientY, target)
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('touchstart', handleTouch, { passive: true })
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('touchstart', handleTouch)
    }
  }, [])

  /* ── Universal touch press feedback ────────────────────── */
  useEffect(() => {
    // Elements that should animate on press
    const SELECTORS = [
      'button',
      'a',
      '[role="button"]',
      '.card-hover',
      '.card-entrance',
      '.stats-grid > div',
      '.grid-3 > div',
      '.grid-2 > div',
      '[style*="cursor: pointer"]',
      '[style*="cursor:pointer"]',
    ].join(', ')

    const pressed = new WeakSet<Element>()

    const onStart = (e: TouchEvent) => {
      const target = (e.target as HTMLElement).closest(SELECTORS) as HTMLElement | null
      if (!target || pressed.has(target)) return
      pressed.add(target)

      // Store original transform
      const orig = target.style.transform || ''
      target.dataset.origTransform = orig
      target.style.transition = 'transform 0.1s cubic-bezier(0.4,0,0.2,1), opacity 0.1s ease'
      target.style.transform  = 'scale(0.94)'
      target.style.opacity    = '0.82'
    }

    const onEnd = (e: TouchEvent | MouseEvent) => {
      const src = 'changedTouches' in e
        ? (e as TouchEvent).changedTouches[0]?.target
        : (e as MouseEvent).target
      const target = (src as HTMLElement)?.closest?.(SELECTORS) as HTMLElement | null
      if (!target) return
      pressed.delete(target)

      const orig = target.dataset.origTransform ?? ''
      target.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease'
      target.style.transform  = orig
      target.style.opacity    = '1'
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend',   onEnd,   { passive: true })
    document.addEventListener('touchcancel',onEnd,   { passive: true })
    // Also handle mouse for desktop
    document.addEventListener('mousedown', (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(SELECTORS) as HTMLElement | null
      if (!target) return
      target.dataset.origTransform = target.style.transform || ''
      target.style.transition = 'transform 0.08s ease, opacity 0.08s ease'
      target.style.transform  = 'scale(0.96)'
      target.style.opacity    = '0.88'
    })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('mouseleave', onEnd, true)

    return () => {
      document.removeEventListener('touchstart',  onStart)
      document.removeEventListener('touchend',    onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const onScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add('header-scrolled')
      } else {
        header.classList.remove('header-scrolled')
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  return (
    <>
      {/* ── Scroll progress bar ───────── */}
      <div id="scroll-progress" aria-hidden="true" />
      {/* Page loader removed — no loading screen on open */}
    </>
  )
}
