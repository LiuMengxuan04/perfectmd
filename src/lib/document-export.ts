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
// Export PDF (isolated text-print flow)
// ---------------------------------------------------------------------------

const PRINT_CSS = `
@page {
  size: A4;
  margin: 18mm 15mm 18mm 15mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
}

.pmd-print-root {
  color: #1e2733;
  font-size: 13.5px;
  line-height: 1.68;
  font-family:
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
    'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
    'Helvetica Neue', Arial, sans-serif;
}

.pmd-print-root * {
  text-shadow: none !important;
  box-shadow: none !important;
}

.pmd-print-root p {
  margin: 0 0 0.72em !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #1e2733 !important;
}

.pmd-print-root h1,
.pmd-print-root h2,
.pmd-print-root h3,
.pmd-print-root h4,
.pmd-print-root h5,
.pmd-print-root h6 {
  margin: 1.05em 0 0.42em !important;
  padding: 0 !important;
  border: 0 !important;
  color: #132031 !important;
  line-height: 1.34 !important;
  background: transparent !important;
}

.pmd-print-root h1 { font-size: 2em !important; }
.pmd-print-root h2 { font-size: 1.62em !important; }
.pmd-print-root h3 { font-size: 1.33em !important; }

.pmd-print-root ul,
.pmd-print-root ol {
  margin: 0.35em 0 0.72em !important;
  padding-left: 1.45em !important;
}

.pmd-print-root pre {
  margin: 0.58em 0 0.9em !important;
  padding: 0.62em 0.72em !important;
  border: 1px solid #d3d9e0 !important;
  border-radius: 6px !important;
  background: #f8fafc !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  font-size: 12px !important;
  line-height: 1.5 !important;
  page-break-inside: avoid !important;
}

.pmd-print-root table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 0.65em 0 0.95em !important;
  table-layout: fixed !important;
  page-break-inside: avoid !important;
}

.pmd-print-root th,
.pmd-print-root td {
  border: 1px solid #cfd6de !important;
  padding: 6px 8px !important;
  text-align: left !important;
  vertical-align: top !important;
  overflow-wrap: anywhere !important;
}

.pmd-print-root th {
  background: #eef2f6 !important;
}

.pmd-print-root .formula-inline {
  border: 0 !important;
  background: transparent !important;
  padding: 0 !important;
}

.pmd-print-root .katex-display {
  margin: 0.45em 0 !important;
}

.pmd-print-root .code-controls,
.pmd-print-root .code-copy-btn,
.pmd-print-root .code-copy-toast,
.pmd-print-root [data-code-lang-select] {
  display: none !important;
}
`

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPrintableHtml(content: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_CSS}</style>
  </head>
  <body>
    <div class="pmd-print-root">${content}</div>
  </body>
</html>`
}

type ExportPdfResult = 'saved' | 'cancelled' | 'fallback'

export async function exportAsPdf(
  content: string,
  title: string,
): Promise<ExportPdfResult> {
  const safeTitle = sanitizeFileBaseName(title)
  const html = buildPrintableHtml(content, safeTitle)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '1024px'
  iframe.style.height = '768px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const cleanup = () => {
    if (iframe.parentNode) iframe.remove()
  }

  try {
    await new Promise<void>((resolve) => {
      const onLoaded = () => resolve()
      iframe.addEventListener('load', onLoaded, { once: true })
      iframe.srcdoc = html
      window.setTimeout(resolve, 400)
    })

    const printWindow = iframe.contentWindow
    if (!printWindow) return 'fallback'
    printWindow.focus()
    printWindow.print()
    return 'saved'
  } catch {
    return 'fallback'
  } finally {
    window.setTimeout(cleanup, 2000)
  }
}
