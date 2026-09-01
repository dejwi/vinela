import type React from 'react'
import { calculateSpotlightRect } from '@/features/tutorial/utils'
import { Button } from '@/shared/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotlightCutout {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly borderRadius: number
}

interface TutorialPausedOverlayProps {
  readonly targetName: string
  readonly pauseReason?:
    | 'target-not-found'
    | 'wrong-route'
    | 'setup-action-failed'
    | undefined
  readonly setupError?: string | undefined
  readonly requiredRoute?: string | undefined
  readonly onNavigate?: ((route: string) => void) | undefined
  readonly onRetry: () => void
  readonly onRetrySetupAction?: (() => void) | undefined
  readonly onSkip: () => void
  readonly onNavigateAndResume?: ((route: string) => void) | undefined
}

interface TutorialOverlayProps {
  /** Target element's bounding rect. null = no target (center step). */
  readonly targetRect: DOMRect | null
  /** Padding around the spotlight cutout in px. */
  readonly spotlightPadding: number
  /** Whether the overlay is visible. */
  readonly isActive: boolean
  /** Tutorial runtime status (paused must keep overlay visible). */
  readonly status: 'idle' | 'loading' | 'active' | 'paused' | 'completing'
  /** Human-readable target name for paused messaging. */
  readonly targetName: string
  /** Why the tutorial is paused, used to tailor paused CTA. */
  readonly pauseReason?:
    | 'target-not-found'
    | 'wrong-route'
    | 'setup-action-failed'
    | undefined
  /** Error message when paused due to setup-action-failed. */
  readonly setupError?: string | undefined
  /** Required route when paused due to route mismatch. */
  readonly requiredRoute?: string | undefined
  /** Route navigation callback for wrong-route recovery. */
  readonly onNavigate?: ((route: string) => void) | undefined
  /**
   * Combined navigate + resume callback for wrong-route recovery.
   * Navigates to the required route AND resumes the tutorial in one action,
   * ensuring the paused dialog dismisses even if the route-change event fires
   * before the store update propagates.
   */
  readonly onNavigateAndResume?: ((route: string) => void) | undefined
  /** Callback when user clicks the retry button in paused state. */
  readonly onRetry: () => void
  /** Callback when user clicks retry setup action button (for setup-action-failed). */
  readonly onRetrySetupAction?: (() => void) | undefined
  /** Callback when user skips from paused state. */
  readonly onSkip: () => void
  /**
   * When true, blocks clicks outside the spotlight cutout.
   * When false (click-next steps), allows interaction with the underlying UI.
   */
  readonly blockInteractions: boolean
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Shown when the tutorial is paused because the target element was not found.
 * Gives the user a chance to retry or skip the step.
 */
function TutorialPausedOverlay({
  targetName,
  pauseReason,
  setupError,
  requiredRoute,
  onNavigate,
  onRetry,
  onRetrySetupAction,
  onSkip,
  onNavigateAndResume,
}: TutorialPausedOverlayProps): React.ReactElement {
  const isWrongRoute =
    pauseReason === 'wrong-route' && requiredRoute !== undefined
  const isSetupActionFailed = pauseReason === 'setup-action-failed'

  return (
    <div
      data-testid="tutorial-paused-overlay"
      className="absolute inset-0 flex items-center justify-center pointer-events-auto"
    >
      <div className="bg-popover text-popover-foreground border rounded-lg p-6 shadow-xl max-w-sm text-center">
        <p className="font-medium mb-2">Tutorial Paused</p>
        {isWrongRoute ? (
          <p className="text-sm text-muted-foreground mb-4">
            This step requires the{' '}
            <span className="font-medium">{requiredRoute}</span> page.
          </p>
        ) : isSetupActionFailed ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              Setup action failed while preparing this step. This might be due
              to a plugin conflict or missing dependency.
            </p>
            {setupError !== undefined && (
              <div className="bg-destructive/10 text-destructive text-xs p-2 rounded mb-4 text-left">
                <span className="font-medium">Error:</span> {setupError}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">
            We couldn&apos;t find{' '}
            <span className="font-medium">{targetName}</span>. This might happen
            if the UI hasn&apos;t loaded yet.
          </p>
        )}
        <div className="flex gap-2 justify-center">
          {isWrongRoute ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (requiredRoute !== undefined) {
                  // Navigate to the required page. The route-change handler in
                  // TutorialProvider will auto-resume once the route matches.
                  // onNavigateAndResume combines both actions for reliability.
                  if (onNavigateAndResume !== undefined) {
                    onNavigateAndResume(requiredRoute)
                  } else {
                    onNavigate?.(requiredRoute)
                  }
                }
              }}
            >
              Go to Required Page
            </Button>
          ) : isSetupActionFailed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetrySetupAction ?? onRetry}
              data-testid="retry-setup-button"
            >
              Retry Setup
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Exit tutorial
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Four invisible click-blocking regions surrounding the spotlight cutout.
 * Allows clicks to pass through to the highlighted element while blocking
 * all other interaction with the underlying UI.
 *
 * Layout:
 * ┌──────────────────────────────────┐
 * │           TOP REGION             │
 * ├────┬──────────────────┬──────────┤
 * │LEFT│   CUTOUT (gap)   │  RIGHT   │
 * ├────┴──────────────────┴──────────┤
 * │          BOTTOM REGION           │
 * └──────────────────────────────────┘
 */
function ClickBlockingRegions({
  cutout,
}: {
  readonly cutout: SpotlightCutout
}): React.ReactElement {
  const { x, y, width, height } = cutout

  return (
    <>
      {/* Top region */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: 0, left: 0, right: 0, height: y }}
      />
      {/* Bottom region */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: y + height, left: 0, right: 0, bottom: 0 }}
      />
      {/* Left region (between top and bottom) */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: y, left: 0, width: x, height }}
      />
      {/* Right region (between top and bottom) */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: y, left: x + width, right: 0, height }}
      />
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Full-screen overlay with SVG spotlight cutout.
 *
 * - Semi-transparent dark mask covers the entire viewport.
 * - A transparent cutout rect reveals the target element.
 * - Click-blocking regions prevent interaction outside the spotlight.
 * - When `status === 'paused'`, shows a retry/skip dialog.
 *
 * z-index: z-[9998] (below the tooltip at z-[9999]).
 */
