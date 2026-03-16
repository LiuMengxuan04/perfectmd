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

const PRINT_ROOT_ID = 'perfectmd-print-root'
const PRINT_STYLE_ID = 'perfectmd-print-style'

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

body.pmd-printing > *:not(#${PRINT_ROOT_ID}) {
  display: none !important;
}

#${PRINT_ROOT_ID}.pmd-print-root {
  color: #1e2733;
  font-size: 13.5px;
  line-height: 1.68;
  font-family:
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
    'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
    'Helvetica Neue', Arial, sans-serif;
}

#${PRINT_ROOT_ID}.pmd-print-root * {
  text-shadow: none !important;
  box-shadow: none !important;
}

#${PRINT_ROOT_ID}.pmd-print-root p {
  margin: 0 0 0.72em !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #1e2733 !important;
}

#${PRINT_ROOT_ID}.pmd-print-root h1,
#${PRINT_ROOT_ID}.pmd-print-root h2,
#${PRINT_ROOT_ID}.pmd-print-root h3,
#${PRINT_ROOT_ID}.pmd-print-root h4,
#${PRINT_ROOT_ID}.pmd-print-root h5,
#${PRINT_ROOT_ID}.pmd-print-root h6 {
  margin: 1.05em 0 0.42em !important;
  padding: 0 !important;
  border: 0 !important;
  color: #132031 !important;
  line-height: 1.34 !important;
  background: transparent !important;
}

#${PRINT_ROOT_ID}.pmd-print-root h1 { font-size: 2em !important; }
#${PRINT_ROOT_ID}.pmd-print-root h2 { font-size: 1.62em !important; }
#${PRINT_ROOT_ID}.pmd-print-root h3 { font-size: 1.33em !important; }

#${PRINT_ROOT_ID}.pmd-print-root ul,
#${PRINT_ROOT_ID}.pmd-print-root ol {
  margin: 0.35em 0 0.72em !important;
  padding-left: 1.45em !important;
}

#${PRINT_ROOT_ID}.pmd-print-root pre {
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

#${PRINT_ROOT_ID}.pmd-print-root table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 0.65em 0 0.95em !important;
  table-layout: fixed !important;
  page-break-inside: avoid !important;
}

#${PRINT_ROOT_ID}.pmd-print-root th,
#${PRINT_ROOT_ID}.pmd-print-root td {
  border: 1px solid #cfd6de !important;
  padding: 6px 8px !important;
  text-align: left !important;
  vertical-align: top !important;
  overflow-wrap: anywhere !important;
}

#${PRINT_ROOT_ID}.pmd-print-root th {
  background: #eef2f6 !important;
}

#${PRINT_ROOT_ID}.pmd-print-root .formula-inline {
  border: 0 !important;
  background: transparent !important;
  padding: 0 !important;
}

#${PRINT_ROOT_ID}.pmd-print-root .katex-display {
  margin: 0.45em 0 !important;
}

#${PRINT_ROOT_ID}.pmd-print-root .code-controls,
#${PRINT_ROOT_ID}.pmd-print-root .code-copy-btn,
#${PRINT_ROOT_ID}.pmd-print-root .code-copy-toast,
#${PRINT_ROOT_ID}.pmd-print-root [data-code-lang-select] {
  display: none !important;
}
`

function setupInPlacePrintDom(content: string): { root: HTMLElement; styleEl: HTMLStyleElement } {
  const oldRoot = document.getElementById(PRINT_ROOT_ID)
  if (oldRoot) oldRoot.remove()
  const oldStyle = document.getElementById(PRINT_STYLE_ID)
  if (oldStyle) oldStyle.remove()

  const styleEl = document.createElement('style')
  styleEl.id = PRINT_STYLE_ID
  styleEl.textContent = PRINT_CSS
  document.head.appendChild(styleEl)

  const root = document.createElement('div')
  root.id = PRINT_ROOT_ID
  root.className = 'pmd-print-root'
  root.innerHTML = content
  root.querySelectorAll('.code-controls, .code-copy-btn, .code-copy-toast, [data-code-lang-select]').forEach((el) => el.remove())
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'))
  document.body.appendChild(root)
  document.body.classList.add('pmd-printing')

  return { root, styleEl }
}

function teardownInPlacePrintDom(root: HTMLElement, styleEl: HTMLStyleElement): void {
  document.body.classList.remove('pmd-printing')
  if (root.parentNode) root.remove()
  if (styleEl.parentNode) styleEl.remove()
}

type ExportPdfResult = 'saved' | 'cancelled' | 'fallback'

export async function exportAsPdf(
  content: string,
  title: string,
): Promise<ExportPdfResult> {
  const safeTitle = sanitizeFileBaseName(title)
  const prevTitle = document.title
  document.title = safeTitle

  let root: HTMLElement | null = null
  let styleEl: HTMLStyleElement | null = null
  try {
    const dom = setupInPlacePrintDom(content)
    root = dom.root
    styleEl = dom.styleEl
    window.print()
    return 'saved'
  } catch {
    return 'fallback'
  } finally {
    document.title = prevTitle
    if (root && styleEl) {
      window.setTimeout(() => teardownInPlacePrintDom(root as HTMLElement, styleEl as HTMLStyleElement), 300)
    }
  }
}
