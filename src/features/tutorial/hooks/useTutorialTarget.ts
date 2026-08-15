import { useEffect, useRef, useState } from 'react'
import { useTutorialStore } from '@/features/tutorial/store'
import { scrollTargetIntoView } from '@/features/tutorial/utils'

/** Timeout in milliseconds before pausing the tutorial if target not found. */
const TARGET_SEARCH_TIMEOUT_MS = 5000

/** Debounce delay for rect updates in milliseconds. */
const RECT_UPDATE_DEBOUNCE_MS = 50

/** Grace window duration (ms) for target reacquisition before pausing */
const TARGET_REACQUIRE_GRACE_MS = 800

/** Minimum rect dimensions (px) to consider valid */
const MIN_VALID_RECT_SIZE = 4

/**
 * Finds and observes a target element by its data-tutorial attribute.
 * Returns the element and its bounding rect, updating on resize/scroll.
 *
 * If the element is not found after 5 seconds, transitions the tutorial to
 * 'paused' state instead of auto-advancing (Fix #5 — no auto-skip).
 *
 * Fix #2: `isSearchActive` gates the search. When false (e.g. tutorial is
 * paused), no search is started. When it transitions from false → true for
 * the same `targetId`, the effect re-runs and restarts the search.
 *
 * Phase 3: Added lastStableRect tracking and reacquire grace window to handle
 * disappearing targets gracefully (e.g., install button mutates/disappears).
 */
