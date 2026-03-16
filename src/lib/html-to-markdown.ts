/**
 * Convert editor HTML to Markdown while preserving compatibility.
 * - Prioritizes standard markdown syntax for headings/lists/code/links/tables.
 * - Keeps unsupported styles (color/font-size/background) as inline HTML spans.
 * - Preserves code block language and line breaks.
 */

interface StyleInfo {
  color?: string
  backgroundColor?: string
  fontSize?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
}

function parseStyle(styleStr: string): StyleInfo {
  const style: StyleInfo = {}
  const parts = styleStr.split(';').map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    const [key, value] = part.split(':').map((s) => s.trim())
    if (!value) continue
    if (key === 'color') style.color = value
    if (key === 'background-color' || key === 'background') style.backgroundColor = value
    if (key === 'font-size') style.fontSize = value
  }
  return style
}

function normalizeCodeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
}

function normalizeInlineLatex(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  let normalized = trimmed
    .replace(/^\$+/, '')
    .replace(/\$+$/, '')
    .replace(/\r\n?/g, ' ')
    .replace(/\s+/g, ' ')
    // Some serialized HTML may contain escaped backslashes (\\frac); convert
    // command-style double slashes back to single slash for LaTeX.
    .replace(/\\\\([a-zA-Z])/g, '\\$1')
    .replace(/\\\\\{/g, '\\{')
    .replace(/\\\\\}/g, '\\}')
    .replace(/\u200B/g, '')
  return normalized
}

function detectCodeLanguage(source: Element): string {
  const wrapper = source.closest('.code-block-wrapper') as HTMLElement | null
  const dataLang =
    wrapper?.getAttribute('data-code-language') ||
    source.getAttribute('data-language') ||
    source.querySelector('code')?.getAttribute('data-language') ||
    ''
  if (dataLang && dataLang !== 'plaintext') return dataLang.toLowerCase()
  const className = source.className || source.querySelector('code')?.className || ''
  const match = className.match(/language-([a-z0-9_+-]+)/i)
  return (match?.[1] || '').toLowerCase()
}

function applyInlineStyles(text: string, style: StyleInfo): string {
  if (!text) return ''
  const hasColor = style.color && style.color !== 'inherit'
  const hasBg = style.backgroundColor && style.backgroundColor !== 'transparent'
  const hasFontSize = style.fontSize
  if (!hasColor && !hasBg && !hasFontSize) return text
  let styleAttr = ''
  if (hasColor) styleAttr += `color:${style.color};`
  if (hasBg) styleAttr += `background-color:${style.backgroundColor};`
  if (hasFontSize) styleAttr += `font-size:${style.fontSize};`
  return `<span style="${styleAttr}">${text}</span>`
}

function applyTextFormatting(text: string, style: StyleInfo): string {
  if (!text) return ''
  let result = text
  if (style.code) result = `\`${result}\``
  if (style.strikethrough) result = `~~${result}~~`
  if (style.underline) result = `<u>${result}</u>`
  if (style.bold) result = `**${result}**`
  if (style.italic) result = `*${result}*`
  return result
}

function convertTable(table: Element): string {
  const rows = table.querySelectorAll('tr')
  if (!rows.length) return ''
  let result = '\n'
  let headerProcessed = false
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td')
    const cellContents = Array.from(cells).map((cell) => (cell.textContent || '').trim())
    result += `| ${cellContents.join(' | ')} |\n`
    if (!headerProcessed && (row.querySelector('th') || rowIndex === 0)) {
      result += `| ${cellContents.map(() => '---').join(' | ')} |\n`
      headerProcessed = true
    }
  })
  return `${result}\n`
}

