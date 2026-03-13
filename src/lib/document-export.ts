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
// Export PDF
// ---------------------------------------------------------------------------

const PDF_RENDER_STYLE = `
  .pdf-export-root {
    box-sizing: border-box;
    width: 680px;
    background: #fff;
    color: #1c2430;
    padding: 0;
    font-size: 13.5px;
    line-height: 1.62;
    font-family:
      'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
      'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
      'Helvetica Neue', Arial, sans-serif;
  }
  .pdf-export-root * {
    text-shadow: none !important;
    box-shadow: none !important;
  }
  .pdf-export-root p {
    margin: 0 0 0.72em;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    color: #1c2430 !important;
  }
  .pdf-export-root h1, .pdf-export-root h2, .pdf-export-root h3,
  .pdf-export-root h4, .pdf-export-root h5, .pdf-export-root h6 {
    color: #16212d !important;
    background: transparent !important;
    border: 0 !important;
    padding: 0 !important;
    margin: 1.05em 0 0.42em;
    line-height: 1.35;
  }
  .pdf-export-root h1 { font-size: 2.02em; }
  .pdf-export-root h2 { font-size: 1.62em; }
  .pdf-export-root h3 { font-size: 1.34em; }
  .pdf-export-root h4 { font-size: 1.16em; }
  .pdf-export-root h5 { font-size: 1.05em; }
  .pdf-export-root h6 { font-size: 1em; }
  .pdf-export-root ul, .pdf-export-root ol {
    margin: 0.38em 0 0.66em;
    padding-left: 1.4em;
  }
  .pdf-export-root li {
    margin: 0.18em 0;
  }
  .pdf-export-root pre {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 10px 12px;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    margin: 0.55em 0 0.78em;
  }
  .pdf-export-root code {
    font-family: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 0.95em;
  }
  .pdf-export-root blockquote {
    margin: 0.6em 0 0.8em;
    border-left: 3px solid #c7d0d9;
    padding: 0.2em 0 0.2em 0.8em;
    color: #4c5a6a;
    background: #f8fafc;
  }
  .pdf-export-root table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.65em 0 0.95em;
  }
  .pdf-export-root th, .pdf-export-root td {
    border: 1px solid #ccc;
    padding: 6px 8px;
    text-align: left;
  }
  .pdf-export-root th {
    background: #eef2f6 !important;
  }
  .pdf-export-root hr {
    border: none;
    border-top: 1px solid #d5dee8;
    margin: 1.2em 0;
  }
  .pdf-export-root .formula-inline {
    border: 0 !important;
    background: transparent !important;
    padding: 0 !important;
  }
  .pdf-export-root .code-controls,
  .pdf-export-root .code-copy-btn,
  .pdf-export-root .code-copy-toast,
  .pdf-export-root [data-code-lang-select],
  .pdf-export-root [contenteditable='false'] {
    display: none !important;
  }
`

function buildPdfRenderContainer(content: string): HTMLElement {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;opacity:0;z-index:-1;'

  const style = document.createElement('style')
  style.textContent = PDF_RENDER_STYLE
  host.appendChild(style)

  const root = document.createElement('div')
  root.className = 'pdf-export-root'
  root.innerHTML = content
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
  const host = buildPdfRenderContainer(content)
  const root = host.querySelector('.pdf-export-root') as HTMLElement | null
  if (!root) {
    host.remove()
    return 'cancelled'
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
    const margin = 42
    const usableWidth = pageWidth - margin * 2
    const usableHeight = pageHeight - margin * 2
    const imageWidth = usableWidth
    const imageHeight = (canvas.height * imageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')

    let heightLeft = imageHeight - usableHeight
    let position = margin
    pdf.addImage(imageData, 'PNG', margin, position, imageWidth, imageHeight, undefined, 'FAST')

    while (heightLeft > 0) {
      position = margin - (imageHeight - usableHeight - heightLeft)
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', margin, position, imageWidth, imageHeight, undefined, 'FAST')
      heightLeft -= usableHeight
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
        // fall through to browser download
      }
    }

    browserDownload(new Blob([binary], { type: 'application/pdf' }), `${safeTitle}.pdf`)
    return 'fallback'
  } finally {
    host.remove()
  }
}
