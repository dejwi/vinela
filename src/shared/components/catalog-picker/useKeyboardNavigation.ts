import { useEffect, useState } from 'react'

interface UseKeyboardNavigationOptions {
  itemCount: number
  onSelect: (index: number) => void
  onEscape: () => void
  enabled: boolean
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEscape,
  enabled,
}: UseKeyboardNavigationOptions): {
  focusedIndex: number
  setFocusedIndex: (index: number) => void
} {
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Only handle Escape in inputs
        if (e.key === 'Escape') {
          e.preventDefault()
          onEscape()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1))
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break

        case 'Enter':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < itemCount) {
            onSelect(focusedIndex)
          }
          break

        case 'Escape':
          e.preventDefault()
          onEscape()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, itemCount, focusedIndex, onSelect, onEscape])

  // Reset focus when item count changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional - reset when itemCount changes
  useEffect(() => {
    setFocusedIndex(0)
  }, [itemCount])

  return { focusedIndex, setFocusedIndex }
}
