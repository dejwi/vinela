import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogSelection } from '../useCatalogSelection'

describe('useCatalogSelection', () => {
  let onSelect: (index: number) => void
  let onEscape: () => void

  beforeEach(() => {
    onSelect = vi.fn()
    onEscape = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Keyboard Navigation', () => {
    it('ArrowDown navigates to next item', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        window.dispatchEvent(event)
      })

      expect(result.current.focusedIndex).toBe(1)
    })

    it('ArrowUp navigates to previous item', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      // Move to index 2 first
      act(() => {
        result.current.setFocusedIndex(2)
      })

      expect(result.current.focusedIndex).toBe(2)

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        window.dispatchEvent(event)
      })

      expect(result.current.focusedIndex).toBe(1)
    })

    it('ArrowDown does nothing when list is empty', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 0,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        window.dispatchEvent(event)
      })

      // Should remain at 0 (no crash)
      expect(result.current.focusedIndex).toBe(0)
    })

    it('ArrowUp does nothing when list is empty', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 0,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        window.dispatchEvent(event)
      })

      // Should remain at 0 (no crash)
      expect(result.current.focusedIndex).toBe(0)
    })

    it('ArrowDown clamps at last item', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 3,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      // Move to last item
      act(() => {
        result.current.setFocusedIndex(2)
      })

      expect(result.current.focusedIndex).toBe(2)

      // Try to go beyond
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        window.dispatchEvent(event)
      })

      // Should stay at 2
      expect(result.current.focusedIndex).toBe(2)
    })

    it('ArrowUp clamps at first item', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 3,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        window.dispatchEvent(event)
      })

      // Should stay at 0
      expect(result.current.focusedIndex).toBe(0)
    })

    it('Enter calls onSelect with focused index', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      act(() => {
        result.current.setFocusedIndex(3)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        window.dispatchEvent(event)
      })

      expect(onSelect).toHaveBeenCalledWith(3)
    })

    it('Escape calls onEscape', () => {
      renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' })
        window.dispatchEvent(event)
      })

      expect(onEscape).toHaveBeenCalled()
    })

    it('does not handle keyboard when disabled', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: false,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        window.dispatchEvent(event)
      })

      // Should not move
      expect(result.current.focusedIndex).toBe(0)
    })

    it('does not handle keyboard when typing in input', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      // Create a fake input element as the event target
      const input = document.createElement('input')
      document.body.appendChild(input)

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        })
        Object.defineProperty(event, 'target', {
          value: input,
          enumerable: true,
        })
        window.dispatchEvent(event)
      })

      // Should not move
      expect(result.current.focusedIndex).toBe(0)

      document.body.removeChild(input)
    })

    it('does not handle keyboard when typing in textarea', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 5,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      // Create a fake textarea element as the event target
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        })
        Object.defineProperty(event, 'target', {
          value: textarea,
          enumerable: true,
        })
        window.dispatchEvent(event)
      })

      // Should not move
      expect(result.current.focusedIndex).toBe(0)

      document.body.removeChild(textarea)
    })
  })

  describe('Focus Index Management', () => {
    it('resets focused index when item count decreases below current index', () => {
      const { result, rerender } = renderHook(
        ({ itemCount }) =>
          useCatalogSelection({
            itemCount,
            onSelect,
            onEscape,
            enabled: true,
          }),
        { initialProps: { itemCount: 10 } },
      )

      // Move to index 8
      act(() => {
        result.current.setFocusedIndex(8)
      })

      expect(result.current.focusedIndex).toBe(8)

      // Reduce item count to 5
      rerender({ itemCount: 5 })

      // Should clamp to 4 (last valid index)
      expect(result.current.focusedIndex).toBe(4)
    })

    it('handles item count changing to 0', () => {
      const { result, rerender } = renderHook(
        ({ itemCount }) =>
          useCatalogSelection({
            itemCount,
            onSelect,
            onEscape,
            enabled: true,
          }),
        { initialProps: { itemCount: 5 } },
      )

      act(() => {
        result.current.setFocusedIndex(3)
      })

      expect(result.current.focusedIndex).toBe(3)

      // Reduce to 0 items
      rerender({ itemCount: 0 })

      // Should reset to 0
      expect(result.current.focusedIndex).toBe(0)
    })

    it('allows manual focus index setting', () => {
      const { result } = renderHook(() =>
        useCatalogSelection({
          itemCount: 10,
          onSelect,
          onEscape,
          enabled: true,
        }),
      )

      expect(result.current.focusedIndex).toBe(0)

      act(() => {
        result.current.setFocusedIndex(5)
      })

      expect(result.current.focusedIndex).toBe(5)
    })
  })
})
