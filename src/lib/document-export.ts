/**
 * document-export.ts
 *
 * Utilities for saving/exporting the current document.
 *   - saveAsMarkdown  – saves as .md file via Tauri native dialog, browser download as fallback
 *   - exportAsPdf     – opens the OS print dialog via a hidden iframe so the user can
 *                       "Save as PDF".  This approach:
 *                         • fully supports Chinese / CJK characters (uses system fonts)
 *                         • produces selectable text (not rasterised images)
 *                         • requires NO external dependencies beyond the browser runtime
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

/**
 * Minimal print CSS that:
 *   1. Uses a comprehensive CJK-safe system font stack (no external downloads needed)
 *   2. Strips editor chrome (copy buttons, language selectors, hover controls)
 *   3. Resets colours to black-on-white for a clean printed page
 */
const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  @page { margin: 2cm; size: A4; }

  body {
    font-family:
      'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
      'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
      'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.8;
    color: #111;
    background: #fff;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1 { font-size: 22pt; font-weight: 700; margin: 0 0 14pt; page-break-after: avoid; }
  h2 { font-size: 17pt; font-weight: 600; margin: 18pt 0 10pt; page-break-after: avoid; }
  h3 { font-size: 14pt; font-weight: 600; margin: 14pt 0 8pt; page-break-after: avoid; }
  h4, h5, h6 { font-size: 12pt; font-weight: 600; margin: 10pt 0 6pt; page-break-after: avoid; }

  p { margin: 0 0 8pt; page-break-inside: avoid; }

  pre {
    background: #f5f5f5;
    border: 1pt solid #ddd;
    border-radius: 4pt;
    padding: 8pt 10pt;
    font-family: 'SFMono-Regular', 'Cascadia Code', Consolas, Menlo, monospace;
    font-size: 9pt;
    white-space: pre-wrap;
    word-break: break-all;
    page-break-inside: avoid;
    margin: 6pt 0 10pt;
  }
  code {
    background: #f0f0f0;
    padding: 0 3pt;
    font-family: 'SFMono-Regular', 'Cascadia Code', Consolas, Menlo, monospace;
    font-size: 9pt;
    border-radius: 2pt;
  }
  pre code { background: transparent; padding: 0; font-size: inherit; }

  blockquote {
    border-left: 3pt solid #aaa;
    margin: 8pt 0;
    padding: 4pt 0 4pt 14pt;
    color: #555;
    page-break-inside: avoid;
  }

  table { border-collapse: collapse; width: 100%; margin: 8pt 0; page-break-inside: avoid; }
  th, td { border: 1pt solid #ccc; padding: 5pt 8pt; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }

  ul, ol { padding-left: 18pt; margin: 4pt 0 8pt; }
  li { margin: 2pt 0; }

  a { color: #1155cc; text-decoration: underline; }
  hr { border: none; border-top: 1pt solid #ddd; margin: 12pt 0; }
  img { max-width: 100%; height: auto; page-break-inside: avoid; }

  /* KaTeX math */
  .katex { font-size: 1em !important; }
  .katex-display { margin: 6pt 0; overflow-x: auto; }

  /* Hide editor-only chrome */
  .code-controls,
  .code-copy-btn,
  .code-lang-select,
  .code-copy-toast,
  [data-code-controls],
  [data-code-copy-btn],
  [data-code-lang-select] {
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

/**
 * Export the editor's HTML content as a PDF via the OS's native print dialog.
 * The user can choose the save path and file name inside the dialog itself.
 *
 * Chinese / CJK text is handled correctly because we rely on the WebView's
 * built-in PDF renderer (which uses system fonts), rather than rasterising
 * the content into images.
 */
export function exportAsPdf(content: string, title: string): void {
  const safeTitle = sanitizeFileBaseName(title)

  // Set document title so the OS print dialog pre-fills the filename
  const prevTitle = document.title
  document.title = safeTitle

  const htmlDoc = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(safeTitle)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>${content}</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;visibility:hidden'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    iframe.remove()
    document.title = prevTitle
    return
  }

  iframeDoc.open()
  iframeDoc.write(htmlDoc)
  iframeDoc.close()

  // Give the WebView a moment to lay out the content before printing
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      // ignore – some environments block window.print()
    }

    // Restore original title and clean up the iframe
    document.title = prevTitle
    setTimeout(() => iframe.remove(), 3000)
  }, 700)
}
