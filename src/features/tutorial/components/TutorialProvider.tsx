import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { runSetupAction } from '@/features/tutorial/data/setup-actions'
import { TUTORIAL_STEPS } from '@/features/tutorial/data/steps'
import { useClickTargetFallbackTimer } from '@/features/tutorial/hooks/useClickTargetFallbackTimer'
import { useSkipButtonTimer } from '@/features/tutorial/hooks/useSkipButtonTimer'
import { useTutorialTarget } from '@/features/tutorial/hooks/useTutorialTarget'
import { useTutorialStore } from '@/features/tutorial/store'
import {
  calculateTooltipPositionWithCollision,
  detectOpenFloatingSurfaces,
  getViewportSize,
  TOOLTIP_VIEWPORT_PADDING,
} from '@/features/tutorial/utils'
import type {
  TooltipPlacement,
  TutorialRuntimeState,
} from '@/shared/types/tutorial'

/** Type guard for active runtime state */
function isActiveRuntimeState(
  state: TutorialRuntimeState,
): state is Extract<TutorialRuntimeState, { status: 'active' }> {
  return state.status === 'active'
}

import { TutorialConclusionStep } from './TutorialConclusionStep'
import { TutorialControls } from './TutorialControls'
import { TutorialOverlay } from './TutorialOverlay'
import { TutorialTooltip } from './TutorialTooltip'

/** Grace window duration (ms) after a nav-target click before route checks resume. */
const NAV_INTENT_GRACE_MS = 400

