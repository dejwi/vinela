import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import { useLuaPreview } from '../hooks/useLuaPreview'

interface LuaPreviewProps {
  code: string
  /** When true, hides the collapsible header (used inside tab layout) */
  embedded?: boolean
}

export function LuaPreview({
  code,
  embedded = false,
}: LuaPreviewProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const { html, isLoading, hasError } = useLuaPreview({
    code,
    // In embedded mode the code is always visible, so always enable highlighting
    enabled: embedded ? true : isOpen,
  })

  const lineCount = useMemo(() => code.split('\n').length, [code])

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [code])

  /** Shared code block (line numbers + highlighted body). */
  const codeBlock = (
    <div className="flex text-sm font-mono min-w-max">
      {/* Line numbers gutter */}
      <div
        className="flex-shrink-0 text-right pr-3 pl-3 py-3 select-none border-r bg-muted/20 text-muted-foreground sticky left-0"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={`line-${i + 1}`} className="leading-[1.7]">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code body */}
      <div className="flex-1 py-3 pl-3 pr-3">
        {isLoading && (
          <div className="animate-pulse space-y-1">
            {Array.from({ length: Math.min(lineCount, 10) }, (_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are ephemeral loading placeholders
                key={`skeleton-${i}`}
                className="h-[1.7em] bg-muted rounded"
                style={{ width: `${40 + ((i * 7) % 50)}%` }}
              />
            ))}
          </div>
        )}

        {!isLoading && html !== null && !hasError && (
          <div
            className="[&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!bg-transparent [&_code]:leading-[1.7]"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from Shiki
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {!isLoading && (hasError || html === null) && (
          <pre className="leading-[1.7] whitespace-pre">{code}</pre>
        )}
      </div>
    </div>
  )

  /** Shared copy button content. */
  const copyButtonContent = copied ? (
    <>
      <Check className="w-3.5 h-3.5" />
      <span className="text-xs">Copied</span>
    </>
  ) : (
    <>
      <Copy className="w-3.5 h-3.5" />
      <span className="text-xs">Copy</span>
    </>
  )

  if (embedded) {
    // No collapsible header — show code directly with a floating copy button
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="relative">
          {/* Floating copy button in top-right corner */}
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleCopy()}
              className="gap-2 bg-background/80 backdrop-blur-sm"
            >
              {copyButtonContent}
            </Button>
          </div>
          {/* Native overflow container */}
          <div className="overflow-auto">{codeBlock}</div>
        </div>
      </div>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-1">
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Generated Lua</span>
              <span className="text-xs text-muted-foreground">
                ({lineCount} lines)
              </span>
            </Button>
          </CollapsibleTrigger>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleCopy()}
            className="gap-2"
          >
            {copyButtonContent}
          </Button>
        </div>

        {/* Code content */}
        <CollapsibleContent>
          {/* Native overflow container — avoids Radix ScrollArea viewport height edge-cases */}
          <div className="max-h-[400px] overflow-auto">{codeBlock}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
