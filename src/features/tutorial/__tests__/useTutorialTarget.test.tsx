/**
 * useTutorialTarget hook tests
 *
 * Tests for: active search timeout, paused state gating, resume restarts search.
 *
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Top-level mocks ───────────────────────────────────────────────────────────

// Mock the tutorial store so we can assert pauseTutorial calls
vi.mock('@/features/tutorial/store', () => ({
  useTutorialStore: {
    getState: vi.fn(() => ({
      pauseTutorial: vi.fn(),
    })),
  },
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import * as tutorialStoreModule from '@/features/tutorial/store'
import { useTutorialTarget } from '../hooks/useTutorialTarget'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a DOM element with a data-tutorial attribute and appends it to body. */
function createTutorialElement(id: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-tutorial', id)
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => new DOMRect(0, 0, 100, 50),
    configurable: true,
  })
  document.body.appendChild(el)
  return el
}

/** Removes all data-tutorial elements from the DOM. */
function clearTutorialElements(): void {
  const elements = document.querySelectorAll('[data-tutorial]')
  for (const el of elements) {
    el.remove()
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTutorialTarget', () => {
  let mockPauseTutorial: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockPauseTutorial = vi.fn()
    vi.mocked(tutorialStoreModule.useTutorialStore.getState).mockReturnValue({
      pauseTutorial: mockPauseTutorial,
    } as unknown as ReturnType<
      typeof tutorialStoreModule.useTutorialStore.getState
    >)
    clearTutorialElements()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearTutorialElements()
    vi.restoreAllMocks()
  })

  // ── Active search timeout ─────────────────────────────────────────────────

  it('pauses tutorial after 5s timeout when target is not found (active search)', async () => {
    const { result } = renderHook(() =>
      useTutorialTarget('missing-target', true),
    )

    // Initially searching
    expect(result.current.isSearching).toBe(true)
    expect(result.current.element).toBeNull()

    // Advance past the 5-second timeout
    await act(async () => {
      vi.advanceTimersByTime(5001)
    })

    expect(mockPauseTutorial).toHaveBeenCalledOnce()
    expect(mockPauseTutorial).toHaveBeenCalledWith('target-not-found')
    expect(result.current.isSearching).toBe(false)
  })

  it('finds element immediately when it exists in DOM', () => {
    createTutorialElement('existing-target')

    const { result } = renderHook(() =>
      useTutorialTarget('existing-target', true),
    )

    // Should find immediately without timeout
    expect(result.current.element).not.toBeNull()
    expect(result.current.isSearching).toBe(false)
    expect(mockPauseTutorial).not.toHaveBeenCalled()
  })

  it('does not pause if element is found before timeout', async () => {
    const { result } = renderHook(() => useTutorialTarget('late-target', true))

    expect(result.current.isSearching).toBe(true)

    // Add element before timeout fires
    await act(async () => {
      vi.advanceTimersByTime(2000)
      createTutorialElement('late-target')
      // Trigger mutation observer callback
      vi.advanceTimersByTime(100)
    })

    // Advance past timeout — should NOT pause since element was found
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(mockPauseTutorial).not.toHaveBeenCalled()
  })

  // ── Paused state gating ───────────────────────────────────────────────────

  it('does not start search when isSearchActive is false', async () => {
    const { result } = renderHook(() => useTutorialTarget('some-target', false))

    // Should not be searching
    expect(result.current.isSearching).toBe(false)
    expect(result.current.element).toBeNull()

    // Advance past timeout — should NOT pause since search was never started
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })

    expect(mockPauseTutorial).not.toHaveBeenCalled()
  })

  it('returns null element and rect when isSearchActive is false', () => {
    createTutorialElement('visible-target')

    const { result } = renderHook(() =>
      useTutorialTarget('visible-target', false),
    )

    // Even though element exists in DOM, search is gated
    expect(result.current.element).toBeNull()
    expect(result.current.rect).toBeNull()
    expect(result.current.isSearching).toBe(false)
  })

  // ── Resume restarts search ────────────────────────────────────────────────

  it('resuming from paused (false → true) restarts search for same targetId', async () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useTutorialTarget('retry-target', active),
      { initialProps: { active: false } },
    )

    // Initially not searching (paused)
    expect(result.current.isSearching).toBe(false)

    // Resume — isSearchActive becomes true
    rerender({ active: true })

    // Now searching should start
    expect(result.current.isSearching).toBe(true)
  })

  it('resuming restarts the 5s timeout for target search', async () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useTutorialTarget('timeout-retry-target', active),
      { initialProps: { active: false } },
    )

    // Not searching while paused
    expect(mockPauseTutorial).not.toHaveBeenCalled()

    // Resume
    rerender({ active: true })

    // Advance past timeout — should now pause since target not found
    await act(async () => {
      vi.advanceTimersByTime(5001)
    })

    expect(mockPauseTutorial).toHaveBeenCalledOnce()
    expect(mockPauseTutorial).toHaveBeenCalledWith('target-not-found')
  })

  it('switching from active to paused (true → false) cancels the search timeout', async () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useTutorialTarget('cancel-target', active),
      { initialProps: { active: true } },
    )

    // Advance 2 seconds (still within timeout)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    // Pause — should cancel the timeout
    rerender({ active: false })

    // Advance past the original timeout — should NOT pause
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })

    expect(mockPauseTutorial).not.toHaveBeenCalled()
  })

  // ── Null targetId ─────────────────────────────────────────────────────────

  it('returns null element when targetId is null (center step)', () => {
    const { result } = renderHook(() => useTutorialTarget(null, true))

    expect(result.current.element).toBeNull()
    expect(result.current.rect).toBeNull()
    expect(result.current.isSearching).toBe(false)
  })
})