export function useTutorialTarget(
  targetId: string | null,
  isSearchActive: boolean,
): {
  readonly element: HTMLElement | null
  readonly rect: DOMRect | null
  readonly lastStableRect: DOMRect | null
  readonly isSearching: boolean
  readonly isReacquiring: boolean
} {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isReacquiring, setIsReacquiring] = useState(false)

  // Track last stable rect to prevent tooltip jump during target transitions
  const lastStableRectRef = useRef<DOMRect | null>(null)

  // Refs for cleanup
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollListenerRef = useRef<(() => void) | null>(null)
  const reacquireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  // Track reacquiring state via ref to avoid dependency cycle
  const isReacquiringRef = useRef<boolean>(false)

  useEffect(() => {
    // Cleanup helper
    const cleanup = (): void => {
      if (mutationObserverRef.current !== null) {
        mutationObserverRef.current.disconnect()
        mutationObserverRef.current = null
      }
      if (resizeObserverRef.current !== null) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      if (rectDebounceRef.current !== null) {
        clearTimeout(rectDebounceRef.current)
        rectDebounceRef.current = null
      }
      if (scrollListenerRef.current !== null) {
        window.removeEventListener('scroll', scrollListenerRef.current, true)
        scrollListenerRef.current = null
      }
      if (reacquireTimeoutRef.current !== null) {
        clearTimeout(reacquireTimeoutRef.current)
        reacquireTimeoutRef.current = null
      }
    }

    // Reset state when targetId or isSearchActive changes
    setElement(null)
    setRect(null)
    setIsSearching(false)
    setIsReacquiring(false)
    cleanup()

    // Fix 2: Gate search on active state — paused state must not search
    if (!isSearchActive) {
      return cleanup
    }

    // No target — nothing to observe
    if (targetId === null) {
      return cleanup
    }

    // Helper: check if rect is valid (not collapsed/minimal)
    const isValidRect = (r: DOMRect): boolean => {
      return r.width >= MIN_VALID_RECT_SIZE && r.height >= MIN_VALID_RECT_SIZE
    }

    // Helper: update rect from element and track last stable rect
    const updateRect = (el: HTMLElement): void => {
      if (rectDebounceRef.current !== null) {
        clearTimeout(rectDebounceRef.current)
      }
      rectDebounceRef.current = setTimeout(() => {
        const newRect = el.getBoundingClientRect()
        if (isValidRect(newRect)) {
          setRect(newRect)
          lastStableRectRef.current = newRect
        }
      }, RECT_UPDATE_DEBOUNCE_MS)
    }

    // Helper: check if target is still valid (connected and has size)
    const isTargetValid = (el: HTMLElement): boolean => {
      if (!el.isConnected) return false
      const r = el.getBoundingClientRect()
      return isValidRect(r)
    }

    // Helper: start reacquire grace period
    const startReacquireGrace = (): void => {
      if (reacquireTimeoutRef.current !== null) return

      isReacquiringRef.current = true
      setIsReacquiring(true)
      reacquireTimeoutRef.current = setTimeout(() => {
        reacquireTimeoutRef.current = null
        // If still not reacquired after grace period, pause
        const currentEl = targetRef.current
        if (currentEl === null || !isTargetValid(currentEl)) {
          console.warn(
            `[Tutorial] Target "${targetId}" not reacquired after ${TARGET_REACQUIRE_GRACE_MS}ms`,
          )
          isReacquiringRef.current = false
          setIsReacquiring(false)
          useTutorialStore.getState().pauseTutorial('target-not-found')
        }
      }, TARGET_REACQUIRE_GRACE_MS)
    }

    // Helper: attach observers once element is found
    const attachObservers = (el: HTMLElement): void => {
      targetRef.current = el

      // ResizeObserver tracks element size/position changes
      const resizeObserver = new ResizeObserver(() => {
        if (isTargetValid(el)) {
          updateRect(el)
          // Clear reacquiring state if we have a valid rect again
          if (isReacquiringRef.current) {
            isReacquiringRef.current = false
            setIsReacquiring(false)
            if (reacquireTimeoutRef.current !== null) {
              clearTimeout(reacquireTimeoutRef.current)
              reacquireTimeoutRef.current = null
            }
          }
        } else if (!isReacquiringRef.current) {
          // Target became invalid - start reacquire grace
          startReacquireGrace()
        }
      })
      resizeObserver.observe(el)
      resizeObserverRef.current = resizeObserver

      // Scroll listener for position updates
      const scrollHandler = (): void => {
        if (isTargetValid(el)) {
          updateRect(el)
        }
      }
      scrollListenerRef.current = scrollHandler
      window.addEventListener('scroll', scrollHandler, true)

      // Initial rect
      updateRect(el)
    }

    // Helper: handle element found
    const handleElementFound = (el: HTMLElement): void => {
      // Clear search timeout
      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }

      // Disconnect initial mutation observer (replaced by resize observer)
      if (mutationObserverRef.current !== null) {
        mutationObserverRef.current.disconnect()
        mutationObserverRef.current = null
      }

      // Clear any reacquire timeout
      if (reacquireTimeoutRef.current !== null) {
        clearTimeout(reacquireTimeoutRef.current)
        reacquireTimeoutRef.current = null
      }

      setElement(el)
      setIsSearching(false)
      setIsReacquiring(false)
      attachObservers(el)

      // Scroll into view if needed
      void scrollTargetIntoView(el)
    }

    // Immediate lookup
    const immediateEl = document.querySelector<HTMLElement>(
      `[data-tutorial="${targetId}"]`,
    )

    if (immediateEl !== null && isTargetValid(immediateEl)) {
      handleElementFound(immediateEl)
      return cleanup
    }

    // Element not found immediately — start searching
    setIsSearching(true)

    // MutationObserver watches for DOM changes
    const mutationObserver = new MutationObserver(() => {
      const foundEl = document.querySelector<HTMLElement>(
        `[data-tutorial="${targetId}"]`,
      )
      if (foundEl !== null && isTargetValid(foundEl)) {
        handleElementFound(foundEl)
      }
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tutorial'],
    })
    mutationObserverRef.current = mutationObserver

    // 5-second timeout — pause tutorial instead of auto-skipping
    searchTimeoutRef.current = setTimeout(() => {
      const stillNotFound =
        document.querySelector<HTMLElement>(`[data-tutorial="${targetId}"]`) ===
        null

      if (stillNotFound) {
        console.warn(
          `[Tutorial] Target "${targetId}" not found after ${TARGET_SEARCH_TIMEOUT_MS / 1000}s`,
        )
        setIsSearching(false)
        useTutorialStore.getState().pauseTutorial('target-not-found')
      }
    }, TARGET_SEARCH_TIMEOUT_MS)

    return cleanup
  }, [targetId, isSearchActive])

  return {
    element,
    rect,
    lastStableRect: lastStableRectRef.current,
    isSearching,
    isReacquiring,
  }
}
