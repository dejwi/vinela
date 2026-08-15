import * as React from 'react'
import { createPortal } from 'react-dom'
import { formatSectionName } from '@/features/tutorial/utils'
import type { TooltipPlacement } from '@/shared/types/tutorial'
import { TutorialStepContent } from './TutorialStepContent'

interface TutorialTooltipProps {
  /** Step title */
  readonly title: string
  /** Step content (supports simple markdown) */
  readonly content: string
  /** Optional hint text */
  readonly hint?: string | undefined
  /** Section name for display */
  readonly section: string
  /** Current step index (0-based) */
  readonly currentStepIndex: number
  /** Total number of steps */
  readonly totalSteps: number
  /** Calculated position { x, y } in viewport pixels */
  readonly position: { readonly x: number; readonly y: number }
  /** Actual placement after collision/viewport fallback */
  readonly actualPlacement?: TooltipPlacement | undefined
  /** Whether tooltip is visible */
  readonly isVisible: boolean
  /** Whether target is being reacquired (disappeared temporarily) */
  readonly isReacquiring?: boolean
  /** Whether to render standard markdown content + hint block */
  readonly renderDefaultContent?: boolean
  /** Whether children should be pinned at the bottom while content scrolls */
  readonly stickyChildren?: boolean
  /** Children slot for TutorialControls */
  readonly children?: React.ReactNode
  /** Callback to report tooltip size changes for viewport-safe positioning */
  readonly onSizeChange?:
    | ((size: { width: number; height: number }) => void)
    | undefined
}

/**
 * Tutorial tooltip card positioned near the spotlight target.
 *
 * Renders step metadata (section, progress), title, content with markdown,
 * an optional hint, and a slot for TutorialControls.
 *
 * Rendered in a portal to avoid modal stacking contexts.
 * z-index: z-[9999] (above the overlay at z-[9998]).
 */
export function TutorialTooltip(
  props: TutorialTooltipProps,
): React.ReactElement | null {
  const {
    title,
    content,
    hint,
    section,
    currentStepIndex,
    totalSteps,
    position,
    actualPlacement,
    isVisible,
    isReacquiring,
    renderDefaultContent = true,
    stickyChildren = true,
    children,
    onSizeChange,
  } = props

  const tooltipRef = React.useRef<HTMLDivElement>(null)

  // Report size changes to parent for viewport-safe positioning
  React.useEffect(() => {
    if (!tooltipRef.current || !onSizeChange) return

    const element = tooltipRef.current

    // Initial size report
    const reportSize = (): void => {
      const rect = element.getBoundingClientRect()
      onSizeChange({ width: rect.width, height: rect.height })
    }

    reportSize()

    // Use ResizeObserver for efficient size tracking
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        onSizeChange({ width, height })
      }
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [onSizeChange])

  if (!isVisible) return null

  const stepNumber = currentStepIndex + 1
  const progressPercent = Math.round((stepNumber / totalSteps) * 100)
  const viewportHeight =
    typeof window !== 'undefined'
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 800
  const maxHeightPixels = Math.max(
    0,
    Math.floor(viewportHeight - position.y - 16),
  )
  const maxHeight = `${maxHeightPixels}px`
  const isCentered = actualPlacement === 'center'

  const tooltipStyle: React.CSSProperties = {
    minWidth: 'min(280px, calc(100vw - 32px))',
    maxWidth: 'min(400px, calc(100vw - 32px))',
    maxHeight,
    ...(isCentered
      ? {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }
      : {
          left: position.x,
          top: position.y,
        }),
  }

  const tooltipContent = (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-label={title}
      data-testid="tutorial-tooltip"
      className="fixed z-[9999] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200 transition-all"
      style={tooltipStyle}
    >
      <div
        className="bg-popover text-popover-foreground border shadow-xl rounded-lg p-4 space-y-3 overflow-y-auto"
        style={{ maxHeight }}
      >
        {/* Header: section + step progress */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatSectionName(section)}</span>
          <span>
            Step {stepNumber} of {totalSteps}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug">{title}</h3>

        {/* Content + hint */}
        {renderDefaultContent && (
          <TutorialStepContent content={content} hint={hint} />
        )}

        {/* Reacquiring indicator */}
        {isReacquiring && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Target element changed — holding position...</span>
          </div>
        )}

        {/* Progress bar */}
        <div
          className="h-1 rounded-full bg-muted overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Controls/custom slot */}
        {children !== undefined && (
          <div
            className={
              stickyChildren ? 'sticky bottom-0 bg-popover pt-2' : 'pt-1'
            }
          >
            {children}
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return tooltipContent
  }

  return createPortal(tooltipContent, document.body)
}
