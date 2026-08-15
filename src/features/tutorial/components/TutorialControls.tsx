import type React from 'react'
import { Button } from '@/shared/components/ui/button'

interface TutorialControlsProps {
  /** Current step index (0-based) */
  readonly currentStepIndex: number
  /** Total number of steps */
  readonly totalSteps: number
  /** Whether the "Previous" button should be shown */
  readonly allowBack: boolean
  /** Whether the skip button is enabled (from useSkipButtonTimer) */
  readonly skipEnabled: boolean
  /** Remaining seconds for skip timer display */
  readonly skipRemainingSeconds: number
  /** Whether the advance condition is met (enables Next button for click-target steps) */
  readonly canAdvance: boolean
  /** Advance condition type (affects Next button label and disabled state) */
  readonly advanceType: 'click-next' | 'click-target'
  /**
   * Remaining seconds until click-target fallback unlocks (from useClickTargetFallbackTimer).
   * Only relevant when advanceType is 'click-target' and canAdvance is false.
   */
  readonly fallbackRemainingSeconds?: number | undefined
  /** Whether the advance condition was satisfied by user action (click) */
  readonly advanceConditionMet?: boolean | undefined
  /** Callbacks */
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly onSkip: () => void
}

/**
 * Tutorial navigation controls: Previous, Skip, and Next/Finish buttons.
 *
 * - Skip button is disabled for the first 5 seconds (controlled by useSkipButtonTimer).
 * - Next button is disabled for click-target steps until the condition is met.
 *   Shows a countdown ("Click target (20s)" → "Click target (19s)" → … → "Continue").
 * - Previous button is hidden on the first step or when allowBack is false.
 * - Last step shows "Finish" instead of "Next →".
 * - Layout is stable: button has a minimum width to prevent size jumps.
 */
export function TutorialControls(
  props: TutorialControlsProps,
): React.ReactElement {
  const {
    currentStepIndex,
    totalSteps,
    allowBack,
    skipEnabled,
    skipRemainingSeconds,
    canAdvance,
    advanceType,
    fallbackRemainingSeconds,
    advanceConditionMet,
    onNext,
    onPrevious,
    onSkip,
  } = props

  const isLastStep = currentStepIndex === totalSteps - 1
  const isFirstStep = currentStepIndex === 0

  // For click-target steps, Next is disabled until the condition is met
  const nextDisabled = advanceType === 'click-target' && !canAdvance

  // Determine Next button label — concise and stable to prevent layout shifts
  let nextLabel: string
  if (advanceType === 'click-target' && !canAdvance) {
    // Show countdown while waiting for click or fallback
    const secs = fallbackRemainingSeconds ?? 0
    nextLabel = secs > 0 ? `Click target (${secs}s)` : 'Click target'
  } else if (isLastStep) {
    nextLabel = 'Finish'
  } else {
    nextLabel = 'Continue'
  }

  // Hint shown below controls when fallback has unlocked via timeout (not click).
  // Hidden when the user actually clicked the target (advanceConditionMet).
  const showFallbackHint =
    advanceType === 'click-target' &&
    canAdvance &&
    (fallbackRemainingSeconds ?? 1) === 0 &&
    !(advanceConditionMet ?? false)

  const showPrevious = allowBack && !isFirstStep

  return (
    <div className="flex flex-col gap-1 pt-3 border-t">
      <div className="flex items-center justify-between">
        <div>
          {showPrevious && (
            <Button variant="outline" size="sm" onClick={onPrevious}>
              ← Previous
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!skipEnabled}
            onClick={onSkip}
            className="text-muted-foreground"
          >
            {skipEnabled ? 'Skip Tutorial' : `Skip (${skipRemainingSeconds}s)`}
          </Button>
          <Button
            size="sm"
            disabled={nextDisabled}
            onClick={onNext}
            className="min-w-[110px]"
          >
            {nextLabel}
          </Button>
        </div>
      </div>
      {showFallbackHint && (
        <p className="text-xs text-muted-foreground text-right">
          Could not detect click; you can continue.
        </p>
      )}
    </div>
  )
}
