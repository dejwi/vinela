/**
 * useNeovimOptionsUrlState Hook
 *
 * URL query parameter state management for the Neovim Options page.
 * Provides the same interface as useOptionFilters but backed by URL state
 * for shareable/bookmarkable filter configurations.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  FilterType,
  NeovimOptionCategory,
  ViewMode,
} from '@/shared/types/neovim-options'

export interface UseNeovimOptionsUrlStateResult {
  /** Currently selected category (null = all categories) */
  category: NeovimOptionCategory | null
  /** Set selected category */
  setCategory: (category: NeovimOptionCategory | null) => void
  /** Current view mode ('popular' or 'all') */
  view: ViewMode
  /** Set view mode */
  setView: (view: ViewMode) => void
  /** Current search query */
  search: string
  /** Set search query (debounced URL update) */
  setSearch: (search: string) => void
  /** Currently active filter chips */
  filters: FilterType[]
  /** Set filters (replaces entire array) */
  setFilters: (filters: FilterType[]) => void
  /** Toggle a single filter on/off */
  toggleFilter: (filter: FilterType) => void
  /** Clear all filters and reset to default state */
  clearAll: () => void
}

const VALID_CATEGORIES: readonly NeovimOptionCategory[] = [
  'line-numbers',
  'visual-appearance',
  'text-wrapping',
  'indentation',
  'search',
  'file-handling',
  'windows-splits',
  'completion',
  'clipboard-system',
  'performance',
]

const VALID_VIEWS: readonly ViewMode[] = ['popular', 'all']
const VALID_FILTERS: readonly FilterType[] = [
  'recommended',
  'modified',
  'conflicts',
]

/**
 * Validates and parses a category from URL param.
 * Returns null if invalid or 'all'.
 */
function parseCategoryParam(param: string | null): NeovimOptionCategory | null {
  if (param === null || param === '') {
    return null
  }
  if (VALID_CATEGORIES.includes(param as NeovimOptionCategory)) {
    return param as NeovimOptionCategory
  }
  return null
}

/**
 * Validates and parses view mode from URL param.
 */
function parseViewParam(param: string | null): ViewMode {
  if (param !== null && VALID_VIEWS.includes(param as ViewMode)) {
    return param as ViewMode
  }
  return 'popular'
}

/**
 * Parses search param (always returns string, may be empty).
 */
function parseSearchParam(param: string | null): string {
  return param ?? ''
}

/**
 * Parses filter params from URL search params.
 */
function parseFilterParams(searchParams: URLSearchParams): FilterType[] {
  const filters = searchParams.getAll('filter')
  return filters.filter((f): f is FilterType =>
    VALID_FILTERS.includes(f as FilterType),
  )
}

export function useNeovimOptionsUrlState(): UseNeovimOptionsUrlStateResult {
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse current URL state
  const category = parseCategoryParam(searchParams.get('category'))
  const view = parseViewParam(searchParams.get('view'))
  const search = parseSearchParam(searchParams.get('search'))
  const filters = parseFilterParams(searchParams)

  // Local state for search to enable debouncing
  const [localSearch, setLocalSearch] = useState(search)

  // Sync local search with URL search on mount and when URL changes externally
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  // Debounced search URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        setSearchParams(
          (prev) => {
            if (localSearch.trim() === '') {
              prev.delete('search')
            } else {
              prev.set('search', localSearch)
            }
            return prev
          },
          { replace: true },
        )
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localSearch, search, setSearchParams])

  const setCategory = useCallback(
    (newCategory: NeovimOptionCategory | null) => {
      setSearchParams(
        (prev) => {
          if (newCategory === null) {
            prev.delete('category')
          } else {
            prev.set('category', newCategory)
          }
          return prev
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setView = useCallback(
    (newView: ViewMode) => {
      setSearchParams(
        (prev) => {
          prev.set('view', newView)
          return prev
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setFilters = useCallback(
    (newFilters: FilterType[]) => {
      setSearchParams(
        (prev) => {
          prev.delete('filter')
          for (const filter of newFilters) {
            prev.append('filter', filter)
          }
          return prev
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const toggleFilter = useCallback(
    (filter: FilterType) => {
      setSearchParams(
        (prev) => {
          const currentFilters = prev.getAll('filter')
          if (currentFilters.includes(filter)) {
            prev.delete('filter')
            for (const f of currentFilters) {
              if (f !== filter) {
                prev.append('filter', f)
              }
            }
          } else {
            prev.append('filter', filter)
          }
          return prev
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearAll = useCallback(() => {
    setSearchParams(
      (prev) => {
        prev.delete('category')
        prev.delete('view')
        prev.delete('search')
        prev.delete('filter')
        prev.delete('mode')
        return prev
      },
      { replace: true },
    )
    // Also reset local search state immediately
    setLocalSearch('')
  }, [setSearchParams])

  return {
    category,
    setCategory,
    view,
    setView,
    search: localSearch,
    setSearch: setLocalSearch,
    filters,
    setFilters,
    toggleFilter,
    clearAll,
  }
}
