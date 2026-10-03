import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/narratives/[id]/download
 * Returns the full narrative as a downloadable HTML file styled as a professional document.
 * The browser will download it; students/teachers can print to PDF or save as HTML.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id } = await params

    const narrative = await prisma.narrative.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            name: true, studentId: true, email: true,
            company: true, gradeLevel: true,
            strand:  { select: { name: true } },
            section: { select: { name: true } },
            supervisor: { select: { name: true } },
          },
        },
        photos: { select: { url: true, uploadedAt: true, isVerified: true } },
      },
    })

    if (!narrative) {
      return new NextResponse('Narrative not found', { status: 404 })
    }

    // Authorization: student can only download their own
    if (session.user.role === 'student') {
      const student = await prisma.student.findUnique({
        where: { email: session.user.email }, select: { id: true },
      })
      if (!student || narrative.studentId !== student.id) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const s = narrative.student
    // SECURITY: escape all student fields injected into HTML
    const esc = (v: string | null | undefined) =>
      (v ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

    const submissionDateStr = narrative.submissionDate
      ? new Date(narrative.submissionDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : new Date(narrative.createdAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })

    const narrativeDateStr = new Date(narrative.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    // Format the content — HTML-escape first, then convert markdown bold to HTML
    // SECURITY: escapeHtml prevents XSS from user-generated content
    const escapeHtml = (str: string) =>
      str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;')

    const formatContent = (text: string) =>
      escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')

    const content = formatContent(narrative.content)

    // Verification photo HTML — iOS Safari compatible
    // base64 data URLs in downloaded HTML are blocked on iOS; use blob URL via script
    const photo = narrative.photos.length > 0 ? narrative.photos[0] : null
    const verificationPhotoHtml = photo
      ? (() => {
          const captureDate = new Date(photo.uploadedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })
          // If it's a data URL, embed via script for iOS compatibility
          const isDataUrl = photo.url.startsWith('data:')
          if (isDataUrl) {
            // Extract MIME type and base64 data
            const mimeMatch = photo.url.match(/^data:([^;]+);base64,/)
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
            // Validate MIME type — only allow image types to prevent script injection
            const safeMime = /^image\/(jpeg|jpg|png|gif|webp)$/.test(mime) ? mime : 'image/jpeg'
            const b64 = photo.url.split(',')[1] ?? ''
            // SECURITY: JSON.stringify safely escapes the base64 string — no quote injection
            return `
              <div class="section">
                <h2 class="section-title">Verification Photo</h2>
                <div style="text-align:center; margin:20px 0;">
                  <img id="verif-photo" alt="Verification Photo"
                    style="max-width:100%;width:400px;max-height:400px;border:2px solid #e5e7eb;border-radius:8px;display:block;margin:0 auto;" />
                  <p style="margin-top:8px;color:#6b7280;font-size:12px;">Captured on ${captureDate}</p>
                </div>
              </div>
              <script>
                (function(){
                  try {
                    var b64=${JSON.stringify(b64)};
                    var mime=${JSON.stringify(safeMime)};
                    var bin=atob(b64);
                    var arr=new Uint8Array(bin.length);
                    for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
                    var blob=new Blob([arr],{type:mime});
                    var url=URL.createObjectURL(blob);
                    var img=document.getElementById('verif-photo');
                    if(img){img.src=url;}
                  }catch(e){
                    console.warn('Photo load failed', e);
                  }
                })();
              <\/script>`
          }
          // Regular URL — just use it directly
          return `
            <div class="section">
              <h2 class="section-title">Verification Photo</h2>
              <div style="text-align:center; margin:20px 0;">
                <img src="${photo.url}" alt="Verification Photo"
                  style="max-width:100%;width:400px;max-height:400px;border:2px solid #e5e7eb;border-radius:8px;" />
                <p style="margin-top:8px;color:#6b7280;font-size:12px;">Captured on ${captureDate}</p>
              </div>
            </div>`
        })()
      : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Work Immersion Narrative — ${esc(s?.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #111;
      background: white;
    }
    .page {
      max-width: 816px;
      margin: 0 auto;
      padding: 48px 32px 72px;
    }
    .school-header {
      text-align: center;
      border-bottom: 3px double #1a1a1a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .school-name {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .school-subtitle { font-size: 10pt; color: #555; margin-top: 4px; }
    .doc-title {
      text-align: center;
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 20px 0 24px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      margin-bottom: 24px;
      border: 1px solid #ccc;
      padding: 14px 18px;
      background: #fafafa;
    }
    .info-row { display: flex; gap: 8px; align-items: flex-start; }
    .info-label { font-weight: bold; white-space: nowrap; min-width: 100px; font-size: 10pt; }
    .info-value { color: #333; font-size: 10pt; }
    .section { margin-bottom: 22px; }
    .section-title {
      font-size: 11pt; font-weight: bold; text-transform: uppercase;
      letter-spacing: 1px; border-bottom: 1px solid #aaa;
      padding-bottom: 4px; margin-bottom: 10px;
    }
    .content-body { text-align: justify; }
    .content-body p { margin-bottom: 10px; text-indent: 28px; font-size: 11pt; }
    .footer {
      margin-top: 40px; border-top: 1px solid #ccc;
      padding-top: 14px; text-align: center;
      font-size: 9pt; color: #888;
    }
    .status-badge {
      display: inline-block; padding: 3px 10px; border-radius: 4px;
      font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
    }
    .status-approved  { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .status-pending   { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .status-revision  { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }

    /* ── Mobile responsive ── */
    @media (max-width: 600px) {
      .page { padding: 24px 16px 40px; }
      .doc-title { font-size: 13pt; letter-spacing: 1px; }
      .school-name { font-size: 12pt; }
      .info-grid {
        grid-template-columns: 1fr;
        padding: 12px 14px;
        gap: 6px;
      }
      .info-label { min-width: 90px; }
      .content-body p { text-indent: 16px; font-size: 10.5pt; }
      body { font-size: 11pt; }
      img { max-width: 100% !important; }
    }
    @media print {
      .page { padding: 36px 36px 56px; }
      body { font-size: 11pt; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="school-header">
      <div class="school-name">Paete Science and Business College Inc.</div>
      <div class="school-subtitle">Paete, Laguna</div>
      <div class="school-subtitle" style="margin-top:4px">Senior High School — Work Immersion Program</div>
    </div>

    <div class="doc-title">Daily Narrative Report</div>

    <div class="info-grid">
      <div class="info-row">
        <span class="info-label">Student Name:</span>
        <span class="info-value">${esc(s?.name)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Student ID:</span>
        <span class="info-value">${esc(s?.studentId)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Grade Level:</span>
        <span class="info-value">${s?.gradeLevel ? `Grade ${Number(s.gradeLevel)}` : '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Strand:</span>
        <span class="info-value">${esc(s?.strand?.name)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Section:</span>
        <span class="info-value">${esc(s?.section?.name)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Company/Office:</span>
        <span class="info-value">${esc(s?.company)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Supervisor:</span>
        <span class="info-value">${esc(s?.supervisor?.name)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Activity Date:</span>
        <span class="info-value">${narrativeDateStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Submitted On:</span>
        <span class="info-value">${submissionDateStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value">
          <span class="status-badge status-${
            narrative.status === 'approved' ? 'approved' :
            narrative.status === 'revision_requested' ? 'revision' : 'pending'
          }">
            ${narrative.status === 'approved' ? 'Approved' :
              narrative.status === 'revision_requested' ? 'Revision Requested' : 'Pending Review'}
          </span>
        </span>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Narrative</h2>
      <div class="content-body">
        <p>${content}</p>
      </div>
    </div>

    ${verificationPhotoHtml}

    <div class="footer">
      <p>Generated by PSBC Work Immersion Portal &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="margin-top:4px">This document is an official record of the student's Work Immersion activity.</p>
    </div>
  </div>
</body>
</html>`

    const filename = `Narrative_${(s?.name ?? 'Student').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${narrativeDateStr.replace(/\s+/g, '_')}.html`

    return new NextResponse(html, {
      headers: {
        'Content-Type':        'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Download narrative error:', error)
    return new NextResponse('Failed to generate document', { status: 500 })
  }
}
