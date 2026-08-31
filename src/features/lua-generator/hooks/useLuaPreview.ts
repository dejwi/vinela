import { useEffect, useMemo, useState } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { useTheme } from '@/shared/hooks/use-theme'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseLuaPreviewParams {
  /** Lua code to highlight */
  code: string
  /** Whether highlighting is enabled (skip if dialog not visible) */
  enabled?: boolean
}

export interface UseLuaPreviewResult {
  /** Highlighted HTML string (null while loading or on error) */
  html: string | null
  /** Whether highlighting is in progress */
  isLoading: boolean
  /** Whether highlighting failed (falls back to plain text) */
  hasError: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton highlighter (shared across all instances)
// ─────────────────────────────────────────────────────────────────────────────

let highlighterPromise: Promise<Highlighter> | null = null

// Simple LRU cache for highlighted HTML
const htmlCache = new Map<string, string>()
const MAX_CACHE_ENTRIES = 50

function getHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['lua'],
      // JS regex engine, not the default WASM one: WebAssembly needs
      // 'wasm-unsafe-eval' in script-src, which the packaged app's CSP does
      // not grant, so the WASM engine silently fails there.
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

function getCacheKey(code: string, theme: string): string {
  // Simple hash for cache key
  let hash = 2166136261
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `${theme}:${(hash >>> 0).toString(16)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useLuaPreview({
  code,
  enabled = true,
}: UseLuaPreviewParams): UseLuaPreviewResult {
  const { theme } = useTheme()
  const [html, setHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light'

  const cacheKey = useMemo(
    () => getCacheKey(code, shikiTheme),
    [code, shikiTheme],
  )

  useEffect(() => {
    if (!enabled || code.length === 0) {
      setHtml(null)
      setIsLoading(false)
      setHasError(false)
      return
    }

    // Check cache first
    const cached = htmlCache.get(cacheKey)
    if (cached !== undefined) {
      setHtml(cached)
      setIsLoading(false)
      setHasError(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    async function run(): Promise<void> {
      try {
        const highlighter = await getHighlighter()
        const rendered = highlighter.codeToHtml(code, {
          lang: 'lua',
          theme: shikiTheme,
        })

        if (cancelled) return

        // Add to cache with eviction
        htmlCache.set(cacheKey, rendered)
        if (htmlCache.size > MAX_CACHE_ENTRIES) {
          const oldest = htmlCache.keys().next().value
          if (oldest !== undefined) {
            htmlCache.delete(oldest)
          }
        }

        setHtml(rendered)
        setHasError(false)
      } catch {
        if (!cancelled) {
          setHtml(null)
          setHasError(true)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [cacheKey, code, enabled, shikiTheme])

  return { html, isLoading, hasError }
}
