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
// Export PDF (text-based print flow)
// ---------------------------------------------------------------------------

const PRINT_CONTAINER_ID = 'perfectmd-print-root'
const PRINT_STYLE_ID = 'perfectmd-print-style'

const PRINT_CSS = `
@page {
  size: A4;
  margin: 18mm 15mm 18mm 15mm;
}

body.pmd-printing > *:not(#${PRINT_CONTAINER_ID}) {
  display: none !important;
}

body.pmd-printing {
  margin: 0 !important;
  background: #fff !important;
}

#${PRINT_CONTAINER_ID} {
  display: block !important;
  color: #1e2733 !important;
  font-size: 13.5px !important;
  line-height: 1.68 !important;
  font-family:
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
    'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
    'Helvetica Neue', Arial, sans-serif !important;
}

#${PRINT_CONTAINER_ID} * {
  text-shadow: none !important;
  box-shadow: none !important;
}

#${PRINT_CONTAINER_ID} p {
  margin: 0 0 0.72em !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #1e2733 !important;
}

#${PRINT_CONTAINER_ID} h1,
#${PRINT_CONTAINER_ID} h2,
#${PRINT_CONTAINER_ID} h3,
#${PRINT_CONTAINER_ID} h4,
#${PRINT_CONTAINER_ID} h5,
#${PRINT_CONTAINER_ID} h6 {
  margin: 1.05em 0 0.42em !important;
  padding: 0 !important;
  border: 0 !important;
  color: #132031 !important;
  line-height: 1.34 !important;
  background: transparent !important;
}

#${PRINT_CONTAINER_ID} h1 { font-size: 2.0em !important; }
#${PRINT_CONTAINER_ID} h2 { font-size: 1.62em !important; }
#${PRINT_CONTAINER_ID} h3 { font-size: 1.33em !important; }
#${PRINT_CONTAINER_ID} h4 { font-size: 1.15em !important; }
#${PRINT_CONTAINER_ID} h5 { font-size: 1.04em !important; }
#${PRINT_CONTAINER_ID} h6 { font-size: 1em !important; }

#${PRINT_CONTAINER_ID} ul,
#${PRINT_CONTAINER_ID} ol {
  margin: 0.35em 0 0.72em !important;
  padding-left: 1.45em !important;
}

#${PRINT_CONTAINER_ID} li {
  margin: 0.2em 0 !important;
}

#${PRINT_CONTAINER_ID} pre {
  margin: 0.58em 0 0.9em !important;
  padding: 0.62em 0.72em !important;
  border: 1px solid #d3d9e0 !important;
  border-radius: 6px !important;
  background: #f8fafc !important;
  color: #1f2937 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  font-size: 12px !important;
  line-height: 1.5 !important;
  page-break-inside: avoid !important;
}

#${PRINT_CONTAINER_ID} code {
  font-family: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace !important;
  font-size: 0.95em !important;
}

#${PRINT_CONTAINER_ID} blockquote {
  margin: 0.62em 0 0.86em !important;
  padding: 0.22em 0 0.22em 0.8em !important;
  border-left: 3px solid #c5cfda !important;
  background: #f8fafc !important;
  color: #475569 !important;
}

#${PRINT_CONTAINER_ID} table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 0.65em 0 0.95em !important;
  table-layout: fixed !important;
  page-break-inside: avoid !important;
}

#${PRINT_CONTAINER_ID} th,
#${PRINT_CONTAINER_ID} td {
  border: 1px solid #cfd6de !important;
  padding: 6px 8px !important;
  text-align: left !important;
  vertical-align: top !important;
  overflow-wrap: anywhere !important;
}

#${PRINT_CONTAINER_ID} th {
  background: #eef2f6 !important;
  font-weight: 600 !important;
}

#${PRINT_CONTAINER_ID} hr {
  border: 0 !important;
  border-top: 1px solid #d5dde6 !important;
  margin: 1.2em 0 !important;
}

#${PRINT_CONTAINER_ID} .formula-inline {
  border: 0 !important;
  background: transparent !important;
  padding: 0 !important;
}

#${PRINT_CONTAINER_ID} .katex {
  font-size: 1em !important;
}

#${PRINT_CONTAINER_ID} .katex-display {
  margin: 0.45em 0 !important;
  overflow-x: auto !important;
}

#${PRINT_CONTAINER_ID} .code-controls,
#${PRINT_CONTAINER_ID} .code-copy-btn,
#${PRINT_CONTAINER_ID} .code-copy-toast,
#${PRINT_CONTAINER_ID} [data-code-lang-select] {
  display: none !important;
}
`

function createPrintDom(content: string): { root: HTMLElement; style: HTMLStyleElement } {
  const existingRoot = document.getElementById(PRINT_CONTAINER_ID)
  if (existingRoot) existingRoot.remove()
  const existingStyle = document.getElementById(PRINT_STYLE_ID)
  if (existingStyle) existingStyle.remove()

  const style = document.createElement('style')
  style.id = PRINT_STYLE_ID
  style.textContent = PRINT_CSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = PRINT_CONTAINER_ID
  root.innerHTML = content
  root.querySelectorAll('.code-controls, .code-copy-btn, .code-copy-toast, [data-code-lang-select]').forEach((el) => el.remove())
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'))
  document.body.appendChild(root)

  return { root, style }
}

function cleanupPrintDom(root?: HTMLElement | null, style?: HTMLStyleElement | null): void {
  document.body.classList.remove('pmd-printing')
  if (root && root.parentNode) root.remove()
  if (style && style.parentNode) style.remove()
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
  let style: HTMLStyleElement | null = null
  try {
    const dom = createPrintDom(content)
    root = dom.root
    style = dom.style
    document.body.classList.add('pmd-printing')

    await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
    window.print()
    return 'saved'
  } catch {
    return 'fallback'
  } finally {
    document.title = prevTitle
    cleanupPrintDom(root, style)
  }
}
