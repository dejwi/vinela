import { useCallback, useEffect, useRef, useState } from 'react'

interface ScrollIndicatorState {
  canScrollUp: boolean
  canScrollDown: boolean
}

/**
 * Custom hook for tracking scroll position and determining if content
 * can be scrolled up or down. Used for showing/hiding scroll indicators.
 *
 * @returns Object containing:
 *   - scrollRef: Ref to attach to the scrollable element
 *   - canScrollUp: True when scrolled down from top
 *   - canScrollDown: True when more content exists below
 */
export function useScrollIndicators() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<ScrollIndicatorState>({
    canScrollUp: false,
    canScrollDown: false,
  })

  const updateState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const { scrollTop, scrollHeight, clientHeight } = el
    setState({
      canScrollUp: scrollTop > 0,
      canScrollDown: scrollTop + clientHeight < scrollHeight - 1, // -1 for rounding
    })
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // Initial check
    updateState()

    // Listen for scroll events (passive for performance)
    el.addEventListener('scroll', updateState, { passive: true })

    // Listen for resize (content might change)
    const resizeObserver = new ResizeObserver(updateState)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', updateState)
      resizeObserver.disconnect()
    }
  }, [updateState])

  return { scrollRef, ...state }
}