function processNode(node: Node, inheritedStyle: StyleInfo = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    if (!text) return ''
    let result = applyTextFormatting(text, inheritedStyle)
    result = applyInlineStyles(result, inheritedStyle)
    return result
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const element = node as Element
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'div' && element.classList.contains('code-block-wrapper')) {
    const code = element.querySelector('pre.editor-code-block code, pre code') as HTMLElement | null
    const codeText = normalizeCodeText(code?.textContent || '')
    const lang = detectCodeLanguage(code || element)
    return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`
  }

  // Preserve formulas as standard inline math for Markdown editors.
  if (element.classList.contains('formula-inline')) {
    const latex = normalizeInlineLatex(
      element.getAttribute('data-latex') ||
      (element as HTMLElement).dataset?.latex ||
      ''
    )
    if (!latex) return ''
    const parent = element.parentElement
    const hasMeaningfulSibling = !!parent && Array.from(parent.childNodes).some((node) => {
      if (node === element) return false
      if (node.nodeType === Node.TEXT_NODE) return !!(node.textContent || '').trim()
      return true
    })
    if (!hasMeaningfulSibling) {
      return `\n$$\n${latex}\n$$\n`
    }
    return `$${latex}$`
  }

  const style: StyleInfo = { ...inheritedStyle }
  const styleAttr = element.getAttribute('style')
  if (styleAttr) Object.assign(style, parseStyle(styleAttr))

  if (tagName === 'b' || tagName === 'strong') style.bold = true
  if (tagName === 'i' || tagName === 'em') style.italic = true
  if (tagName === 'u') style.underline = true
  if (tagName === 's' || tagName === 'del' || tagName === 'strike') style.strikethrough = true
  if (tagName === 'code') style.code = true

  const colorAttr = element.getAttribute('color')
  if (colorAttr) style.color = colorAttr
  const bgColorAttr = element.getAttribute('bgcolor')
  if (bgColorAttr) style.backgroundColor = bgColorAttr

  let childrenContent = ''
  for (const child of node.childNodes) {
    childrenContent += processNode(child, style)
  }

  switch (tagName) {
    case 'h1':
      return `\n# ${childrenContent.trim()}\n\n`
    case 'h2':
      return `\n## ${childrenContent.trim()}\n\n`
    case 'h3':
      return `\n### ${childrenContent.trim()}\n\n`
    case 'h4':
      return `\n#### ${childrenContent.trim()}\n\n`
    case 'h5':
      return `\n##### ${childrenContent.trim()}\n\n`
    case 'h6':
      return `\n###### ${childrenContent.trim()}\n\n`
    case 'p':
    case 'div': {
      if (!childrenContent.trim()) return '\n'
      const blockText = childrenContent.replace(/\n+$/, '')
      return `${blockText}\n\n`
    }
    case 'br':
      return '  \n'
    case 'hr':
      return '\n---\n\n'
    case 'blockquote': {
      const bqLines = childrenContent.trim().split('\n')
      return `${bqLines.map((line) => `> ${line}`).join('\n')}\n\n`
    }
    case 'ul':
    case 'ol':
      return `\n${childrenContent}\n`
    case 'li': {
      const item = childrenContent.replace(/\n+$/, '').trim()
      const parentList = element.parentElement?.tagName.toLowerCase()
      if (parentList === 'ol') {
        const siblings = Array.from(element.parentElement?.children || [])
        const index = siblings.indexOf(element) + 1
        return `${index}. ${item}\n`
      }
      return `- ${item}\n`
    }
    case 'pre': {
      const codeEl = element.querySelector('code') as HTMLElement | null
      const codeText = normalizeCodeText(codeEl?.textContent || element.textContent || '')
      const lang = detectCodeLanguage(codeEl || element)
      return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`
    }
    case 'a': {
      const href = element.getAttribute('href') || ''
      return `[${childrenContent || href}](${href})`
    }
    case 'img': {
      const src = element.getAttribute('src') || ''
      const alt = element.getAttribute('alt') || ''
      return `![${alt}](${src})`
    }
    case 'table':
      return convertTable(element)
    default:
      return childrenContent
  }
}

export function htmlToMarkdown(html: string, title: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove editor-only controls before conversion.
  doc.body
    .querySelectorAll('.code-controls, .code-copy-btn, .code-copy-toast, [data-copy-code-btn], [data-code-lang-select]')
    .forEach((node) => node.remove())

  let markdown = `# ${title}\n\n`
  for (const child of doc.body.childNodes) {
    markdown += processNode(child)
  }

  markdown = markdown
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\*\s*\*/g, '')
    .replace(/~~\s*~~/g, '')
    .replace(/<u>\s*<\/u>/g, '')
    .replace(/`\s*`/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')

  return markdown
}

/**
 * Export document with proper encoding
 */
export function downloadMarkdown(html: string, title: string): void {
  const markdown = htmlToMarkdown(html, title)
  
  // Create blob with UTF-8 encoding
  const blob = new Blob([markdown], { 
    type: 'text/markdown;charset=utf-8' 
  })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
