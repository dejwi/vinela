import { useCallback, useEffect, useState } from 'react'

export interface UseCatalogSelectionOptions {
  itemCount: number
  onSelect: (index: number) => void
  onEscape: () => void
  enabled: boolean
}

export interface UseCatalogSelectionResult {
  focusedIndex: number
  setFocusedIndex: (index: number) => void
}

export function useCatalogSelection({
  itemCount,
  onSelect,
  onEscape,
  enabled,
}: UseCatalogSelectionOptions): UseCatalogSelectionResult {
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Reset focused index when item count changes
  useEffect(() => {
    if (focusedIndex >= itemCount) {
      setFocusedIndex(Math.max(0, itemCount - 1))
    }
  }, [itemCount, focusedIndex])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (itemCount > 0) {
            setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (itemCount > 0) {
            setFocusedIndex((prev) => Math.max(prev - 1, 0))
          }
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
    },
    [enabled, focusedIndex, itemCount, onSelect, onEscape],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    focusedIndex,
    setFocusedIndex,
  }
}
