import type React from 'react'
import { useMemo } from 'react'
import { cn } from '@/shared/lib/utils'
import type { ColorSchemeColors } from '@/shared/types'
import { useCodePreview } from '../hooks/useCodePreview'

interface CodePreviewProps {
  /** Stable catalog ID used for cache keys */
  themeId: string
  /** Theme colors for rendering */
  colors: ColorSchemeColors
  /** Code to display */
  code?: string
  /** Language for syntax highlighting */
  language?: string
  /** Show line numbers */
  showLineNumbers?: boolean
  /** Additional class names */
  className?: string
}

// Default sample code that showcases various syntax elements (config-focused Lua)
const DEFAULT_SAMPLE_CODE = `-- Configuration for Neovim
local config = {
  theme = "default",
  timeout = 5000,
  enabled = true,
}

function setup(opts)
  local count = opts.count or 1
  for i = 1, count do
    print("Loading: " .. i)
  end
  return config
end`

export function CodePreview({
  themeId,
  colors,
  code = DEFAULT_SAMPLE_CODE,
  language = 'lua',
  showLineNumbers = true,
  className,
}: CodePreviewProps): React.JSX.Element {
  const { containerRef, html, isLoading, hasError, isVisible } = useCodePreview(
    {
      themeId,
      colors,
      code,
      language,
      showLineNumbers: false, // Shiki doesn't handle this well - we render manually
    },
  )

  const lineCount = useMemo(() => code.split('\n').length, [code])

  const previewStyle = useMemo(
    () => ({ backgroundColor: colors.background, color: colors.foreground }),
    [colors.background, colors.foreground],
  )

  if (!isVisible || isLoading) {
    return (
      <output
        ref={containerRef as React.Ref<HTMLOutputElement>}
        aria-live="polite"
        className={cn('block rounded-lg animate-pulse', className)}
        style={{ backgroundColor: colors.background, minHeight: 200 }}
      >
        <span className="sr-only">Theme preview loading</span>
      </output>
    )
  }

  if (hasError || html === null) {
    return (
      <div ref={containerRef} className={className}>
        <pre
          className={cn(
            'rounded-lg overflow-auto text-sm font-mono p-4',
            'select-text cursor-text',
          )}
          style={previewStyle}
        >
          {code}
        </pre>
      </div>
    )
  }

  // Success state - with manual line number rendering
  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-lg overflow-hidden text-sm font-mono',
        'select-text cursor-text',
        className,
      )}
      style={previewStyle}
    >
      <div className="flex">
        {/* Line numbers gutter */}
        {showLineNumbers && (
          <div
            className="flex-shrink-0 text-right pr-3 pl-3 py-2 select-none border-r"
            style={{
              color: colors.lineNumber,
              borderColor: colors.ui.border,
            }}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={`line-${i + 1}`} className="leading-[1.7]">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code content - strip Shiki's default styling */}
        <div
          className="flex-1 overflow-x-auto py-2 pl-3 pr-2 [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!bg-transparent [&_code]:leading-[1.7]"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from Shiki
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
