'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Save, Palette } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const CUSTOM_THEME_KEY = 'perfectmd-custom-theme-css'
const CUSTOM_THEME_STYLE_ID = 'perfectmd-custom-theme-style'
const FALLBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'
const RELEASE_API_URL = 'https://api.github.com/repos/ssbsunshengbo/perfectmd/releases/latest'

const normalizeVersion = (input: string) => input.replace(/^v/i, '').trim()

const isRemoteVersionNewer = (remote: string, local: string) => {
  const a = normalizeVersion(remote).split('.').map((n) => Number(n) || 0)
  const b = normalizeVersion(local).split('.').map((n) => Number(n) || 0)
  const maxLength = Math.max(a.length, b.length)
  for (let i = 0; i < maxLength; i += 1) {
    const av = a[i] || 0
    const bv = b[i] || 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return false
}
const AURORA_TEMPLATE_CSS = `:root {
  --background: #0a0616;
  --foreground: #f5f3ff;
  --card: rgba(20, 16, 34, 0.72);
  --card-foreground: #f8f7ff;
  --border: rgba(196, 181, 253, 0.28);
  --muted: rgba(139, 92, 246, 0.12);
  --muted-foreground: #c4b5fd;
  --accent: rgba(244, 114, 182, 0.16);
  --accent-foreground: #ffd6ef;
  --primary: #a78bfa;
  --primary-foreground: #140f24;

  --pmd-link-color: #7dd3fc;
  --pmd-code-bg: rgba(5, 10, 26, 0.9);
  --pmd-code-fg: #dbeafe;
  --pmd-code-border: rgba(125, 211, 252, 0.35);
  --pmd-table-border: rgba(196, 181, 253, 0.4);
  --pmd-table-header-bg: rgba(167, 139, 250, 0.22);
  --pmd-table-cell-bg: rgba(255, 255, 255, 0.02);
  --pmd-formula-bg: rgba(34, 211, 238, 0.1);
  --pmd-formula-fg: #cffafe;
  --pmd-formula-border: rgba(34, 211, 238, 0.45);
}

body {
  background:
    radial-gradient(1200px 700px at 15% -10%, rgba(217, 70, 239, 0.28), transparent 55%),
    radial-gradient(1200px 700px at 90% 0%, rgba(56, 189, 248, 0.2), transparent 50%),
    linear-gradient(180deg, #090412 0%, #0e1327 55%, #100a1c 100%);
}

.prose-editor p {
  border: 1px solid rgba(196, 181, 253, 0.16);
  border-radius: 10px;
  padding: 0.45rem 0.7rem;
  margin: 0.55rem 0;
  background: rgba(255, 255, 255, 0.015);
}

.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  position: relative;
  padding-left: 0.8rem;
  border-left: 3px solid rgba(244, 114, 182, 0.65);
}

.prose-editor h1 {
  background: linear-gradient(90deg, #f9a8d4, #c4b5fd 45%, #7dd3fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.prose-editor .formula-inline {
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.35), 0 0 10px rgba(34, 211, 238, 0.22);
}
`

const PAPER_SERIF_TEMPLATE_CSS = `:root {
  --background: #f7f2e7;
  --foreground: #2b2a28;
  --card: #fffaf1;
  --card-foreground: #2b2a28;
  --border: #d7c7ab;
  --muted: #efe3ce;
  --muted-foreground: #6d5f4a;
  --accent: #ead0b0;
  --accent-foreground: #3a2f25;
  --primary: #8b5a2b;
  --primary-foreground: #fffaf0;
  --pmd-link-color: #8a3b12;
  --pmd-code-bg: #f4ead9;
  --pmd-code-fg: #2e2a26;
  --pmd-code-border: #cdb898;
  --pmd-table-border: #cdb898;
  --pmd-table-header-bg: #eadcc5;
  --pmd-formula-bg: #f2e6d2;
  --pmd-formula-fg: #3f3327;
  --pmd-formula-border: #c8b292;
}
.prose-editor { font-family: 'Iowan Old Style', 'Times New Roman', serif; }
.prose-editor p {
  border-left: 3px solid rgba(139, 90, 43, 0.28);
  background: rgba(255, 250, 242, 0.55);
  padding: 0.45rem 0.9rem;
  border-radius: 0 10px 10px 0;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  color: #5e3f1b;
  letter-spacing: 0.01em;
}
`

const CYBER_GRID_TEMPLATE_CSS = `:root {
  --background: #06070d;
  --foreground: #d9f8ff;
  --card: rgba(11, 15, 30, 0.78);
  --card-foreground: #d9f8ff;
  --border: rgba(72, 224, 255, 0.3);
  --muted: rgba(44, 111, 255, 0.14);
  --muted-foreground: #9ee7ff;
  --accent: rgba(255, 74, 216, 0.18);
  --accent-foreground: #ffe7fb;
  --primary: #46d8ff;
  --primary-foreground: #021014;
  --pmd-link-color: #4dedff;
  --pmd-code-bg: #020513;
  --pmd-code-fg: #c3f8ff;
  --pmd-code-border: rgba(70, 216, 255, 0.45);
  --pmd-table-border: rgba(70, 216, 255, 0.45);
  --pmd-table-header-bg: rgba(255, 74, 216, 0.16);
  --pmd-formula-bg: rgba(70, 216, 255, 0.1);
  --pmd-formula-fg: #9cf4ff;
  --pmd-formula-border: rgba(70, 216, 255, 0.5);
}
body {
  background:
    linear-gradient(rgba(70,216,255,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(70,216,255,0.08) 1px, transparent 1px),
    radial-gradient(circle at 80% -10%, rgba(255, 74, 216, 0.2), transparent 45%),
    #04050b;
  background-size: 26px 26px, 26px 26px, auto, auto;
}
.prose-editor p {
  border: 1px solid rgba(70, 216, 255, 0.3);
  box-shadow: inset 0 0 0 1px rgba(255, 74, 216, 0.12);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  text-shadow: 0 0 10px rgba(70, 216, 255, 0.45);
}
`

const FOREST_NOTE_TEMPLATE_CSS = `:root {
  --background: #0f1d16;
  --foreground: #e8f6ee;
  --card: rgba(17, 42, 30, 0.72);
  --card-foreground: #e8f6ee;
  --border: rgba(113, 206, 155, 0.28);
  --muted: rgba(46, 116, 84, 0.18);
  --muted-foreground: #abdcc1;
  --accent: rgba(111, 187, 127, 0.2);
  --accent-foreground: #e5ffe9;
  --primary: #71ce9b;
  --primary-foreground: #0d2619;
  --pmd-link-color: #9df3cc;
  --pmd-code-bg: rgba(9, 29, 20, 0.95);
  --pmd-code-fg: #d1ffea;
  --pmd-code-border: rgba(113, 206, 155, 0.35);
  --pmd-table-border: rgba(113, 206, 155, 0.35);
  --pmd-table-header-bg: rgba(113, 206, 155, 0.2);
  --pmd-formula-bg: rgba(137, 255, 193, 0.1);
  --pmd-formula-fg: #d5ffe7;
  --pmd-formula-border: rgba(113, 206, 155, 0.45);
}
body {
  background:
    radial-gradient(circle at 8% 0%, rgba(140, 255, 190, 0.2), transparent 40%),
    radial-gradient(circle at 90% 8%, rgba(95, 194, 141, 0.17), transparent 45%),
    #0c1712;
}
.prose-editor p {
  border: 1px solid rgba(113, 206, 155, 0.22);
  background: rgba(130, 236, 173, 0.06);
  border-radius: 14px;
  padding: 0.45rem 0.75rem;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  color: #b9ffd8;
  border-bottom: 1px dashed rgba(185, 255, 216, 0.38);
  padding-bottom: 0.1rem;
}
`

export function Header() {
  const { currentDocument, updateCurrentTitle, saveDocument } = useEditorStore()
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [appVersion, setAppVersion] = useState(`v${normalizeVersion(FALLBACK_VERSION)}`)
  const [customCssDraft, setCustomCssDraft] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_THEME_KEY) || '' : ''
  )
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false)
  const selectedTemplate: 'none' | 'aurora' | 'paper' | 'cyber' | 'forest' =
    customCssDraft.trim() === AURORA_TEMPLATE_CSS.trim()
      ? 'aurora'
      : customCssDraft.trim() === PAPER_SERIF_TEMPLATE_CSS.trim()
        ? 'paper'
        : customCssDraft.trim() === CYBER_GRID_TEMPLATE_CSS.trim()
          ? 'cyber'
          : customCssDraft.trim() === FOREST_NOTE_TEMPLATE_CSS.trim()
            ? 'forest'
            : 'none'

  const applyCustomThemeCss = useCallback((cssText: string) => {
    let styleEl = document.getElementById(CUSTOM_THEME_STYLE_ID) as HTMLStyleElement | null
    const trimmed = cssText.trim()
    if (!trimmed) {
      if (styleEl) {
        styleEl.remove()
      }
      return
    }
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = CUSTOM_THEME_STYLE_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = trimmed
  }, [])

  // Track mounted state for hydration
  useEffect(() => {
    // Using a microtask to avoid synchronous setState warning
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    applyCustomThemeCss(customCssDraft)
  }, [applyCustomThemeCss, customCssDraft])

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (openedWindow) return
    } catch {
      // Continue to shell fallback.
    }
    try {
      await openExternal(url)
      return
    } catch {
      // Fallback for non-Tauri environments.
    }
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  useEffect(() => {
    let active = true
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then((version) => {
        if (!active) return
        setAppVersion(`v${normalizeVersion(version)}`)
      })
      .catch(() => {
        // Keep fallback version on web environment.
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!mounted || !appVersion) return
    let cancelled = false
    fetch(RELEASE_API_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.tag_name || !data?.html_url) return
        if (!isRemoteVersionNewer(String(data.tag_name), appVersion)) return
        const assets = Array.isArray(data.assets) ? data.assets : []
        const downloadUrl = String(assets[0]?.browser_download_url || data.html_url)
        toast.info(`发现新版本 ${data.tag_name}`, {
          action: {
            label: '下载更新',
            onClick: () => {
              openExternalUrl(downloadUrl)
            },
          },
          duration: 12000,
        })
      })
      .catch(() => {
        // Ignore network errors.
      })
    return () => {
      cancelled = true
    }
  }, [appVersion, mounted, openExternalUrl])

  const handleSaveDocument = useCallback(async () => {
    if (!currentDocument) return
    setIsSaving(true)
    await saveDocument()
    toast.success('Document saved')
    setTimeout(() => setIsSaving(false), 500)
  }, [currentDocument, saveDocument])

  // Auto-save on Ctrl+S
  useEffect(() => {
    const handleSave = () => {
      handleSaveDocument()
    }
    window.addEventListener('save-document', handleSave)
    return () => window.removeEventListener('save-document', handleSave)
  }, [handleSaveDocument])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCurrentTitle(e.target.value)
  }

  // Auto-save on blur (silent)
  const handleTitleBlur = () => {
    if (currentDocument) {
      saveDocument()
    }
  }

  const handleSaveCustomTheme = () => {
    localStorage.setItem(CUSTOM_THEME_KEY, customCssDraft)
    applyCustomThemeCss(customCssDraft)
    setIsThemeDialogOpen(false)
    toast.success('Custom theme CSS saved')
  }

  const handleResetCustomTheme = () => {
    localStorage.removeItem(CUSTOM_THEME_KEY)
    setCustomCssDraft('')
    applyCustomThemeCss('')
    toast.success('Custom theme CSS reset')
  }

  const handleApplyTemplate = (template: 'none' | 'aurora' | 'paper' | 'cyber' | 'forest') => {
    if (template === 'none') {
      setCustomCssDraft('')
      localStorage.removeItem(CUSTOM_THEME_KEY)
      applyCustomThemeCss('')
      toast.success('Template cleared')
      return
    }
    const templates: Record<'aurora' | 'paper' | 'cyber' | 'forest', { css: string; name: string }> = {
      aurora: { css: AURORA_TEMPLATE_CSS, name: 'Aurora' },
      paper: { css: PAPER_SERIF_TEMPLATE_CSS, name: 'Paper Serif' },
      cyber: { css: CYBER_GRID_TEMPLATE_CSS, name: 'Cyber Grid' },
      forest: { css: FOREST_NOTE_TEMPLATE_CSS, name: 'Forest Note' },
    }
    const selected = templates[template]
    if (!selected) return
    setCustomCssDraft(selected.css)
    localStorage.setItem(CUSTOM_THEME_KEY, selected.css)
    applyCustomThemeCss(selected.css)
    toast.success(`${selected.name} template applied`)
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Markdown Editor</h1>
        <span className="rounded border px-2 py-0.5 text-[11px] text-muted-foreground">
          {appVersion}
        </span>
        {currentDocument && (
          <span className="text-xs text-muted-foreground">
            • {isSaving ? 'Saving...' : 'Auto-saved'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {currentDocument && (
          <>
            <Input
              value={currentDocument.title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              className="h-8 w-48 text-sm"
              placeholder="Document title"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDocument}
              disabled={isSaving}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </>
        )}
        
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Palette className="h-4 w-4" />
                Theme
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsThemeDialogOpen(true)}>
                模板与自定义 CSS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={isThemeDialogOpen} onOpenChange={setIsThemeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Theme Templates & Custom CSS</DialogTitle>
            <DialogDescription>
              Choose a template or paste your custom CSS. Save to persist theme.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleApplyTemplate('aurora')}
              className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'aurora' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
            >
              <div
                className="h-20 w-full rounded-md border"
                style={{
                  background:
                    'radial-gradient(circle at 20% 10%, rgba(217,70,239,0.6), transparent 45%), radial-gradient(circle at 85% 15%, rgba(56,189,248,0.45), transparent 45%), linear-gradient(180deg, #0a0616 0%, #0e1327 50%, #100a1c 100%)',
                }}
              />
              <div className="mt-2 text-sm font-medium">Aurora Elegant</div>
              <div className="text-xs text-muted-foreground">High contrast + glow style</div>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('paper')}
              className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'paper' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
            >
              <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#fff8eb 0%,#f3e5cb 100%)' }} />
              <div className="mt-2 text-sm font-medium">Paper Serif</div>
              <div className="text-xs text-muted-foreground">Classic print / journal look</div>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('cyber')}
              className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'cyber' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
            >
              <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#05070f 0%,#0b1432 100%)' }} />
              <div className="mt-2 text-sm font-medium">Cyber Grid</div>
              <div className="text-xs text-muted-foreground">Neon contrast + futuristic lines</div>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('forest')}
              className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'forest' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
            >
              <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#0d1a14 0%,#173426 100%)' }} />
              <div className="mt-2 text-sm font-medium">Forest Note</div>
              <div className="text-xs text-muted-foreground">Natural green / elegant reading</div>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('none')}
              className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'none' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
            >
              <div
                className="h-20 w-full rounded-md border bg-background"
              />
              <div className="mt-2 text-sm font-medium">Default</div>
              <div className="text-xs text-muted-foreground">Use built-in app theme only</div>
            </button>
          </div>
          <Textarea
            value={customCssDraft}
            onChange={(e) => setCustomCssDraft(e.target.value)}
            className="h-64 font-mono text-xs"
            placeholder=":root { --pmd-code-bg: #0f172a; }"
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleResetCustomTheme}>
              Reset
            </Button>
            <Button variant="outline" onClick={() => setIsThemeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomTheme}>
              Save Theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
