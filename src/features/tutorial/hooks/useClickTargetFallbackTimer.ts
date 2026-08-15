import { useEffect, useRef, useState } from 'react'

/** Fallback delay in milliseconds before click-target steps auto-unlock. */
const CLICK_TARGET_FALLBACK_MS = 20000

/** Tick interval for countdown updates in milliseconds. */
const COUNTDOWN_TICK_MS = 1000

/**
 * Provides a per-step fallback timer for `click-target` advance conditions.
 *
 * When a step requires clicking a target element, this hook starts a 20-second
 * countdown. After the delay, `fallbackElapsed` becomes `true`, allowing the
 * Next button to be enabled even if the target was never clicked.
 *
 * The timer resets whenever `stepId` changes (i.e., on every step transition).
 * When `isClickTargetStep` is false, the timer is not started and
 * `fallbackElapsed` stays `false`.
 *
 * @param stepId - Unique ID of the current step (used to reset on step change).
 * @param isClickTargetStep - Whether the current step uses `click-target` advance.
 * @returns `{ fallbackElapsed, remainingSeconds }`:
 *   - `fallbackElapsed`: true when the fallback delay has passed.
 *   - `remainingSeconds`: seconds remaining until fallback unlocks (0 when elapsed).
 */
export function useClickTargetFallbackTimer(
  stepId: string | null,
  isClickTargetStep: boolean,
): { readonly fallbackElapsed: boolean; readonly remainingSeconds: number } {
  const totalSeconds = Math.round(CLICK_TARGET_FALLBACK_MS / 1000)
  const [fallbackElapsed, setFallbackElapsed] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds)
  // Track the previous stepId to detect step changes
  const prevStepIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Reset whenever the step changes
    if (prevStepIdRef.current !== stepId) {
      prevStepIdRef.current = stepId
      setFallbackElapsed(false)
      setRemainingSeconds(totalSeconds)
    }

    if (!isClickTargetStep || stepId === null) {
      return
    }

    // Main fallback timeout
    const timeoutId = setTimeout(() => {
      setFallbackElapsed(true)
      setRemainingSeconds(0)
    }, CLICK_TARGET_FALLBACK_MS)

    // Countdown tick interval
    const startTime = Date.now()
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(
        0,
        Math.ceil((CLICK_TARGET_FALLBACK_MS - elapsed) / 1000),
      )
      setRemainingSeconds(remaining)
    }, COUNTDOWN_TICK_MS)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [stepId, isClickTargetStep, totalSeconds])

  return { fallbackElapsed, remainingSeconds }
}
