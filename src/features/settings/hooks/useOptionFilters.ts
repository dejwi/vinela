/**
 * useOptionFilters Hook
 *
 * Manages filter state for the Neovim options list.
 * Handles view mode, filters, search, and category selection.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  getPopularOptions,
  NEOVIM_OPTIONS_CATALOG,
} from '@/shared/lib/neovim-options/catalog'
import type {
  FilterType,
  NeovimOptionCategory,
  NeovimOptionDefinition,
  OptionConflictSummary,
  ViewMode,
} from '@/shared/types/neovim-options'

export interface UseOptionFiltersResult {
  /** Current view mode ('popular' or 'all') */
  view: ViewMode
  /** Set view mode */
  setView: (view: ViewMode) => void
  /** Currently active filter chips */
  activeFilters: FilterType[]
  /** Toggle a filter on/off */
  toggleFilter: (filter: FilterType) => void
  /** Replace active filters array */
  setFilters: (filters: FilterType[]) => void
  /** Clear all filters */
  clearFilters: () => void
  /** Current search query */
  searchQuery: string
  /** Set search query */
  setSearchQuery: (query: string) => void
  /** Currently selected category (null = all) */
  selectedCategory: NeovimOptionCategory | null
  /** Set selected category */
  setSelectedCategory: (category: NeovimOptionCategory | null) => void
  /** Filtered options based on all criteria */
  filteredOptions: NeovimOptionDefinition[]
  /** Options grouped by category */
  groupedOptions: Record<NeovimOptionCategory, NeovimOptionDefinition[]>
  /** Whether any filters are active */
  hasActiveFilters: boolean
  /** Count of options matching current filters */
  resultCount: number
  /** Per-category counts based on search/chip filters only (excludes category selection) */
  categoryVisibleCounts: Record<NeovimOptionCategory, number>
}

export interface UseOptionFiltersProps {
  /** Conflict map for conflicts filter */
  conflicts: Record<string, OptionConflictSummary>
  /** Function to check if an option is modified */
  isModified: (optionName: string) => boolean
}

