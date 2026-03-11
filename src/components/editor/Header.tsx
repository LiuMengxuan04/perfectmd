'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Moon, Sun, FileText, Save, Palette } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
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

export function Header() {
  const { currentDocument, updateCurrentTitle, saveDocument } = useEditorStore()
  const { theme, setTheme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [customCssDraft, setCustomCssDraft] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_THEME_KEY) || '' : ''
  )
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false)

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

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Markdown Editor</h1>
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
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Palette className="h-4 w-4" />
                  Theme
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  System
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsThemeDialogOpen(true)}>
                  Custom CSS Theme
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Quick light/dark toggle"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </>
        )}
      </div>

      <Dialog open={isThemeDialogOpen} onOpenChange={setIsThemeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Custom Theme CSS</DialogTitle>
            <DialogDescription>
              Paste your custom CSS to style editor components. It will be applied instantly after saving.
            </DialogDescription>
          </DialogHeader>
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
