'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FloatingToolbar } from './FloatingToolbar'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

interface FormatState {
  heading: string | null // 'h1', 'h2', 'h3', or null
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  bulletList: boolean
  orderedList: boolean
}

// Font size steps for increase/decrease
const FONT_SIZE_STEP = 4
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 72
const DEFAULT_FONT_SIZE = 16

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [toolbarState, setToolbarState] = useState({
    visible: false,
    position: { top: 0, left: 0 },
  })
  const [formatState, setFormatState] = useState<FormatState>({ 
    heading: null,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    bulletList: false,
    orderedList: false,
  })
  const isInternalChange = useRef(false)
  const shouldResetInlineTypingRef = useRef(false)
  // Track IME composition state – while composing CJK/etc. input we must not
  // intercept keydown events or manipulate the selection.
  const isComposingRef = useRef(false)

  // Link editing state
  const [editingLink, setEditingLink] = useState<{
    element: HTMLAnchorElement
    text: string
    href: string
    position: { top: number; left: number }
  } | null>(null)
  const linkPopoverRef = useRef<HTMLDivElement>(null)

  // Image resize state
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [overlayRect, setOverlayRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const resizeDragRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; aspectRatio: number; corner: string } | null>(null)

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true
      const newContent = editorRef.current.innerHTML
      onChange(newContent)
    }
  }, [onChange])

  const getTextBeforeCaretInBlock = useCallback((block: HTMLElement, selection: Selection): string => {
    if (!selection.rangeCount) return ''
    const range = selection.getRangeAt(0).cloneRange()
    const textRange = document.createRange()
    textRange.selectNodeContents(block)
    textRange.setEnd(range.endContainer, range.endOffset)
    return textRange.toString().replace(/\u00a0/g, ' ')
  }, [])

  const getCurrentBlock = useCallback((selection: Selection): HTMLElement | null => {
    const anchor = selection.anchorNode
    if (!anchor || !editorRef.current) return null
    const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement
    if (!element) return null
    const block = element.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, li')
    if (!block || !editorRef.current.contains(block)) return null

    // If caret is directly inside the root contentEditable (common on first line),
    // wrap the current text node into a <p> so markdown shortcut logic can work.
    if (block === editorRef.current) {
      const editor = editorRef.current
      if (!selection.rangeCount) return null
      const range = selection.getRangeAt(0)

      const wrapTextNodeAsParagraph = (textNode: Text, caretOffset: number) => {
        const p = document.createElement('p')
        editor.insertBefore(p, textNode)
        p.appendChild(textNode)
        const r = document.createRange()
        const safeOffset = Math.max(0, Math.min(caretOffset, textNode.length))
        r.setStart(textNode, safeOffset)
        r.collapse(true)
        selection.removeAllRanges()
        selection.addRange(r)
        return p
      }

      if (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode === editor) {
        return wrapTextNodeAsParagraph(range.startContainer as Text, range.startOffset)
      }

      if (range.startContainer === editor) {
        const before = editor.childNodes[range.startOffset - 1] || null
        const at = editor.childNodes[range.startOffset] || null

        const createParagraphAtCaret = () => {
          const p = document.createElement('p')
          p.appendChild(document.createElement('br'))
          if (at) {
            editor.insertBefore(p, at)
          } else {
            editor.appendChild(p)
          }

          // If caret is around <br>-based line break, remove nearby break marker
          // so the new block cleanly represents the current line.
          if (before && before.nodeName === 'BR' && before.parentNode === editor) {
            editor.removeChild(before)
          } else if (at && at.nodeName === 'BR' && at.parentNode === editor) {
            editor.removeChild(at)
          }

          const r = document.createRange()
          r.selectNodeContents(p)
          r.collapse(true)
          selection.removeAllRanges()
          selection.addRange(r)
          return p
        }

        // At a visual line boundary represented by <br>, current line should be
        // treated as a new block instead of wrapping previous line content.
        if ((before && before.nodeName === 'BR') || (at && at.nodeName === 'BR')) {
          return createParagraphAtCaret()
        }

        // Important safety rule:
        // never fall back to the previous text node here, otherwise shortcut
        // parsing can target the previous line by mistake.
        if (at && at.nodeType === Node.TEXT_NODE && at.parentNode === editor) {
          const textNode = at as Text
          return wrapTextNodeAsParagraph(textNode, 0)
        }

        // If caret is at the end and there is no "at" text node, create a fresh
        // paragraph for the current line to avoid binding to previous content.
        if (!at) {
          return createParagraphAtCaret()
        }
      }

      // Empty editor: create a default paragraph block.
      if (editor.childNodes.length === 0) {
        const p = document.createElement('p')
        p.appendChild(document.createElement('br'))
        editor.appendChild(p)
        const r = document.createRange()
        r.selectNodeContents(p)
        r.collapse(true)
        selection.removeAllRanges()
        selection.addRange(r)
        return p
      }

      return null
    }

    return block as HTMLElement
  }, [])

  const deleteCharsBeforeCaret = useCallback((selection: Selection, count: number): boolean => {
    if (count <= 0 || !selection.rangeCount) return false

    const caretRange = selection.getRangeAt(0)
    const endContainer = caretRange.endContainer
    const endOffset = caretRange.endOffset

    if (endContainer.nodeType !== Node.TEXT_NODE) {
      return false
    }

    if (endOffset < count) {
      return false
    }

    const deleteRange = document.createRange()
    deleteRange.setStart(endContainer, endOffset - count)
    deleteRange.setEnd(endContainer, endOffset)
    deleteRange.deleteContents()
    return true
  }, [])

  const deleteMarkdownTrigger = useCallback((selection: Selection, triggerText: string): boolean => {
    return deleteCharsBeforeCaret(selection, triggerText.length)
  }, [deleteCharsBeforeCaret])

  // Ensure the caret's current line lives in its own isolated block element.
  // If the block also contains earlier content (previous lines separated by <br>),
  // split it so that earlier content stays in the original block and the caret
  // ends up in a brand-new <p>. Returns the isolated block, or null on failure.
  const ensureIsolatedBlock = useCallback((): HTMLElement | null => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || !selection.rangeCount) return null

    const range = selection.getRangeAt(0)

    // Walk up from caret to find the nearest block-level ancestor inside editor
    let blockEl: HTMLElement | null = null
    let cur: Node | null = range.startContainer
    while (cur && cur !== editor) {
      if (cur.nodeType === Node.ELEMENT_NODE) {
        const tag = (cur as HTMLElement).tagName.toLowerCase()
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li'].includes(tag)) {
          blockEl = cur as HTMLElement
          break
        }
      }
      cur = cur.parentNode
    }

    if (!blockEl || blockEl === editor) return null

    // Is there meaningful text before the caret inside this block?
    const checkRange = document.createRange()
    checkRange.selectNodeContents(blockEl)
    checkRange.setEnd(range.startContainer, range.startOffset)
    const textBefore = checkRange.toString().trim()

    if (textBefore.length === 0) {
      // Nothing before caret – block is already isolated for our purposes
      return blockEl
    }

    // --- Block has earlier content: split it ---
    // Extract everything from caret to end-of-block into a DocumentFragment
    const extractRange = document.createRange()
    extractRange.setStart(range.startContainer, range.startOffset)
    extractRange.setEnd(blockEl, blockEl.childNodes.length)
    const fragment = extractRange.extractContents()

    // Remove trailing <br>(s) left in the original block (they were line separators)
    while (blockEl.lastChild && blockEl.lastChild.nodeName === 'BR') {
      blockEl.removeChild(blockEl.lastChild)
    }
    if (!blockEl.innerHTML.trim()) {
      blockEl.innerHTML = '<br>'
    }

    // Create a new <p> and put the extracted content in it
    const newBlock = document.createElement('p')
    newBlock.appendChild(fragment)
    if (!newBlock.innerHTML.trim()) {
      newBlock.innerHTML = '<br>'
    }

    blockEl.parentNode!.insertBefore(newBlock, blockEl.nextSibling)

    // Place caret at the start of the new block
    const r = document.createRange()
    r.selectNodeContents(newBlock)
    r.collapse(true)
    selection.removeAllRanges()
    selection.addRange(r)

    return newBlock
  }, [])

  // Replace a block element's tag (e.g. <p> → <h1>) while keeping its children
  const convertBlockTag = useCallback((block: HTMLElement, newTag: string) => {
    const selection = window.getSelection()
    const newBlock = document.createElement(newTag)

    while (block.firstChild) {
      newBlock.appendChild(block.firstChild)
    }
    block.parentNode!.replaceChild(newBlock, block)

    if (!newBlock.innerHTML.trim()) {
      newBlock.innerHTML = '<br>'
    }

    if (selection) {
      const r = document.createRange()
      r.selectNodeContents(newBlock)
      r.collapse(true)
      selection.removeAllRanges()
      selection.addRange(r)
    }
  }, [])

  const applyMarkdownShortcut = useCallback((e: React.KeyboardEvent): boolean => {
    if (!editorRef.current) return false
    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed) return false

    const block = getCurrentBlock(selection)
    if (!block) return false

    const beforeCaret = getTextBeforeCaretInBlock(block, selection)
    const currentLine = (beforeCaret.split('\n').pop() || '').trim()

    if (e.key === ' ') {
      const tagMap: Record<string, string> = {
        '#': 'h1',
        '##': 'h2',
        '###': 'h3',
        '>': 'blockquote',
      }

      if (tagMap[currentLine]) {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        // Isolate the current line into its own block, then convert its tag
        const isolated = ensureIsolatedBlock()
        if (isolated) {
          convertBlockTag(isolated, tagMap[currentLine])
        }
        handleInput()
        return true
      }

      if (currentLine === '-' || currentLine === '*') {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        // Ensure the current line lives in its own block before applying list,
        // otherwise insertUnorderedList may absorb the previous line too.
        const listBlock = ensureIsolatedBlock()
        if (listBlock) {
          // Convert the isolated block to a list manually to stay on correct line.
          const ul = document.createElement('ul')
          const li = document.createElement('li')
          li.appendChild(document.createElement('br'))
          ul.appendChild(li)
          listBlock.parentNode!.replaceChild(ul, listBlock)
          const r = document.createRange()
          r.selectNodeContents(li)
          r.collapse(true)
          selection.removeAllRanges()
          selection.addRange(r)
        } else {
          document.execCommand('insertUnorderedList', false)
        }
        handleInput()
        return true
      }

      if (currentLine === '1.') {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        const listBlock = ensureIsolatedBlock()
        if (listBlock) {
          const ol = document.createElement('ol')
          const li = document.createElement('li')
          li.appendChild(document.createElement('br'))
          ol.appendChild(li)
          listBlock.parentNode!.replaceChild(ol, listBlock)
          const r = document.createRange()
          r.selectNodeContents(li)
          r.collapse(true)
          selection.removeAllRanges()
          selection.addRange(r)
        } else {
          document.execCommand('insertOrderedList', false)
        }
        handleInput()
        return true
      }
    }

    if (e.key === 'Enter' && (currentLine === '---' || currentLine === '***')) {
      e.preventDefault()
      if (!deleteMarkdownTrigger(selection, currentLine)) return false
      document.execCommand('insertHorizontalRule', false)
      document.execCommand('insertParagraph', false)
      handleInput()
      return true
    }

    return false
  }, [convertBlockTag, deleteMarkdownTrigger, ensureIsolatedBlock, getCurrentBlock, getTextBeforeCaretInBlock, handleInput])

  const clearInlineTypingState = useCallback(() => {
    // Avoid forcing "bold" off globally; headings rely on their own bold style.
    const commands: Array<'italic' | 'strikeThrough' | 'underline'> = [
      'italic',
      'strikeThrough',
      'underline',
    ]
    for (const command of commands) {
      if (document.queryCommandState(command)) {
        document.execCommand(command, false)
      }
    }
  }, [])

  const clearColorTypingState = useCallback(() => {
    // Reset color/highlight typing state for subsequent input.
    const isDarkMode = document.documentElement.classList.contains('dark')
    const defaultColor = isDarkMode ? '#ffffff' : '#000000'
    document.execCommand('foreColor', false, defaultColor)
    document.execCommand('hiliteColor', false, 'transparent')
  }, [])

  const isSelectionInsideHeading = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    let node: Node | null = selection.anchorNode
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase()
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') return true
      }
      node = node.parentNode
    }
    return false
  }, [])

  const applyInlineMarkdownShortcut = useCallback((e: React.KeyboardEvent): boolean => {
    if (e.key !== ' ') return false

    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return false

    const range = selection.getRangeAt(0)
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return false

    const textNode = range.startContainer as Text
    const offset = range.startOffset
    const before = textNode.data.slice(0, offset)

    type InlineMatch = {
      regex: RegExp
      build: (match: RegExpMatchArray) => HTMLElement
      resetCommands?: Array<'bold' | 'italic' | 'strikeThrough' | 'underline'>
    }

    const patterns: InlineMatch[] = [
      {
        // **bold**
        regex: /\*\*([^*\n][^*\n]*?)\*\*$/,
        build: (m) => {
          const el = document.createElement('strong')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['bold'],
      },
      {
        // *italic*
        regex: /(?<!\*)\*([^*\n]+)\*$/,
        build: (m) => {
          const el = document.createElement('em')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['italic'],
      },
      {
        // _italic_
        regex: /(?<!_)_([^_\n]+)_$/,
        build: (m) => {
          const el = document.createElement('em')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['italic'],
      },
      {
        // ~~strikethrough~~ or ～～strikethrough～～
        regex: /(~~|～～)([^~～\n]+)\1$/,
        build: (m) => {
          const el = document.createElement('s')
          el.textContent = m[2]
          return el
        },
        resetCommands: ['strikeThrough'],
      },
      {
        // `inline code`
        regex: /`([^`\n]+)`$/,
        build: (m) => {
          const el = document.createElement('code')
          el.className = 'inline-code'
          el.textContent = m[1]
          return el
        },
      },
      {
        // ++underline++
        regex: /\+\+([^+\n]+)\+\+$/,
        build: (m) => {
          const el = document.createElement('u')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['underline'],
      },
      {
        // <u>underline</u>
        regex: /<u>([^<\n]+)<\/u>$/i,
        build: (m) => {
          const el = document.createElement('u')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['underline'],
      },
      {
        // [label](url)
        regex: /\[([^\]\n]+)\]\(([^)\s]+)\)$/,
        build: (m) => {
          const el = document.createElement('a')
          el.textContent = m[1]
          el.href = m[2]
          el.target = '_blank'
          el.rel = 'noopener noreferrer'
          return el
        },
      },
    ]

    for (const pattern of patterns) {
      const match = before.match(pattern.regex)
      if (!match) continue

      const fullMatch = match[0]
      const replaceStart = offset - fullMatch.length

      if (replaceStart < 0) return false

      e.preventDefault()

      const replaceRange = document.createRange()
      replaceRange.setStart(textNode, replaceStart)
      replaceRange.setEnd(textNode, offset)
      replaceRange.deleteContents()

      const fragment = document.createDocumentFragment()
      const formattedNode = pattern.build(match)
      const trailingSpace = document.createTextNode(' ')
      fragment.appendChild(formattedNode)
      fragment.appendChild(trailingSpace)

      replaceRange.insertNode(fragment)

      const caretRange = document.createRange()
      // Place caret INSIDE the trailing-space text node (at its end) rather
      // than after it.  setStartAfter() would position the caret at a parent-
      // element boundary, and some browsers resolve that boundary with
      // "affinity" toward the preceding <strong>/<em>/etc., causing the next
      // typed character to inherit the inline formatting.  Positioning inside
      // the text node is unambiguous — the browser knows the caret is in a
      // plain-text context.
      caretRange.setStart(trailingSpace, trailingSpace.length)
      caretRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caretRange)

      // Some browsers keep a hidden typing style state after rich-text edits.
      // Explicitly disable command-based inline styles so following input stays plain.
      if (pattern.resetCommands) {
        for (const command of pattern.resetCommands) {
          if (document.queryCommandState(command)) {
            document.execCommand(command, false)
          }
        }
      }
      const inHeading = isSelectionInsideHeading()
      if (!inHeading) {
        clearInlineTypingState()
      }

      // Force next printable input to start outside inline-format context.
      shouldResetInlineTypingRef.current = !inHeading

      handleInput()
      return true
    }

    return false
  }, [clearInlineTypingState, handleInput, isSelectionInsideHeading])

  const ensureCaretOutsideInlineFormatting = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return

    let node: Node | null = selection.anchorNode
    let inlineAncestor: HTMLElement | null = null
    const inlineTags = new Set(['strong', 'b', 'em', 'i', 's', 'del', 'code', 'a', 'u', 'span', 'font'])

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (inlineTags.has(el.tagName.toLowerCase())) {
          inlineAncestor = el
        }
      }
      node = node.parentNode
    }

    if (inlineAncestor && inlineAncestor.parentNode) {
      const range = document.createRange()
      range.setStartAfter(inlineAncestor)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [])

  const isCaretInsideInlineFormatting = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false

    let node: Node | null = selection.anchorNode
    const inlineTags = new Set(['strong', 'b', 'em', 'i', 's', 'del', 'code', 'a', 'u', 'span', 'font'])

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (inlineTags.has(el.tagName.toLowerCase())) {
          return true
        }
      }
      node = node.parentNode
    }
    return false
  }, [])

  const insertPlainTextAtCaret = useCallback((text: string) => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    const nextRange = document.createRange()
    nextRange.setStart(textNode, textNode.length)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }, [])

  const insertCleanParagraphAfterCurrentBlock = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false

    const currentBlock = getCurrentBlock(selection)
    const editor = editorRef.current
    if (!currentBlock || currentBlock === editor) return false

    const newP = document.createElement('p')
    newP.appendChild(document.createElement('br'))
    currentBlock.parentNode?.insertBefore(newP, currentBlock.nextSibling)

    const range = document.createRange()
    range.selectNodeContents(newP)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }, [getCurrentBlock])

  // ---- Image resize: overlay position tracking ----
  useEffect(() => {
    if (!selectedImage) {
      setOverlayRect(null)
      return
    }

    const recalc = () => {
      if (!selectedImage.isConnected) {
        setSelectedImage(null)
        return
      }
      const containerEl = editorRef.current?.parentElement
      if (!containerEl) return
      const containerRect = containerEl.getBoundingClientRect()
      const imgRect = selectedImage.getBoundingClientRect()
      setOverlayRect({
        top: imgRect.top - containerRect.top,
        left: imgRect.left - containerRect.left,
        width: imgRect.width,
        height: imgRect.height,
      })
    }

    recalc()

    const editor = editorRef.current
    editor?.addEventListener('scroll', recalc)
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)

    return () => {
      editor?.removeEventListener('scroll', recalc)
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [selectedImage])

  // ---- Image resize: drag handling ----
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = resizeDragRef.current
      if (!drag || !selectedImage) return
      e.preventDefault()

      const dx = e.clientX - drag.startX
      const isLeft = drag.corner === 'nw' || drag.corner === 'sw'
      const widthDelta = isLeft ? -dx : dx
      const newWidth = Math.max(50, drag.startWidth + widthDelta)
      const newHeight = Math.max(50, newWidth / drag.aspectRatio)

      selectedImage.style.width = `${Math.round(newWidth)}px`
      selectedImage.style.height = `${Math.round(newHeight)}px`
      selectedImage.removeAttribute('width')
      selectedImage.removeAttribute('height')

      // Update overlay to match new size
      const containerEl = editorRef.current?.parentElement
      if (containerEl) {
        const containerRect = containerEl.getBoundingClientRect()
        const imgRect = selectedImage.getBoundingClientRect()
        setOverlayRect({
          top: imgRect.top - containerRect.top,
          left: imgRect.left - containerRect.left,
          width: imgRect.width,
          height: imgRect.height,
        })
      }
    }

    const handleMouseUp = () => {
      if (resizeDragRef.current) {
        resizeDragRef.current = null
        handleInput()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selectedImage, handleInput])

  // ---- Image resize: keyboard (Escape to deselect, Delete/Backspace to remove) ----
  useEffect(() => {
    if (!selectedImage) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedImage(null)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        const next = selectedImage.nextSibling
        const parent = selectedImage.parentNode
        selectedImage.remove()
        setSelectedImage(null)
        // Place caret after where the image was
        if (parent && editorRef.current?.contains(parent)) {
          const sel = window.getSelection()
          if (sel) {
            const r = document.createRange()
            if (next && parent.contains(next)) {
              r.setStartBefore(next)
            } else {
              r.selectNodeContents(parent)
              r.collapse(false)
            }
            r.collapse(true)
            sel.removeAllRanges()
            sel.addRange(r)
          }
        }
        handleInput()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedImage, handleInput])

  // Sync content to editor when it changes externally
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const currentHtml = editorRef.current.innerHTML
      // Only update if the content is different and editor is not focused
      if (document.activeElement !== editorRef.current && currentHtml !== content) {
        setSelectedImage(null)
        editorRef.current.innerHTML = content || '<p><br></p>'
      }
    }
    isInternalChange.current = false
  }, [content])

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content
    }
    // Make Enter always create a new <p> block instead of inserting <br>,
    // so each line lives in its own block element.
    try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* ignore */ }
  }, [])

  // Detect current format from selection
  const detectFormatState = useCallback((node: Node | null): FormatState => {
    const state: FormatState = {
      heading: null,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      bulletList: false,
      orderedList: false,
    }
    
    if (!node) return state
    
    // Check formatting using queryCommandState
    state.bold = document.queryCommandState('bold')
    state.italic = document.queryCommandState('italic')
    state.underline = document.queryCommandState('underline')
    state.strikethrough = document.queryCommandState('strikeThrough')
    state.bulletList = document.queryCommandState('insertUnorderedList')
    state.orderedList = document.queryCommandState('insertOrderedList')
    
    // Get the element to check for heading
    let element: Element | null = node.nodeType === Node.TEXT_NODE 
      ? node.parentElement 
      : node as Element
    
    // Walk up the DOM tree to find heading
    while (element && element !== editorRef.current) {
      const tagName = element.tagName.toLowerCase()
      
      if (tagName === 'h1') {
        state.heading = 'h1'
        break
      } else if (tagName === 'h2') {
        state.heading = 'h2'
        break
      } else if (tagName === 'h3') {
        state.heading = 'h3'
        break
      }
      
      element = element.parentElement
    }
    
    return state
  }, [])

  // Handle text selection - show/hide toolbar
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    
    // Hide toolbar if no selection or collapsed selection
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setToolbarState((prev) => ({ ...prev, visible: false }))
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Check if selection is within editor
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      // Detect current format
      const detectedFormat = detectFormatState(range.commonAncestorContainer)
      setFormatState(detectedFormat)

      // Clamp toolbar position to stay within viewport
      const toolbarWidth = 580 // approximate toolbar width
      const toolbarHeight = 50
      let top = rect.top - toolbarHeight
      // Calculate left edge (center of selection minus half toolbar width)
      let left = rect.left + rect.width / 2 - toolbarWidth / 2

      // Clamp: keep at least 8px from viewport edges
      left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8))

      // If toolbar would go above viewport, show below selection
      if (top < 8) {
        top = rect.bottom + 8
      }

      setToolbarState({
        visible: true,
        position: { top, left },
      })
    } else {
      setToolbarState((prev) => ({ ...prev, visible: false }))
    }
  }, [detectFormatState])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  // Get current font size from a node (handles both Element and Text nodes)
  const getFontSizeFromNode = useCallback((node: Node | null): number => {
    if (!node) return DEFAULT_FONT_SIZE
    
    // If it's a text node, get its parent element
    let element: Element | null = node.nodeType === Node.TEXT_NODE 
      ? node.parentElement 
      : node as Element
    
    // Walk up the DOM tree to find a font-size style
    while (element && element !== editorRef.current) {
      const fontSize = window.getComputedStyle(element).fontSize
      const parsed = parseInt(fontSize, 10)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
      element = element.parentElement
    }
    
    return DEFAULT_FONT_SIZE
  }, [])

  // Helper to select an element and show toolbar
  const selectElementAndShowToolbar = useCallback((element: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return
    
    const range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
    
    // Update toolbar position after a brief delay to let DOM update
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect()
      setToolbarState({
        visible: true,
        position: {
          top: rect.top - 50 + window.scrollY,
          left: rect.left + rect.width / 2,
        },
      })
    })
  }, [])

  const wrapSelectionWithStyle = useCallback(
    (property: 'color' | 'backgroundColor', value: string, clearToken: string): boolean => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) return false

      const range = selection.getRangeAt(0)
      const extracted = range.extractContents()
      const span = document.createElement('span')

      if (value === clearToken) {
        span.style[property] = property === 'color' ? 'inherit' : 'transparent'
      } else {
        span.style[property] = value
      }

      span.appendChild(extracted)
      range.insertNode(span)

      // Collapse caret to end so subsequent typing starts outside selection.
      const caret = document.createRange()
      caret.setStartAfter(span)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)

      return true
    },
    []
  )

  // Apply style to selected text
  const applyStyle = useCallback((style: string, value?: string) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString()

    switch (style) {
      case 'bold':
        document.execCommand('bold', false)
        break
      case 'italic':
        document.execCommand('italic', false)
        break
      case 'underline':
        document.execCommand('underline', false)
        break
      case 'strikethrough':
        document.execCommand('strikeThrough', false)
        break
      case 'color': {
        // Avoid enabling persistent typing color when no text is selected.
        if (selection.isCollapsed || !selectedText) {
          break
        }
        wrapSelectionWithStyle('color', value || 'inherit', 'inherit')
        // Prevent following typing from inheriting color style context.
        selection.collapseToEnd()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        break
      }
      case 'highlight':
        // Avoid enabling persistent typing highlight when no text is selected.
        if (selection.isCollapsed || !selectedText) {
          break
        }
        wrapSelectionWithStyle('backgroundColor', value || 'transparent', 'transparent')
        selection.collapseToEnd()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        break
      case 'fontSize': {
        const fontSpan = document.createElement('span')
        fontSpan.className = 'font-size-span'
        fontSpan.style.fontSize = value || '16px'
        fontSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(fontSpan)
        selectElementAndShowToolbar(fontSpan)
        handleInput()
        return
      }
      case 'fontSizeIncrease': {
        const currentSize = getFontSizeFromNode(range.commonAncestorContainer)
        const newSize = Math.min(currentSize + FONT_SIZE_STEP, MAX_FONT_SIZE)
        const fontSpan = document.createElement('span')
        fontSpan.className = 'font-size-span'
        fontSpan.style.fontSize = `${newSize}px`
        fontSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(fontSpan)
        selectElementAndShowToolbar(fontSpan)
        handleInput()
        return
      }
      case 'fontSizeDecrease': {
        const currentSize = getFontSizeFromNode(range.commonAncestorContainer)
        const newSize = Math.max(currentSize - FONT_SIZE_STEP, MIN_FONT_SIZE)
        const fontSpan = document.createElement('span')
        fontSpan.className = 'font-size-span'
        fontSpan.style.fontSize = `${newSize}px`
        fontSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(fontSpan)
        selectElementAndShowToolbar(fontSpan)
        handleInput()
        return
      }
      case 'code': {
        const codeSpan = document.createElement('code')
        codeSpan.className = 'inline-code'
        codeSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(codeSpan)
        break
      }
      case 'heading': {
        const headingTag = `h${value || '1'}`
        document.execCommand('formatBlock', false, `<${headingTag}>`)
        // Update format state
        setFormatState((prev) => ({ ...prev, heading: headingTag }))
        break
      }
      case 'list':
        if (value === 'bullet') {
          document.execCommand('insertUnorderedList', false)
        } else {
          document.execCommand('insertOrderedList', false)
        }
        break
      case 'quote':
        document.execCommand('formatBlock', false, '<blockquote>')
        setFormatState((prev) => ({ ...prev, heading: null }))
        break
      case 'link': {
        const linkUrl = prompt('Enter URL:', 'https://')
        if (linkUrl) {
          document.execCommand('createLink', false, linkUrl)
        }
        break
      }
      case 'hr':
        document.execCommand('insertHorizontalRule', false)
        break
      case 'normal':
        document.execCommand('formatBlock', false, '<p>')
        setFormatState((prev) => ({ ...prev, heading: null }))
        break
    }

    // Trigger content update
    handleInput()
    setToolbarState((prev) => ({ ...prev, visible: false }))
  }, [clearInlineTypingState, ensureCaretOutsideInlineFormatting, handleInput, getFontSizeFromNode, selectElementAndShowToolbar, wrapSelectionWithStyle])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Do not intercept anything while an IME composition is in progress.
    // e.nativeEvent.isComposing catches the first keydown on Safari/Firefox where
    // compositionstart fires after keydown; isComposingRef covers subsequent keys.
    if (e.nativeEvent.isComposing || isComposingRef.current) return

    if (e.key === 'Enter' && !e.shiftKey) {
      const inBulletList = document.queryCommandState('insertUnorderedList')
      const inOrderedList = document.queryCommandState('insertOrderedList')
      // Keep native behavior inside lists; otherwise force a clean paragraph break
      // to avoid inheriting previous-line formatting context.
      if (!inBulletList && !inOrderedList) {
        e.preventDefault()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        clearColorTypingState()
        if (!insertCleanParagraphAfterCurrentBlock()) {
          document.execCommand('insertParagraph', false)
        }
        shouldResetInlineTypingRef.current = false
        handleInput()
        return
      }
    }

    // When caret is still inside inline formatting context (common after frequent
    // color/inline style operations), force Enter to break out first. This avoids
    // new-line markdown shortcuts accidentally affecting the previous line.
    if (e.key === 'Enter' && !e.shiftKey && isCaretInsideInlineFormatting()) {
      e.preventDefault()
      ensureCaretOutsideInlineFormatting()
      clearInlineTypingState()
      document.execCommand('insertParagraph', false)
      shouldResetInlineTypingRef.current = false
      handleInput()
      return
    }

    if (shouldResetInlineTypingRef.current) {
      if (e.key === 'Enter') {
        const inBulletList = document.queryCommandState('insertUnorderedList')
        const inOrderedList = document.queryCommandState('insertOrderedList')
        if (inBulletList || inOrderedList) {
          shouldResetInlineTypingRef.current = false
          return
        }
        e.preventDefault()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        clearColorTypingState()
        if (!insertCleanParagraphAfterCurrentBlock()) {
          document.execCommand('insertParagraph', false)
        }
        shouldResetInlineTypingRef.current = false
        handleInput()
        return
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // Just clear the flag and let the browser / IME handle the key
        // naturally.  We must NOT modify the DOM selection or call
        // execCommand here — on macOS (and some Windows IMEs),
        // compositionstart fires AFTER keydown, so any DOM/selection
        // manipulation during keydown breaks the IME and causes the
        // first character to be committed as a raw English letter.
        // The inline conversion (applyInlineMarkdownShortcut) already
        // positioned the caret inside a plain-text node and cleared
        // the formatting state; that is sufficient.
        shouldResetInlineTypingRef.current = false
      }
    }

    if (applyInlineMarkdownShortcut(e)) return
    if (applyMarkdownShortcut(e)) return

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          applyStyle('bold')
          break
        case 'i':
          e.preventDefault()
          applyStyle('italic')
          break
        case 'u':
          e.preventDefault()
          applyStyle('underline')
          break
        case 's':
          e.preventDefault()
          const event = new CustomEvent('save-document')
          window.dispatchEvent(event)
          break
      }
    }

    // Handle Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
    }
  }, [applyInlineMarkdownShortcut, applyMarkdownShortcut, applyStyle, clearColorTypingState, clearInlineTypingState, ensureCaretOutsideInlineFormatting, handleInput, insertCleanParagraphAfterCurrentBlock, isCaretInsideInlineFormatting])

  return (
    <div className="relative h-full">
      <FloatingToolbar
        onApplyStyle={applyStyle}
        position={toolbarState.position}
        visible={toolbarState.visible}
        formatState={formatState}
      />
      
      <div
        ref={editorRef}
        contentEditable
        className="prose-editor h-full min-h-[calc(100vh-200px)] p-8 outline-none focus:outline-none overflow-auto"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          const target = e.target as HTMLElement
          // Handle link clicks
          const linkEl = target.closest('a') as HTMLAnchorElement | null
          if (linkEl && editorRef.current?.contains(linkEl)) {
            e.preventDefault()
            const linkRect = linkEl.getBoundingClientRect()
            // Use fixed positioning like FloatingToolbar, clamped to viewport
            const popoverWidth = 280
            let left = linkRect.left + linkRect.width / 2 - popoverWidth / 2
            left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8))
            let top = linkRect.bottom + 6
            // If popover would go below viewport, show above
            if (top + 200 > window.innerHeight) {
              top = linkRect.top - 200 - 6
            }
            setEditingLink({
              element: linkEl,
              text: linkEl.textContent || '',
              href: linkEl.getAttribute('href') || '',
              position: { top, left },
            })
            return
          }
          // Close link popover when clicking elsewhere
          if (editingLink) {
            setEditingLink(null)
          }
          if (target.tagName === 'IMG') {
            setSelectedImage(target as HTMLImageElement)
            window.getSelection()?.removeAllRanges()
          } else if (selectedImage) {
            setSelectedImage(null)
          }
        }}
        onCompositionStart={() => { isComposingRef.current = true }}
        onCompositionEnd={() => {
          isComposingRef.current = false
          // After IME commits text, reset the inline-typing state so the next
          // real keydown doesn't accidentally inherit inline formatting.
          shouldResetInlineTypingRef.current = false
        }}
        suppressContentEditableWarning
        data-placeholder="Start writing..."
      />

      {/* Link editing popover */}
      {editingLink && (
        <div
          ref={linkPopoverRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 rounded-lg border bg-background/95 px-3 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
          style={{
            top: editingLink.position.top,
            left: editingLink.position.left,
            minWidth: 280,
          }}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">文本</span>
              <input
                type="text"
                autoFocus
                value={editingLink.text}
                onChange={(e) => setEditingLink(prev => prev ? { ...prev, text: e.target.value } : null)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    editingLink.element.textContent = editingLink.text
                    editingLink.element.setAttribute('href', editingLink.href)
                    setEditingLink(null)
                    handleInput()
                  } else if (e.key === 'Escape') {
                    setEditingLink(null)
                  }
                }}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">链接</span>
              <input
                type="text"
                value={editingLink.href}
                onChange={(e) => setEditingLink(prev => prev ? { ...prev, href: e.target.value } : null)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    editingLink.element.textContent = editingLink.text
                    editingLink.element.setAttribute('href', editingLink.href)
                    setEditingLink(null)
                    handleInput()
                  } else if (e.key === 'Escape') {
                    setEditingLink(null)
                  }
                }}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </label>
            <div className="flex gap-1.5 justify-end pt-1">
              <button
                onClick={() => {
                  const href = editingLink.href
                  if (href) window.open(href, '_blank', 'noopener,noreferrer')
                }}
                className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent transition-colors"
              >
                打开链接
              </button>
              <button
                onClick={() => {
                  const el = editingLink.element
                  const text = document.createTextNode(el.textContent || '')
                  el.parentNode?.replaceChild(text, el)
                  setEditingLink(null)
                  handleInput()
                }}
                className="rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                移除链接
              </button>
              <button
                onClick={() => {
                  editingLink.element.textContent = editingLink.text
                  editingLink.element.setAttribute('href', editingLink.href)
                  setEditingLink(null)
                  handleInput()
                }}
                className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image resize overlay */}
      {selectedImage && overlayRect && (
        <div
          style={{
            position: 'absolute',
            top: overlayRect.top,
            left: overlayRect.left,
            width: overlayRect.width,
            height: overlayRect.height,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        >
          {/* Selection border */}
          <div style={{ position: 'absolute', inset: 0, border: '2px solid #3b82f6', borderRadius: 4, pointerEvents: 'none' }} />
          {/* Corner resize handles */}
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
            const isTop = corner.startsWith('n')
            const isLeft = corner.endsWith('w')
            const cursors: Record<string, string> = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize' }
            return (
              <div
                key={corner}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!selectedImage) return
                  resizeDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startWidth: selectedImage.offsetWidth,
                    startHeight: selectedImage.offsetHeight,
                    aspectRatio: selectedImage.offsetWidth / (selectedImage.offsetHeight || 1),
                    corner,
                  }
                }}
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  backgroundColor: '#3b82f6',
                  border: '2px solid white',
                  borderRadius: 2,
                  top: isTop ? -5 : undefined,
                  bottom: isTop ? undefined : -5,
                  left: isLeft ? -5 : undefined,
                  right: isLeft ? undefined : -5,
                  cursor: cursors[corner],
                  pointerEvents: 'all',
                }}
              />
            )
          })}
          {/* Size indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: -28,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0,0,0,0.75)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              lineHeight: '18px',
            }}
          >
            {Math.round(overlayRect.width)} × {Math.round(overlayRect.height)}
          </div>
        </div>
      )}

      <style jsx global>{`
        .prose-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          position: absolute;
          left: 2rem;
          top: 2rem;
        }
        
        .prose-editor {
          line-height: 1.8;
          font-size: 16px;
        }
        
        /* Font size spans - maintain consistent line height */
        .prose-editor .font-size-span {
          display: inline;
          line-height: 1.5;
          vertical-align: baseline;
        }
        
        .prose-editor .inline-code,
        .prose-editor code {
          background-color: rgba(135, 131, 120, 0.15);
          color: #eb5757;
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          border-radius: 3px;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
        }
        
        .prose-editor h1 {
          font-size: 2em;
          font-weight: 700;
          margin-bottom: 0.5em;
          margin-top: 0.5em;
          color: var(--foreground);
          line-height: 1.2;
        }
        
        .prose-editor h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-bottom: 0.5em;
          margin-top: 0.5em;
          color: var(--foreground);
          line-height: 1.3;
        }
        
        .prose-editor h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-bottom: 0.5em;
          margin-top: 0.5em;
          color: var(--foreground);
          line-height: 1.4;
        }
        
        .prose-editor pre {
          background-color: #1e1e1e;
          color: #d4d4d4;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
        }
        
        .prose-editor pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
        }
        
        .prose-editor blockquote {
          border-left: 3px solid var(--border);
          padding-left: 1em;
          color: var(--muted-foreground);
          margin: 1em 0;
          background-color: rgba(0,0,0,0.05);
          padding: 0.5em 1em;
          border-radius: 0 4px 4px 0;
        }
        
        .dark .prose-editor blockquote {
          background-color: rgba(255,255,255,0.05);
        }
        
        .prose-editor ul,
        .prose-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        
        .prose-editor ul {
          list-style-type: disc;
        }
        
        .prose-editor ol {
          list-style-type: decimal;
        }
        
        .prose-editor li {
          margin: 0.25em 0;
          display: list-item;
        }
        
        .prose-editor ul ul {
          list-style-type: circle;
        }
        
        .prose-editor ul ul ul {
          list-style-type: square;
        }
        
        .prose-editor ol ol {
          list-style-type: lower-alpha;
        }
        
        .prose-editor ol ol ol {
          list-style-type: lower-roman;
        }
        
        .prose-editor a {
          color: #3b82f6;
          text-decoration: underline;
          cursor: pointer;
        }

        .prose-editor a:hover {
          color: #2563eb;
        }
        
        .prose-editor hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 2em 0;
        }
        
        .prose-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .prose-editor img:hover {
          opacity: 0.9;
        }
        
        .prose-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        .prose-editor th,
        .prose-editor td {
          border: 1px solid var(--border);
          padding: 0.5em 1em;
        }
        
        .prose-editor th {
          background-color: var(--muted);
          font-weight: 600;
        }
        
        .prose-editor strong,
        .prose-editor b {
          font-weight: 600;
        }
        
        .prose-editor em,
        .prose-editor i {
          font-style: italic;
        }
        
        .prose-editor u {
          text-decoration: underline;
        }
        
        .prose-editor s,
        .prose-editor strike,
        .prose-editor del {
          text-decoration: line-through;
        }
      `}</style>
    </div>
  )
}