export function useOptionFilters({
  conflicts,
  isModified,
}: UseOptionFiltersProps): UseOptionFiltersResult {
  // View state
  const [view, setView] = useState<ViewMode>('popular')

  // Filters
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([])

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Category
  const [selectedCategory, setSelectedCategory] =
    useState<NeovimOptionCategory | null>(null)

  // Toggle a filter
  const toggleFilter = useCallback((filter: FilterType) => {
    setActiveFilters((current) => {
      if (current.includes(filter)) {
        return current.filter((f) => f !== filter)
      }
      return [...current, filter]
    })
  }, [])

  // Replace all filters at once (used by URL sync)
  const setFilters = useCallback((filters: FilterType[]) => {
    const deduped = Array.from(new Set(filters))
    setActiveFilters((current) => {
      if (
        current.length === deduped.length &&
        current.every((filter, index) => filter === deduped[index])
      ) {
        return current
      }
      return deduped
    })
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters([])
    setSearchQuery('')
    setSelectedCategory(null)
    setView('popular')
  }, [])

  // Get base options based on view
  const baseOptions = useMemo(() => {
    if (view === 'popular') {
      return getPopularOptions()
    }
    // When view === 'all', show ALL options (no basic/advanced filtering)
    return [...NEOVIM_OPTIONS_CATALOG]
  }, [view])

  // Apply filters and search
  const filteredOptions = useMemo(() => {
    let result = [...baseOptions]

    // Apply category filter
    if (selectedCategory !== null) {
      result = result.filter((opt) => opt.category === selectedCategory)
    }

    // Apply chip filters
    for (const filter of activeFilters) {
      switch (filter) {
        case 'recommended':
          result = result.filter((opt) => opt.isCommunityRecommended)
          break
        case 'modified':
          result = result.filter((opt) => isModified(opt.name))
          break
        case 'conflicts':
          result = result.filter(
            (opt) =>
              conflicts[opt.name]?.type !== 'none' &&
              conflicts[opt.name]?.type !== undefined,
          )
          break
      }
    }

    // Apply search
    if (searchQuery.trim()) {
      const normalized = searchQuery.trim().toLowerCase()
      result = result.filter((opt) => {
        // Search by name
        if (opt.name.toLowerCase().includes(normalized)) {
          return true
        }
        // Search by label
        if (opt.label.toLowerCase().includes(normalized)) {
          return true
        }
        // Search by aliases
        if (
          opt.searchAliases?.some((alias) =>
            alias.toLowerCase().includes(normalized),
          )
        ) {
          return true
        }
        // Search by whatItDoes
        if (opt.whatItDoes.toLowerCase().includes(normalized)) {
          return true
        }
        return false
      })
    }

    return result
  }, [
    baseOptions,
    selectedCategory,
    activeFilters,
    searchQuery,
    isModified,
    conflicts,
  ])

  // Group options by category
  const groupedOptions = useMemo(() => {
    const grouped: Record<NeovimOptionCategory, NeovimOptionDefinition[]> = {
      keymaps: [],
      'line-numbers': [],
      'visual-appearance': [],
      'text-wrapping': [],
      indentation: [],
      search: [],
      'file-handling': [],
      'windows-splits': [],
      completion: [],
      'clipboard-system': [],
      performance: [],
    }

    for (const option of filteredOptions) {
      grouped[option.category].push(option)
    }

    return grouped
  }, [filteredOptions])

  // Compute per-category visible counts based on search/chip filters only (excludes category selection).
  // This ensures the sidebar shows meaningful counts for all categories regardless of which one is selected.
  const categoryVisibleCounts = useMemo(() => {
    const counts: Record<NeovimOptionCategory, number> = {
      keymaps: 0,
      'line-numbers': 0,
      'visual-appearance': 0,
      'text-wrapping': 0,
      indentation: 0,
      search: 0,
      'file-handling': 0,
      'windows-splits': 0,
      completion: 0,
      'clipboard-system': 0,
      performance: 0,
    }

    // Start from baseOptions (view-filtered) and apply search + chip filters, but NOT category
    let result = [...baseOptions]

    // Apply chip filters
    for (const filter of activeFilters) {
      switch (filter) {
        case 'recommended':
          result = result.filter((opt) => opt.isCommunityRecommended)
          break
        case 'modified':
          result = result.filter((opt) => isModified(opt.name))
          break
        case 'conflicts':
          result = result.filter(
            (opt) =>
              conflicts[opt.name]?.type !== 'none' &&
              conflicts[opt.name]?.type !== undefined,
          )
          break
      }
    }

    // Apply search
    if (searchQuery.trim()) {
      const normalized = searchQuery.trim().toLowerCase()
      result = result.filter((opt) => {
        if (opt.name.toLowerCase().includes(normalized)) {
          return true
        }
        if (opt.label.toLowerCase().includes(normalized)) {
          return true
        }
        if (
          opt.searchAliases?.some((alias) =>
            alias.toLowerCase().includes(normalized),
          )
        ) {
          return true
        }
        if (opt.whatItDoes.toLowerCase().includes(normalized)) {
          return true
        }
        return false
      })
    }

    // Count by category
    for (const option of result) {
      counts[option.category] = (counts[option.category] ?? 0) + 1
    }

    return counts
  }, [baseOptions, activeFilters, searchQuery, isModified, conflicts])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      activeFilters.length > 0 ||
      searchQuery.trim().length > 0 ||
      selectedCategory !== null
    )
  }, [activeFilters, searchQuery, selectedCategory])

  return {
    view,
    setView,
    activeFilters,
    toggleFilter,
    setFilters,
    clearFilters,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredOptions,
    groupedOptions,
    hasActiveFilters,
    resultCount: filteredOptions.length,
    categoryVisibleCounts,
  }
}
