'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function PageEffects() {
  const pathname = usePathname()
  const isFirst  = useRef(true)

  /* ── Service Worker ──────────────────────────────────────── */
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
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'SW_UPDATED') window.location.reload()
    })
  }, [])

  /* ── js-ready ────────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.classList.add('js-ready')
  }, [])

  /* ── Page transition (CSS fallback) ─────────────────────── */
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    if (typeof document === 'undefined') return
    if ('startViewTransition' in document) return
    const d = document as Document
    const main = d.querySelector<HTMLElement>('main')
    if (!main) return
    main.classList.remove('page-transitioning-in')
    void main.offsetWidth
    main.classList.add('page-transitioning-in')
    const t = setTimeout(() => main.classList.remove('page-transitioning-in'), 400)
    return () => clearTimeout(t)
  }, [pathname])

  /* ── Scroll progress bar ─────────────────────────────────── */
  useEffect(() => {
    const bar = document.getElementById('scroll-progress')
    if (!bar) return
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      bar.style.width = `${total > 0 ? (window.scrollY / total) * 100 : 0}%`
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  /* ── Scroll reveal ───────────────────────────────────────── */
  useEffect(() => {
    const els = document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale')
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
      if (el.getBoundingClientRect().top < window.innerHeight - 20) {
        setTimeout(() => el.classList.add('revealed'), 100)
      } else {
        obs.observe(el)
      }
    })
    return () => obs.disconnect()
  }, [pathname])

  /* ── Ripple effect ───────────────────────────────────────── */
  useEffect(() => {
    const trigger = (x: number, y: number, target: HTMLElement) => {
      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.8
      const el   = document.createElement('span')
      el.className  = 'ripple-effect'
      el.style.cssText = `width:${size}px;height:${size}px;left:${x-rect.left-size/2}px;top:${y-rect.top-size/2}px;background:rgba(255,255,255,0.22);`
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
      target.style.overflow = 'hidden'
      target.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }
    const onC = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest('button,a,[role="button"]') as HTMLElement | null
      if (t) trigger(e.clientX, e.clientY, t)
    }
    const onT = (e: TouchEvent) => {
      const touch = e.touches[0]; if (!touch) return
      const t = (touch.target as HTMLElement).closest('button,a,[role="button"]') as HTMLElement | null
      if (t) trigger(touch.clientX, touch.clientY, t)
    }
    document.addEventListener('click', onC)
    document.addEventListener('touchstart', onT, { passive: true })
    return () => { document.removeEventListener('click', onC); document.removeEventListener('touchstart', onT) }
  }, [])

  /* ── Touch press feedback ────────────────────────────────── */
  useEffect(() => {
    const SEL = 'button,a,[role="button"]'
    const pressed = new WeakSet<Element>()
    const onStart = (e: TouchEvent) => {
      const t = (e.target as HTMLElement).closest(SEL) as HTMLElement | null
      if (!t || pressed.has(t)) return
      pressed.add(t)
      t.dataset.ot = t.style.transform
      t.style.transition = 'transform 0.1s ease,opacity 0.1s ease'
      t.style.transform  = 'scale(0.95)'
      t.style.opacity    = '0.82'
    }
    const onEnd = (e: TouchEvent) => {
      const t = (e.changedTouches[0]?.target as HTMLElement)?.closest?.(SEL) as HTMLElement | null
      if (!t) return
      pressed.delete(t)
      t.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1),opacity 0.2s ease'
      t.style.transform  = t.dataset.ot ?? ''
      t.style.opacity    = '1'
    }
    document.addEventListener('touchstart',  onStart, { passive: true })
    document.addEventListener('touchend',    onEnd,   { passive: true })
    document.addEventListener('touchcancel', onEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart',  onStart)
      document.removeEventListener('touchend',    onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  /* ── Header glass ────────────────────────────────────────── */
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const onScroll = () => header.classList.toggle('header-scrolled', window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  return <div id="scroll-progress" aria-hidden="true" />
}
