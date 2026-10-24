'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useProfilePicture } from '@/components/ProfilePictureContext'

interface Strand  { id: string; name: string }
interface Section { id: string; name: string; gradeLevel: number }
type ToastKind = 'success' | 'error' | 'info'
interface Toast  { id: number; msg: string; kind: ToastKind }

/* ─── Toasts ─────────────────────────────────────────────── */
function Toasts({ list, remove }: { list: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320, width: '100%',
      pointerEvents: 'none' }}>
      {list.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 16px', borderRadius: 12,
          background: t.kind === 'success' ? '#059669' : t.kind === 'error' ? '#DC2626' : '#1E293B',
          color: 'white', fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', pointerEvents: 'auto',
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.msg}</span>
          <button onClick={() => remove(t.id)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      ))}
    </div>
  )
}

/* ─── Avatar ─────────────────────────────────────────────── */
function AvatarPreview({ src, name, size = 88 }: { src?: string | null; name?: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
  if (src && !err) return (
    <div style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
      border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <Image src={src} alt="Profile" width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        unoptimized={src.startsWith('data:')} onError={() => setErr(true)} />
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: 14, flexShrink: 0,
      background: 'linear-gradient(135deg,#F97316,#FBBF24)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 800, fontSize: Math.round(size * 0.34),
      border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      {initials}
    </div>
  )
}

/* ─── Shared styles ──────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB',
  borderRadius: 10, fontSize: '16px', background: 'white', fontFamily: 'inherit',
  boxSizing: 'border-box', color: '#111827', outline: 'none',
  WebkitAppearance: 'none', appearance: 'none',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
}
const card: React.CSSProperties = {
  background: 'linear-gradient(135deg,#FFFFFF,#FFFCF5)', borderRadius: 16, border: '1px solid #FEE9C5',
  padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  boxSizing: 'border-box',
}

/* ─── Page ───────────────────────────────────────────────── */
export default function EditProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const { setPicture: setGlobalPicture } = useProfilePicture()

  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [strands,          setStrands]          = useState<Strand[]>([])
  const [sections,         setSections]         = useState<Section[]>([])
  const [useCustomSection, setUseCustomSection] = useState(false)
  const [customSection,    setCustomSection]    = useState('')
  const [toasts,           setToasts]           = useState<Toast[]>([])
  const [pic,              setPic]              = useState<string | null>(null)
  const [preview,          setPreview]          = useState<string | null>(null)
  const [file,             setFile]             = useState<File | null>(null)
  const [uploading,        setUploading]        = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const counter = useRef(0)

  const [form, setForm] = useState({
    name: '', studentId: '', strandId: '', sectionId: '',
    company: '', course: '', gradeLevel: 12,
  })

  const toast = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = ++counter.current
    setToasts(p => [...p, { id, msg, kind }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    const load = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch('/api/students/profile'),
          fetch('/api/strands'),
        ])
        if (pRes.ok) {
          const { student: s } = await pRes.json()
          setForm({
            name: s.name ?? '', studentId: s.studentId ?? '',
            strandId: s.strandId ?? '', sectionId: s.sectionId ?? '',
            company: s.company ?? '', course: s.course ?? '', gradeLevel: s.gradeLevel ?? 12,
          })
          setPic(s.profilePicture ?? null)
        }
        if (sRes.ok) { const { strands: ss } = await sRes.json(); setStrands(ss ?? []) }
      } catch { toast('Failed to load profile', 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [session, toast])

  useEffect(() => {
    if (!form.strandId) { setSections([]); return }
    fetch(`/api/sections?strandId=${form.strandId}`)
      .then(r => r.json()).then(d => setSections(d.sections ?? [])).catch(() => {})
  }, [form.strandId])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) {
      toast('Use JPG, PNG, WebP or GIF', 'error'); return
    }
    if (f.size > 2 * 1024 * 1024) { toast('Max 2 MB', 'error'); return }
    setFile(f)
    const r = new FileReader()
    r.onload = ev => setPreview(ev.target?.result as string)
    r.readAsDataURL(f)
  }

  const uploadPic = async () => {
    if (!file) return; setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/students/profile-picture', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPic(data.profilePicture); setPreview(null); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setGlobalPicture(data.profilePicture, session?.user?.email ?? undefined)  // instant header update, scoped by email
      await updateSession({ profilePicture: data.profilePicture })
      toast('Photo updated!', 'success')
      router.refresh()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  const removePic = async () => {
    setUploading(true)
    try {
      const res = await fetch('/api/students/profile-picture', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setPic(null); setPreview(null); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setGlobalPicture(null, session?.user?.email ?? undefined)
      await updateSession({ profilePicture: null })
      toast('Photo removed', 'info')
    } catch { toast('Failed to remove', 'error') }
    finally { setUploading(false) }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('Full name required', 'error'); return }
    if (!form.studentId.trim()) { toast('Student ID required', 'error'); return }
    setSaving(true)
    try {
      const body = {
        ...form,
        ...(useCustomSection && customSection.trim()
          ? { sectionId: '', sectionName: customSection.trim() }
          : {}),
      }
      const res = await fetch('/api/students/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Refresh JWT so header name updates immediately
      await updateSession({ name: form.name.trim() }).catch(() => {})
      toast('Profile saved!', 'success')
      const dest = session?.user?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard'
      setTimeout(() => router.push(dest), 1200)
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  const displayPic = preview ?? pic

  if (loading || status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F8FAFC' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #FFEDD5',
        borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Toasts list={toasts} remove={id => setToasts(p => p.filter(t => t.id !== id))} />

      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '32px 16px 64px',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Back */}
          <button onClick={() => router.push(session?.user?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard')} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          }}>
            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Dashboard
          </button>

          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Edit Profile</h1>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Update your personal information and photo.</p>
          </div>

          {/* ── Photo card ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 16 }}>Profile Picture</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <AvatarPreview src={displayPic} name={form.name || session?.user?.name} size={80} />
                {preview && (
                  <span style={{ position: 'absolute', top: -6, right: -6,
                    background: '#F59E0B', color: '#78350F',
                    fontSize: 9, fontWeight: 800, padding: '2px 6px',
                    borderRadius: 999, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                    PREVIEW
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input ref={fileRef} type="file" id="pic-upload"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFile} style={{ display: 'none' }} />

                {!preview ? (
                  <label htmlFor="pic-upload" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 16px', border: '2px dashed #E5E7EB', borderRadius: 10,
                    fontSize: 13, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    Choose a photo
                  </label>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={uploadPic} disabled={uploading} style={{
                      flex: 1, padding: '9px', background: '#F97316', color: 'white',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    }}>
                      {uploading ? 'Saving...' : 'Save Photo'}
                    </button>
                    <button onClick={() => { setPreview(null); setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                      disabled={uploading} style={{
                        flex: 1, padding: '9px', background: 'white', color: '#374151',
                        border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13,
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      Cancel
                    </button>
                  </div>
                )}

                {pic && !preview && (
                  <button onClick={removePic} disabled={uploading} style={{
                    padding: '8px', background: '#FEF2F2', color: '#DC2626',
                    border: '1px solid #FECACA', borderRadius: 8, fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    width: '100%',
                  }}>
                    Remove Photo
                  </button>
                )}
                <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>JPG, PNG, WebP or GIF · Max 2 MB</p>
              </div>
            </div>
          </div>

          {/* ── Info form ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 20 }}>Personal Information</p>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Name + ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lbl}>Full Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="text" value={form.name} required placeholder="Juan Dela Cruz"
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    style={inp}
                    onFocus={e => { e.target.style.borderColor = '#F97316' }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB' }} />
                </div>
                <div>
                  <label style={lbl}>Student ID <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="text" value={form.studentId} required
                    placeholder="Any school ID number"
                    onChange={e => setForm({ ...form, studentId: e.target.value })}
                    style={inp}
                    onFocus={e => { e.target.style.borderColor = '#F97316' }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB' }} />
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>No length limit</p>
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={lbl}>Email Address</label>
                <input type="email" value={session?.user?.email ?? ''} disabled
                  style={{ ...inp, background: '#F9FAFB', color: '#9CA3AF', cursor: 'not-allowed' }} />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Linked to your Google account — cannot be changed.</p>
              </div>

              {/* Grade + Strand */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lbl}>Grade Level</label>
                  <select value={form.gradeLevel}
                    onChange={e => setForm({ ...form, gradeLevel: Number(e.target.value) })}
                    style={inp}>
                    <option value={11}>Grade 11</option>
                    <option value={12}>Grade 12</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Strand</label>
                  <select value={form.strandId}
                    onChange={e => setForm({ ...form, strandId: e.target.value, sectionId: '' })}
                    style={inp}>
                    <option value="">Select strand</option>
                    {strands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Section */}
              <div>
                <label style={lbl}>Section</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <button type="button" onClick={() => setUseCustomSection(false)} style={{
                    padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: !useCustomSection ? '#F97316' : '#F3F4F6',
                    color: !useCustomSection ? 'white' : '#6B7280',
                  }}>Select from List</button>
                  <button type="button" onClick={() => setUseCustomSection(true)} style={{
                    padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: useCustomSection ? '#F97316' : '#F3F4F6',
                    color: useCustomSection ? 'white' : '#6B7280',
                  }}>Type My Section</button>
                </div>
                {!useCustomSection ? (
                  <select value={form.sectionId}
                    onChange={e => setForm({ ...form, sectionId: e.target.value })}
                    disabled={!form.strandId}
                    style={{ ...inp, color: form.sectionId ? '#111827' : '#9CA3AF',
                      background: form.strandId ? 'white' : '#F9FAFB',
                      cursor: form.strandId ? 'pointer' : 'not-allowed' }}>
                    <option value="">{!form.strandId ? 'Select a strand first' : 'Select your section'}</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <>
                    <input type="text" value={customSection}
                      onChange={e => setCustomSection(e.target.value)}
                      placeholder="e.g. Einstein, 12-STEM-1, Section A"
                      disabled={!form.strandId}
                      style={{ ...inp, background: form.strandId ? 'white' : '#F9FAFB' }}
                      onFocus={e => { e.target.style.borderColor = '#F97316' }}
                      onBlur={e => { e.target.style.borderColor = '#E5E7EB' }} />
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                      Students with the same section name are grouped together in the teacher dashboard.
                    </p>
                  </>
                )}
              </div>

              {/* Work Immersion Details */}
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Work Immersion Details
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={lbl}>Company / Establishment</label>
                    <input type="text" value={form.company}
                      onChange={e => setForm({ ...form, company: e.target.value })}
                      placeholder="ABC Company" style={inp}
                      onFocus={e => { e.target.style.borderColor = '#F97316' }}
                      onBlur={e => { e.target.style.borderColor = '#E5E7EB' }} />
                  </div>
                  <div>
                    <label style={lbl}>Course / Program</label>
                    <input type="text" value={form.course}
                      onChange={e => setForm({ ...form, course: e.target.value })}
                      placeholder="e.g. Computer Science" style={inp}
                      onFocus={e => { e.target.style.borderColor = '#F97316' }}
                      onBlur={e => { e.target.style.borderColor = '#E5E7EB' }} />
                  </div>
                </div>
              </div>

              {/* Save + Cancel buttons */}
              <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                <button type="submit" disabled={saving} style={{
                  flex: 2, padding: '14px', background: saving ? '#FED7AA' : '#F97316',
                  color: 'white', border: 'none', borderRadius: 12, fontSize: 15,
                  fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, boxSizing: 'border-box',
                }}>
                  {saving ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '3px solid rgba(255,255,255,0.4)',
                        borderTopColor: 'white', borderRadius: '50%',
                        animation: 'spin 1s linear infinite' }} />
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
                <button type="button" onClick={() => router.push(session?.user?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard')} disabled={saving}
                  style={{
                    flex: 1, padding: '14px', background: 'white', color: '#374151',
                    border: '2px solid #E5E7EB', borderRadius: 12, fontSize: 15,
                    fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </>
  )
}
