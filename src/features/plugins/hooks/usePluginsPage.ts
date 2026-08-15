import { useMemo } from 'react'
import type {
  AvailablePluginDisplayInfo,
  PluginCategory,
  PluginDisplayInfo,
} from '@/shared/types'
import type { BrowseSortOption, InstalledSortOption } from '../sort-filter'
import {
  computeCategoryCounts,
  filterBrowseEligible,
  filterByCategory,
  matchesSearch,
  sortBrowse,
  sortInstalledWithGrouping,
} from '../sort-filter'
import { getPluginDisplayList, usePluginStore } from '../store'

/**
 * Hook for the Plugins page.
 *
 * Provides:
 *   - Tab state (activeTab, setActiveTab)
 *   - Search state (searchQuery, setSearchQuery)
 *   - Sort state (installedSort, setInstalledSort, browseSort, setBrowseSort)
 *   - Category filter state (selectedCategory, setSelectedCategory)
 *   - Memoized filtered + sorted plugin lists for each tab
 *   - Category counts for the filter chips
 */
export function usePluginsPage(): {
  activeTab: 'installed' | 'browse'
  setActiveTab: (tab: 'installed' | 'browse') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  installedSort: InstalledSortOption
  setInstalledSort: (option: InstalledSortOption) => void
  browseSort: BrowseSortOption
  setBrowseSort: (option: BrowseSortOption) => void
  selectedCategory: PluginCategory | null
  setSelectedCategory: (category: PluginCategory | null) => void
  allPlugins: PluginDisplayInfo[]
  filteredInstalledPlugins: PluginDisplayInfo[]
  filteredBrowsePlugins: AvailablePluginDisplayInfo[]
  browseTotalCount: number
  browseCategoryCounts: Partial<Record<PluginCategory, number>>
} {
  const schemas = usePluginStore((s) => s.schemas)
  const installedPlugins = usePluginStore((s) => s.installedPlugins)
  const activeTab = usePluginStore((s) => s.activeTab)
  const searchQuery = usePluginStore((s) => s.searchQuery)
  const installedSort = usePluginStore((s) => s.installedSort)
  const browseSort = usePluginStore((s) => s.browseSort)
  const selectedCategory = usePluginStore((s) => s.selectedCategory)
  const setActiveTab = usePluginStore((s) => s.setActiveTab)
  const setSearchQuery = usePluginStore((s) => s.setSearchQuery)
  const setInstalledSort = usePluginStore((s) => s.setInstalledSort)
  const setBrowseSort = usePluginStore((s) => s.setBrowseSort)
  const setSelectedCategory = usePluginStore((s) => s.setSelectedCategory)

  const allPlugins = useMemo(
    () => getPluginDisplayList(schemas, installedPlugins),
    [schemas, installedPlugins],
  )

  const browseEligiblePlugins = useMemo(
    (): AvailablePluginDisplayInfo[] => filterBrowseEligible(allPlugins),
    [allPlugins],
  )

  const filteredInstalledPlugins = useMemo((): PluginDisplayInfo[] => {
    const installed = allPlugins.filter(
      (p) => p.status === 'installed' || p.status === 'orphaned',
    )
    const searched = installed.filter((p) => matchesSearch(p, searchQuery))
    return sortInstalledWithGrouping(searched, installedSort)
  }, [allPlugins, searchQuery, installedSort])

  const searchFilteredBrowsePlugins = useMemo(
    () => browseEligiblePlugins.filter((p) => matchesSearch(p, searchQuery)),
    [browseEligiblePlugins, searchQuery],
  )

  const filteredBrowsePlugins = useMemo((): AvailablePluginDisplayInfo[] => {
    const categorized = filterByCategory(
      searchFilteredBrowsePlugins,
      selectedCategory,
    )
    return sortBrowse(categorized, browseSort)
  }, [searchFilteredBrowsePlugins, selectedCategory, browseSort])

  const browseCategoryCounts = useMemo(
    (): Partial<Record<PluginCategory, number>> =>
      computeCategoryCounts(searchFilteredBrowsePlugins),
    [searchFilteredBrowsePlugins],
  )

  const browseTotalCount = useMemo(
    (): number => searchFilteredBrowsePlugins.length,
    [searchFilteredBrowsePlugins],
  )

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    installedSort,
    setInstalledSort,
    browseSort,
    setBrowseSort,
    selectedCategory,
    setSelectedCategory,
    allPlugins,
    filteredInstalledPlugins,
    filteredBrowsePlugins,
    browseTotalCount,
    browseCategoryCounts,
  }
}
