import { useMemo } from 'react'
import type { KeymapEntry, KeymapFilters, KeymapSort } from '../types'
import {
  getActionSummary,
  getEntryDescription,
  getEntryKeySequence,
  getEntryModes,
} from '../utils'

/**
 * Filter and sort keymap entries based on current filters and sort config.
 */
export function useFilteredKeymaps(
  entries: KeymapEntry[],
  filters: KeymapFilters,
  sort: KeymapSort,
): KeymapEntry[] {
  return useMemo(() => {
    let filtered = entries

    // Search filter
    if (filters.search.trim().length > 0) {
      const searchLower = filters.search.toLowerCase().trim()
      filtered = filtered.filter((entry) => {
        const keySequence = getEntryKeySequence(entry).toLowerCase()
        const description = getEntryDescription(entry).toLowerCase()
        const actionSummary = getActionSummary(entry).toLowerCase()
        return (
          keySequence.includes(searchLower) ||
          description.includes(searchLower) ||
          actionSummary.includes(searchLower)
        )
      })
    }

    // Mode filter
    if (filters.modeFilter !== 'all') {
      const modeToFilter = filters.modeFilter
      filtered = filtered.filter((entry) => {
        const modes = getEntryModes(entry)
        return modes.includes(modeToFilter)
      })
    }

    // Source filter
    if (filters.sourceFilter !== 'all') {
      filtered = filtered.filter(
        (entry) => entry.source === filters.sourceFilter,
      )
    }

    // Action type filter (only applies to manual keymaps)
    if (filters.actionTypeFilter !== 'all') {
      filtered = filtered.filter((entry) => {
        if (entry.source === 'project') {
          return entry.keymap.action.actionType === filters.actionTypeFilter
        }
        // Graph-sourced keymaps don't have action types in the same sense
        // Hide them when filtering for a specific manual action type
        return false
      })
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const multiplier = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'keySequence':
          return (
            multiplier *
            getEntryKeySequence(a).localeCompare(getEntryKeySequence(b))
          )
        case 'mode':
          return (
            multiplier *
            getEntryModes(a).join(',').localeCompare(getEntryModes(b).join(','))
          )
        case 'source':
          return multiplier * a.source.localeCompare(b.source)
        case 'description':
          return (
            multiplier *
            getEntryDescription(a).localeCompare(getEntryDescription(b))
          )
        default:
          return 0
      }
    })

    return sorted
  }, [entries, filters, sort])
}
