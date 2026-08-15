import { useEffect, useState } from 'react'

/** Delay in milliseconds before the skip button becomes enabled. */
const SKIP_DELAY_MS = 5000

/** Countdown interval in milliseconds (1 second ticks). */
const COUNTDOWN_INTERVAL_MS = 1000

/** Initial remaining seconds shown in the countdown. */
const INITIAL_REMAINING_SECONDS = 5

/**
 * Manages the 5-second delay before the skip button becomes enabled.
 * Timer starts when `isActive` becomes true and resets when it becomes false.
 *
 * This is the SOLE source of truth for skip button enabled state.
 * The store does NOT track this — it's purely a UI concern.
 */
export function useSkipButtonTimer(isActive: boolean): {
  readonly isEnabled: boolean
  readonly remainingSeconds: number
} {
  const [isEnabled, setIsEnabled] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(
    INITIAL_REMAINING_SECONDS,
  )

  useEffect(() => {
    if (!isActive) {
      // Reset when tutorial becomes inactive
      setIsEnabled(false)
      setRemainingSeconds(INITIAL_REMAINING_SECONDS)
      return
    }

    // Start countdown display (cosmetic — ticks every second)
    const intervalId = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1))
    }, COUNTDOWN_INTERVAL_MS)

    // Actual enable happens after full delay
    const timeoutId = setTimeout(() => {
      setIsEnabled(true)
      setRemainingSeconds(0)
    }, SKIP_DELAY_MS)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [isActive])

  return { isEnabled, remainingSeconds }
}
