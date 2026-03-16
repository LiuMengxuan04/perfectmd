/**
 * document-export.ts
 *
 * Utilities for saving/exporting the current document.
 *   - saveAsMarkdown  – saves as .md file via Tauri native dialog, browser fallback
 *   - exportAsPdf     – renders editor HTML to PDF and saves via native dialog
 */

import { htmlToMarkdown } from './html-to-markdown'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileBaseName(name: string): string {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Untitled'
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function browserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

// ---------------------------------------------------------------------------
// Save As Markdown
// ---------------------------------------------------------------------------

/**
 * Save the current document as a Markdown file.
 * Returns 'saved' when the file was written via Tauri, 'cancelled' when the
 * user dismissed the dialog, or 'fallback' when the browser download was used.
 */
export async function saveAsMarkdown(
  content: string,
  title: string,
): Promise<'saved' | 'cancelled' | 'fallback'> {
  const markdown = htmlToMarkdown(content, title)
  const safeTitle = sanitizeFileBaseName(title)

  if (isTauriRuntime()) {
    try {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ])
      const savePath = await save({
        defaultPath: `${safeTitle}.md`,
        filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }],
      })
      if (!savePath) return 'cancelled'
      await writeTextFile(savePath, markdown)
      return 'saved'
    } catch {
      // Tauri plugins not yet registered or unavailable – fall through to browser
    }
  }

  browserDownload(
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    `${safeTitle}.md`,
  )
  return 'fallback'
}

// ---------------------------------------------------------------------------
// Export PDF (direct file generation)
// ---------------------------------------------------------------------------

const PDF_RENDER_STYLE = `
  .pmd-pdf-root {
    box-sizing: border-box;
    width: 794px;
    background: #fff;
    color: #1e2733;
    font-size: 14px;
    line-height: 1.6;
    font-family:
      'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
      'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
      'Helvetica Neue', Arial, sans-serif;
    padding: 44px 52px;
  }
  .pmd-pdf-root p { margin: 0 0 0.72em; border: 0 !important; background: transparent !important; }
  .pmd-pdf-root h1, .pmd-pdf-root h2, .pmd-pdf-root h3, .pmd-pdf-root h4, .pmd-pdf-root h5, .pmd-pdf-root h6 {
    margin: 1em 0 0.42em;
    border: 0 !important;
    background: transparent !important;
  }
  .pmd-pdf-root pre {
    margin: 0.6em 0 0.9em;
    border: 1px solid #d3d9e0;
    border-radius: 6px;
    padding: 10px 12px;
    background: #f8fafc;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .pmd-pdf-root table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.65em 0 0.95em;
    table-layout: fixed;
  }
  .pmd-pdf-root th, .pmd-pdf-root td {
    border: 1px solid #cfd6de;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  .pmd-pdf-root th { background: #eef2f6; }
  .pmd-pdf-root .formula-inline {
    border: 0 !important;
    background: transparent !important;
    padding: 0 !important;
  }
  .pmd-pdf-root .code-controls,
  .pmd-pdf-root .code-copy-btn,
  .pmd-pdf-root .code-copy-toast,
  .pmd-pdf-root [data-code-lang-select] {
    display: none !important;
  }
`

function createPdfRenderHost(content: string): HTMLElement {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;'
  const style = document.createElement('style')
  style.textContent = PDF_RENDER_STYLE
  host.appendChild(style)

  const root = document.createElement('div')
  root.className = 'pmd-pdf-root'
  root.innerHTML = content
  root.querySelectorAll('.code-controls, .code-copy-btn, .code-copy-toast, [data-code-lang-select]').forEach((el) => el.remove())
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'))
  host.appendChild(root)
  document.body.appendChild(host)
  return host
}

function arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer)
}

type ExportPdfResult = 'saved' | 'cancelled' | 'fallback'

export async function exportAsPdf(
  content: string,
  title: string,
): Promise<ExportPdfResult> {
  const safeTitle = sanitizeFileBaseName(title)
  const host = createPdfRenderHost(content)
  const root = host.querySelector('.pmd-pdf-root') as HTMLElement | null
  if (!root) {
    host.remove()
    return 'fallback'
  }

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])

    const canvas = await html2canvas(root, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4',
      compress: true,
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageWidth = pageWidth
    const imageHeight = (canvas.height * imageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')

    let heightLeft = imageHeight
    let position = 0
    pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight, undefined, 'FAST')
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight, undefined, 'FAST')
      heightLeft -= pageHeight
    }

    const arrayBuffer = pdf.output('arraybuffer') as ArrayBuffer
    const binary = arrayBufferToUint8Array(arrayBuffer)

    if (isTauriRuntime()) {
      try {
        const [{ save }, { writeFile }] = await Promise.all([
          import('@tauri-apps/plugin-dialog'),
          import('@tauri-apps/plugin-fs'),
        ])
        const savePath = await save({
          defaultPath: `${safeTitle}.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
        if (!savePath) return 'cancelled'
        await writeFile(savePath, binary)
        return 'saved'
      } catch {
        // Fall through to browser download.
      }
    }

    browserDownload(new Blob([binary], { type: 'application/pdf' }), `${safeTitle}.pdf`)
    return 'saved'
  } catch {
    return 'fallback'
  } finally {
    host.remove()
  }
}
