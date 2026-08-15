import { useCallback, useEffect, useRef, useState } from 'react'
import { isMemoryMode } from '@/shared/lib/storage'
import { detectNeovim } from '../detection'
import type { NeovimDetectionResult, NeovimStatusState } from '../types'

interface UseNeovimStatusReturn {
  /** Current detection state */
  state: NeovimStatusState
  /** Trigger re-detection */
  refresh: () => Promise<void>
  /** Whether currently detecting */
  isDetecting: boolean
  /** Shorthand: detection result if available */
  result: NeovimDetectionResult | null
}

/**
 * Module-level cache for detection result.
 * Shared across all hook instances to avoid redundant detection.
 */
let cachedResult: NeovimDetectionResult | null = null
let detectPromise: Promise<NeovimDetectionResult> | null = null

/**
 * Subscribers for cache updates.
 */
const subscribers = new Set<(result: NeovimDetectionResult) => void>()

function notifySubscribers(result: NeovimDetectionResult): void {
  for (const callback of subscribers) {
    callback(result)
  }
}

/**
 * Hook for Neovim detection status with caching.
 *
 * Features:
 * - Caches detection result across component instances
 * - Deduplicates concurrent detection requests
 * - Provides refresh capability
 * - Handles memory mode gracefully
 */
export function useNeovimStatus(): UseNeovimStatusReturn {
  const [state, setState] = useState<NeovimStatusState>(() => {
    if (cachedResult !== null) {
      return { status: 'detected', result: cachedResult }
    }
    return { status: 'idle' }
  })

  const isMounted = useRef(true)

  // Subscribe to cache updates
  useEffect(() => {
    isMounted.current = true

    const handleUpdate = (result: NeovimDetectionResult): void => {
      if (isMounted.current) {
        setState({ status: 'detected', result })
      }
    }
    subscribers.add(handleUpdate)
    return () => {
      subscribers.delete(handleUpdate)
      isMounted.current = false
    }
  }, [])

  const runDetection = useCallback(async (): Promise<void> => {
    // Deduplicate concurrent requests
    if (detectPromise !== null) {
      if (isMounted.current) {
        setState({ status: 'detecting' })
      }

      const result = await detectPromise
      if (isMounted.current) {
        setState({ status: 'detected', result })
      }

      return
    }

    setState({ status: 'detecting' })

    detectPromise = detectNeovim()
    try {
      const result = await detectPromise
      cachedResult = result
      notifySubscribers(result)
      if (isMounted.current) {
        setState({ status: 'detected', result })
      }
    } catch (error) {
      if (isMounted.current) {
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Detection failed',
        })
      }
    } finally {
      detectPromise = null
    }
  }, [])

  // Auto-detect on mount if not cached
  useEffect(() => {
    if (cachedResult !== null) {
      setState({ status: 'detected', result: cachedResult })
      return
    }

    // Memory mode: return immediately with disabled state
    if (isMemoryMode()) {
      const memoryResult: NeovimDetectionResult = {
        found: false,
        error: 'Neovim detection is not available in browser mode',
        errorCode: 'memory-mode',
      }
      cachedResult = memoryResult
      setState({ status: 'detected', result: memoryResult })
      return
    }

    // Start detection
    void runDetection()
  }, [runDetection])

  const refresh = useCallback(async (): Promise<void> => {
    // Clear cache and re-detect
    cachedResult = null
    await runDetection()
  }, [runDetection])

  const isDetecting = state.status === 'detecting'
  const result = state.status === 'detected' ? state.result : null

  return { state, refresh, isDetecting, result }
}

/**
 * Clear the cached detection result (for testing).
 */
export function _clearNeovimStatusCache(): void {
  cachedResult = null
  detectPromise = null
}