export function TutorialOverlay({
  targetRect,
  spotlightPadding,
  isActive,
  status,
  targetName,
  pauseReason,
  setupError,
  requiredRoute,
  onNavigate,
  onNavigateAndResume,
  onRetry,
  onRetrySetupAction,
  onSkip,
  blockInteractions,
}: TutorialOverlayProps): React.ReactElement | null {
  if (!isActive && status !== 'paused') return null

  const cutout: SpotlightCutout | null =
    targetRect !== null
      ? calculateSpotlightRect(targetRect, spotlightPadding)
      : null

  // Phase 5: Only block clicks when explicitly requested (click-target steps)
  // For click-next steps, allow free interaction with the UI
  const shouldBlockClicks =
    status === 'active' && blockInteractions && cutout !== null

  return (
    <div
      data-testid="tutorial-overlay"
      className="fixed inset-0 z-[9998]"
      // Prevent pointer events on the container itself; children opt-in
      style={{ pointerEvents: 'none' }}
    >
      {/* SVG mask — creates the spotlight cutout effect */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <defs>
          <mask id="tutorial-spotlight-mask">
            {/* White = visible (dark overlay shows through) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black = transparent (spotlight cutout) — only when target exists */}
            {cutout !== null && (
              <rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.width}
                height={cutout.height}
                rx={cutout.borderRadius}
                fill="black"
                className="transition-all duration-300 ease-out"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#tutorial-spotlight-mask)"
        />
      </svg>

      {/* Click-blocking regions around the cutout */}
      {shouldBlockClicks && <ClickBlockingRegions cutout={cutout} />}

      {/* Paused state overlay */}
      {status === 'paused' && (
        <TutorialPausedOverlay
          targetName={targetName}
          pauseReason={pauseReason}
          setupError={setupError}
          requiredRoute={requiredRoute}
          onNavigate={onNavigate}
          onNavigateAndResume={onNavigateAndResume}
          onRetry={onRetry}
          onRetrySetupAction={onRetrySetupAction}
          onSkip={onSkip}
        />
      )}
    </div>
  )
}