/**
 * TutorialProvider manages the tutorial lifecycle and renders the overlay/tooltip.
 * It reads from the tutorial store and composes Phase 2 UI components.
 *
 * Mount this inside the router context (in Layout) so it has access to navigation.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: React component with multiple coordinated effects and callbacks
export function TutorialProvider({
  children,
}: {
  readonly children: React.ReactNode
}): React.ReactElement {
  const runtimeState = useTutorialStore((s) => s.runtimeState)
  const navigate = useNavigate()
  const location = useLocation()

  // Derive current step from store
  const currentStep =
    runtimeState.status === 'active' || runtimeState.status === 'paused'
      ? (TUTORIAL_STEPS[runtimeState.currentStepIndex] ?? null)
      : null

  // Skip button timer (sole source of truth)
  const { isEnabled: skipEnabled, remainingSeconds: skipRemaining } =
    useSkipButtonTimer(
      runtimeState.status === 'active' || runtimeState.status === 'paused',
    )

  // Click-target fallback timer: enables Next after 20s even if target not clicked
  const isClickTargetStep =
    currentStep?.advanceCondition.type === 'click-target'
  const { fallbackElapsed, remainingSeconds: fallbackRemaining } =
    useClickTargetFallbackTimer(currentStep?.id ?? null, isClickTargetStep)

  // Nav-intent grace window: tracks whether a nav-target click just happened.
  // When active, route changes are tolerated without triggering wrong-route pause.
  const navIntentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isNavIntentActiveRef = useRef(false)

  const activateNavIntent = useCallback((): void => {
    isNavIntentActiveRef.current = true
    if (navIntentTimerRef.current !== null) {
      clearTimeout(navIntentTimerRef.current)
    }
    navIntentTimerRef.current = setTimeout(() => {
      isNavIntentActiveRef.current = false
      navIntentTimerRef.current = null
    }, NAV_INTENT_GRACE_MS)
  }, [])

  // Cleanup nav-intent timer on unmount
  useEffect(() => {
    return () => {
      if (navIntentTimerRef.current !== null) {
        clearTimeout(navIntentTimerRef.current)
      }
    }
  }, [])

  // Target element observer
  // Fix 2: Pass isSearchActive so paused state stops the search loop;
  // resuming (active again) re-runs the effect and restarts the search.
  // Phase 3: Use lastStableRect for positioning during target transitions
  const {
    element: targetElement,
    rect: targetRect,
    lastStableRect,
    isSearching,
    isReacquiring,
  } = useTutorialTarget(
    currentStep?.target ?? null,
    runtimeState.status === 'active',
  )

  // Step-entry gating: Track which step index was last processed for setup action
  // This prevents setup actions from re-running on runtimeState mutations within the same step
  const lastProcessedStepIndexRef = useRef<number | null>(null)

  // Route-sync gating: Track which step index was last synced for navigation
  // This prevents duplicate navigation when the step hasn't changed
  const lastSyncedStepIndexRef = useRef<number | null>(null)

  // Track the last setup action error for display in paused overlay
  const [setupError, setSetupError] = useState<string | null>(null)

  // Track if we're currently retrying a setup action to prevent duplicate retries
  const isRetryingRef = useRef(false)

  // Per-step lock to prevent double-fire of auto-next
  const autoNextFiredRef = useRef<string | null>(null)

  // Refs to hold runtime values for the click handler (avoiding dependency array type issues)
  const isTransitioningRef = useRef<boolean>(false)
  const currentStepIndexRef = useRef<number>(0)

  // Update refs when runtime state changes
  useEffect(() => {
    if (isActiveRuntimeState(runtimeState)) {
      isTransitioningRef.current = runtimeState.isTransitioning
      currentStepIndexRef.current = runtimeState.currentStepIndex
    }
  }, [runtimeState])

  // Get current step index safely
  const currentStepIndex =
    runtimeState.status === 'active' || runtimeState.status === 'paused'
      ? runtimeState.currentStepIndex
      : null

  // Run setup action when entering a new step (step-entry gating)
  useEffect(() => {
    // Only run when tutorial is active
    if (runtimeState.status !== 'active') return

    // Only run if we have a valid step index
    if (currentStepIndex === null) return

    // Check if we've already processed this step index
    if (lastProcessedStepIndexRef.current === currentStepIndex) {
      return
    }

    // Check if the current step has a setup action
    if (currentStep?.setupActionId === undefined) {
      // Still mark as processed so we don't re-check unnecessarily
      lastProcessedStepIndexRef.current = currentStepIndex
      return
    }

    // Capture the step index we're about to process (for stale promise guard)
    const stepIndexBeingProcessed = currentStepIndex

    // Mark this step as processed immediately to prevent duplicate runs
    lastProcessedStepIndexRef.current = currentStepIndex

    // Clear any previous error when starting a new setup action
    setSetupError(null)

    // Execute the setup action with error handling
    const executeSetupAction = async (): Promise<void> => {
      try {
        if (currentStep.setupActionId === undefined) {
          throw new Error(
            'Invariant: setupActionId is undefined after truthy check',
          )
        }
        await runSetupAction(currentStep.setupActionId)
      } catch (err) {
        // Guard against stale promises: check if step/stepIndex changed during execution
        const currentRuntime = useTutorialStore.getState().runtimeState
        const currentIndex =
          currentRuntime.status === 'active' ||
          currentRuntime.status === 'paused'
            ? currentRuntime.currentStepIndex
            : null

        if (currentIndex !== stepIndexBeingProcessed) {
          // Step changed during execution, ignore this error
          return
        }

        // Capture error message for display
        const errorMessage =
          err instanceof Error ? err.message : 'Setup action failed'
        setSetupError(errorMessage)

        // Pause the tutorial with setup-action-failed reason
        useTutorialStore.getState().pauseTutorial('setup-action-failed')
      }
    }

    void executeSetupAction()
  }, [currentStepIndex, runtimeState.status, currentStep?.setupActionId])

  // Reset processed step index when tutorial becomes inactive (to allow re-entry)
  // Also reset route-sync ref to prevent stale navigation state across lifecycle transitions
  useEffect(() => {
    if (runtimeState.status === 'idle' || runtimeState.status === 'loading') {
      lastProcessedStepIndexRef.current = null
      lastSyncedStepIndexRef.current = null
    }
  }, [runtimeState.status])

  // Retry handler for setup-action-failed paused state
  const handleRetrySetupAction = useCallback(async (): Promise<void> => {
    if (currentStep?.setupActionId === undefined) return
    if (isRetryingRef.current) return

    isRetryingRef.current = true
    setSetupError(null)

    try {
      await runSetupAction(currentStep.setupActionId)
      // Success: resume the tutorial
      useTutorialStore.getState().resumeTutorial()
    } catch (err) {
      // Failure: update error message and stay paused
      const errorMessage =
        err instanceof Error ? err.message : 'Setup action failed'
      setSetupError(errorMessage)
    } finally {
      isRetryingRef.current = false
    }
  }, [currentStep?.setupActionId])

  // Route change monitoring — pass nav-intent flag to allow in-flight nav transitions
  useEffect(() => {
    useTutorialStore
      .getState()
      .handleRouteChange(location.pathname, isNavIntentActiveRef.current)
  }, [location.pathname])

  // Navigation for step transitions
  const handleNextStep = useCallback(async (): Promise<void> => {
    await useTutorialStore.getState().nextStep()
  }, [])

  // Phase 3: Centralized route sync — handles both next AND previous navigation
  // Use a ref to gate so we only sync on step transitions, not every pathname change

  // Use derived currentStepIndex from earlier in the component
  useEffect(() => {
    // Only sync when tutorial is active or paused
    if (runtimeState.status !== 'active' && runtimeState.status !== 'paused') {
      return
    }

    // Get current step index safely using the derived value
    const stepIndex =
      runtimeState.status === 'active' || runtimeState.status === 'paused'
        ? runtimeState.currentStepIndex
        : null

    if (stepIndex === null) return

    const step = TUTORIAL_STEPS[stepIndex]

    // Only sync when step index changes
    if (lastSyncedStepIndexRef.current === stepIndex) {
      return
    }

    lastSyncedStepIndexRef.current = stepIndex

    // Navigate if step requires a different route
    if (
      step?.requiredRoute !== undefined &&
      step.requiredRoute !== null &&
      location.pathname !== step.requiredRoute
    ) {
      navigate(step.requiredRoute)
    }
  }, [runtimeState, location.pathname, navigate])

  // Click-target advance condition listener.
  // For nav-target steps (target is a nav element), also activate the nav-intent
  // grace window so the route change doesn't trigger a wrong-route pause.
  useEffect(() => {
    if (targetElement === null) return
    if (currentStep?.advanceCondition.type !== 'click-target') return
    if (runtimeState.status !== 'active') return
    const isNavTarget = currentStep.target?.startsWith('nav-') === true

    // Capture current step info for async callbacks
    const stepId = currentStep.id
    const advanceCondition = currentStep.advanceCondition
    // Use refs to avoid dependency array type issues with discriminated union
    const isTransitioning = isTransitioningRef.current
    const stepIndex = currentStepIndexRef.current

    const handler = (): void => {
      const store = useTutorialStore.getState()
      store.satisfyAdvanceCondition()

      // Activate grace window for nav-target steps to prevent wrong-route pause
      if (isNavTarget) {
        activateNavIntent()
      }

      // Handle auto-next policy
      if (
        advanceCondition.onSuccess === 'auto-next' &&
        !isTransitioning &&
        autoNextFiredRef.current !== stepId
      ) {
        autoNextFiredRef.current = stepId
        const debounceMs = advanceCondition.advanceDebounceMs ?? 150

        // Use setTimeout to allow UI transitions (modal open, etc.) before advancing
        setTimeout(() => {
          // Guard: only advance if still on same step and not transitioning
          const currentState = useTutorialStore.getState().runtimeState
          if (!isActiveRuntimeState(currentState)) return
          if (
            !currentState.isTransitioning &&
            currentState.currentStepIndex === stepIndex
          ) {
            void handleNextStep()
          }
        }, debounceMs)
      }
    }

    targetElement.addEventListener('click', handler, { capture: true })
    return () =>
      targetElement.removeEventListener('click', handler, { capture: true })
  }, [
    targetElement,
    currentStep,
    runtimeState.status,
    activateNavIntent,
    handleNextStep,
  ])

  // Keyboard shortcuts
  useEffect(() => {
    if (runtimeState.status !== 'active') return

    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && skipEnabled) {
        void useTutorialStore.getState().skipTutorial()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [runtimeState.status, skipEnabled])

  // Calculate tooltip position with collision-aware placement fallback.
  // Uses useState so it can be updated reactively when floating surfaces
  // (e.g. the node palette popover) open or close — useMemo would not
  // re-run in response to DOM mutations outside React's render cycle.
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number
    y: number
    actualPlacement: TooltipPlacement
  } | null>(null)

  // Track measured tooltip size for viewport-safe positioning
  const [measuredTooltipSize, setMeasuredTooltipSize] = useState<{
    width: number
    height: number
  }>({ width: 380, height: 250 })

  const computeTooltipPosition = useCallback((): {
    x: number
    y: number
    actualPlacement: TooltipPlacement
  } | null => {
    if (currentStep === null) return null
    if (runtimeState.status !== 'active') return null

    const viewport = getViewportSize()

    const shouldCenterTooltip =
      currentStep.tooltipPlacement === 'center' || currentStep.target === null

    if (shouldCenterTooltip) {
      return {
        x: viewport.width / 2,
        y: TOOLTIP_VIEWPORT_PADDING,
        actualPlacement: 'center' as const,
      }
    }

    // Re-read live target rect when available so window resizes and scrollable
    // container layout shifts are reflected immediately.
    const liveTargetRect = targetElement?.getBoundingClientRect()
    const hasLiveTargetRect =
      liveTargetRect !== undefined &&
      liveTargetRect.width > 0 &&
      liveTargetRect.height > 0

    // Phase 3: Use lastStableRect during reacquisition to prevent corner jumps.
    const effectiveRect = hasLiveTargetRect
      ? liveTargetRect
      : (targetRect ?? lastStableRect)
    if (effectiveRect === null) return null

    // Detect open floating surfaces to avoid overlapping them
    const floatingSurfaces = detectOpenFloatingSurfaces()

    // Calculate position with collision detection using measured size
    const position = calculateTooltipPositionWithCollision(
      effectiveRect,
      measuredTooltipSize,
      currentStep.tooltipPlacement,
      currentStep.spotlightPadding ?? 8,
      floatingSurfaces,
    )

    return {
      x: position.x,
      y: position.y,
      actualPlacement: position.actualPlacement,
    }
  }, [
    currentStep,
    targetElement,
    targetRect,
    lastStableRect,
    runtimeState.status,
    measuredTooltipSize,
  ])

  const isActive = runtimeState.status === 'active'

  const resolvedTooltipPosition = useMemo(() => {
    if (!isActive || currentStep === null || tooltipPosition === null) {
      return tooltipPosition
    }

    if (currentStep.tooltipPlacement !== 'center') {
      return tooltipPosition
    }

    const viewport = getViewportSize()

    return {
      x: viewport.width / 2,
      y: TOOLTIP_VIEWPORT_PADDING,
      actualPlacement: 'center' as const,
    }
  }, [isActive, currentStep, tooltipPosition])

  // Recompute position whenever core deps change (step, rect, status)
  useEffect(() => {
    setTooltipPosition(computeTooltipPosition())
  }, [computeTooltipPosition])

  // Keep tooltip responsive to viewport changes.
  useEffect(() => {
    if (runtimeState.status !== 'active') return
    if (currentStep === null) return

    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
    const recalculatePosition = (): void => {
      if (resizeDebounceTimer !== null) {
        clearTimeout(resizeDebounceTimer)
      }

      resizeDebounceTimer = setTimeout(() => {
        setTooltipPosition(computeTooltipPosition())
      }, 50)
    }

    window.addEventListener('resize', recalculatePosition)

    const visualViewport = window.visualViewport
    if (visualViewport) {
      visualViewport.addEventListener('resize', recalculatePosition)
      visualViewport.addEventListener('scroll', recalculatePosition)
    }

    return () => {
      if (resizeDebounceTimer !== null) {
        clearTimeout(resizeDebounceTimer)
      }
      window.removeEventListener('resize', recalculatePosition)
      if (visualViewport) {
        visualViewport.removeEventListener('resize', recalculatePosition)
        visualViewport.removeEventListener('scroll', recalculatePosition)
      }
    }
  }, [runtimeState.status, currentStep, computeTooltipPosition])

  // Watch for floating surfaces (popovers/menus) opening or closing via
  // MutationObserver so the tooltip repositions when the palette opens.
  // Only active when the tutorial is active and a target step is shown.
  useEffect(() => {
    if (runtimeState.status !== 'active') return
    if (currentStep === null || currentStep.target === null) return

    const observer = new MutationObserver(() => {
      setTooltipPosition(computeTooltipPosition())
    })

    // Watch the document body for subtree changes — Radix UI portals append
    // popper content wrappers directly to <body>, so we need subtree: true.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'data-tutorial-popover'],
    })

    return () => {
      observer.disconnect()
    }
  }, [runtimeState.status, currentStep, computeTooltipPosition])

  const showOverlay = isActive || runtimeState.status === 'paused'

  // Derive canAdvance for controls.
  // For click-target steps: advance is allowed when the target was clicked
  // (advanceConditionMet) OR when the 20-second fallback timer has elapsed.
  const canAdvance =
    currentStep?.advanceCondition.type === 'click-next' ||
    (runtimeState.status === 'active' &&
      (runtimeState.advanceConditionMet || fallbackElapsed))

  // Determine retry handler based on pause reason
  const isSetupActionFailed =
    runtimeState.status === 'paused' &&
    runtimeState.reason === 'setup-action-failed'

  // Phase 5: Compute blockInteractions based on step advance condition
  // Only block clicks for click-target steps; click-next steps allow free interaction
  const blockInteractions =
    currentStep?.advanceCondition.type === 'click-target'

  return (
    <>
      {children}

      {/* Overlay */}
      {showOverlay && (
        <TutorialOverlay
          targetRect={targetRect}
          spotlightPadding={currentStep?.spotlightPadding ?? 8}
          isActive={isActive}
          status={runtimeState.status}
          targetName={currentStep?.target ?? 'the highlighted element'}
          pauseReason={
            runtimeState.status === 'paused' ? runtimeState.reason : undefined
          }
          setupError={setupError ?? undefined}
          requiredRoute={currentStep?.requiredRoute ?? undefined}
          onNavigate={(route) => navigate(route)}
          onNavigateAndResume={(route) => {
            // Navigate to the required route, then immediately resume the
            // tutorial. The route-change effect will also auto-resume, but
            // calling resumeTutorial() here ensures the dialog dismisses even
            // if the effect fires after a React render cycle delay.
            navigate(route)
            useTutorialStore.getState().resumeTutorial()
          }}
          onRetry={() => useTutorialStore.getState().resumeTutorial()}
          onRetrySetupAction={
            isSetupActionFailed ? handleRetrySetupAction : undefined
          }
          onSkip={() => void useTutorialStore.getState().skipTutorial()}
          blockInteractions={blockInteractions}
        />
      )}

      {/* Tooltip */}
      {isActive && currentStep !== null && resolvedTooltipPosition !== null && (
        <TutorialTooltip
          title={currentStep.title}
          content={currentStep.content}
          hint={currentStep.id === 'conclusion' ? undefined : currentStep.hint}
          section={currentStep.section}
          currentStepIndex={runtimeState.currentStepIndex}
          totalSteps={TUTORIAL_STEPS.length}
          position={resolvedTooltipPosition}
          actualPlacement={resolvedTooltipPosition.actualPlacement}
          isVisible={!isSearching}
          isReacquiring={isReacquiring}
          renderDefaultContent={currentStep.id !== 'conclusion'}
          stickyChildren={currentStep.id !== 'conclusion'}
          onSizeChange={setMeasuredTooltipSize}
        >
          {currentStep.id === 'conclusion' ? (
            <TutorialConclusionStep
              onFinish={() => {
                void useTutorialStore
                  .getState()
                  .completeTutorial()
                  .finally(() => {
                    navigate('/', { replace: true })
                  })
              }}
              onKeepExploring={() =>
                void useTutorialStore.getState().keepExploring()
              }
            />
          ) : (
            <TutorialControls
              currentStepIndex={runtimeState.currentStepIndex}
              totalSteps={TUTORIAL_STEPS.length}
              allowBack={currentStep.allowBack !== false}
              skipEnabled={skipEnabled}
              skipRemainingSeconds={skipRemaining}
              canAdvance={canAdvance}
              advanceType={currentStep.advanceCondition.type}
              fallbackRemainingSeconds={
                isClickTargetStep ? fallbackRemaining : undefined
              }
              advanceConditionMet={
                runtimeState.status === 'active'
                  ? runtimeState.advanceConditionMet
                  : false
              }
              onNext={() => void handleNextStep()}
              onPrevious={() => useTutorialStore.getState().previousStep()}
              onSkip={() => void useTutorialStore.getState().skipTutorial()}
            />
          )}
        </TutorialTooltip>
      )}
    </>
  )
}
