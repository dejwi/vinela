import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createHighlighter } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { ColorSchemeColors } from '@/shared/types'

interface UseCodePreviewParams {
  themeId: string
  colors: ColorSchemeColors
  code: string
  language: string
  showLineNumbers: boolean
}

interface UseCodePreviewResult {
  containerRef: MutableRefObject<HTMLDivElement | null>
  html: string | null
  isLoading: boolean
  hasError: boolean
  isVisible: boolean
}

let highlighterPromise: Promise<
  Awaited<ReturnType<typeof createHighlighter>>
> | null = null
const htmlCache = new Map<string, string>()
const MAX_CACHE_ENTRIES = 400

function getHighlighter() {
  if (highlighterPromise === null) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['vim', 'lua'],
      // See useLuaPreview: the WASM engine is blocked by the packaged app's CSP.
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

function hashCode(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function toShikiTheme(colors: ColorSchemeColors): object {
  return {
    name: 'colorscheme-preview',
    type: 'dark',
    colors: {
      'editor.background': colors.background,
      'editor.foreground': colors.foreground,
      'editorLineNumber.foreground': colors.lineNumber,
      'editor.lineHighlightBackground': colors.lineHighlight,
      'editor.selectionBackground': colors.selection,
    },
    tokenColors: [
      { scope: 'comment', settings: { foreground: colors.tokens.comment } },
      {
        scope: ['keyword', 'storage'],
        settings: { foreground: colors.tokens.keyword },
      },
      { scope: 'string', settings: { foreground: colors.tokens.string } },
      {
        scope: 'constant.numeric',
        settings: { foreground: colors.tokens.number },
      },
      {
        scope: ['entity.name.function', 'support.function'],
        settings: { foreground: colors.tokens.function },
      },
      { scope: 'variable', settings: { foreground: colors.tokens.variable } },
      {
        scope: ['entity.name.type', 'support.type'],
        settings: { foreground: colors.tokens.type },
      },
      { scope: 'constant', settings: { foreground: colors.tokens.constant } },
      {
        scope: 'keyword.operator',
        settings: { foreground: colors.tokens.operator },
      },
      {
        scope: 'punctuation',
        settings: { foreground: colors.tokens.punctuation },
      },
    ],
  }
}

export function useCodePreview({
  themeId,
  colors,
  code,
  language,
  showLineNumbers,
}: UseCodePreviewParams): UseCodePreviewResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [html, setHtml] = useState<string | null>(null)

  const cacheKey = useMemo(
    () =>
      `${themeId}:${hashCode(code)}:${language}:${showLineNumbers ? 'ln' : 'noln'}`,
    [themeId, code, language, showLineNumbers],
  )

  // Viewport-lazy rendering: do not highlight cards until visible.
  useEffect(() => {
    const element = containerRef.current
    if (element === null) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const cached = htmlCache.get(cacheKey)
    if (cached !== undefined) {
      setHtml(cached)
      setHasError(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    function addToCacheWithEviction(key: string, value: string): void {
      htmlCache.set(key, value)
      if (htmlCache.size > MAX_CACHE_ENTRIES) {
        const oldest = htmlCache.keys().next().value
        if (oldest !== undefined) {
          htmlCache.delete(oldest)
        }
      }
    }

    async function run(): Promise<void> {
      try {
        const highlighter = await getHighlighter()
        const theme = toShikiTheme(colors)
        const rendered = highlighter.codeToHtml(code, {
          lang: language,
          theme: theme as Record<string, unknown>,
        })

        if (cancelled) {
          return
        }

        addToCacheWithEviction(cacheKey, rendered)

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
  }, [cacheKey, code, colors, isVisible, language])

  return { containerRef, html, isLoading, hasError, isVisible }
}
