/**
 * NeovimOptionsPage Component
 *
 * Dedicated full-page Neovim Options configuration.
 * Features a 2-column layout with category sidebar (left) and options panel (right).
 * URL-persisted filter state for shareable/bookmarkable configurations.
 */

import { List, RotateCcw, Search, Settings2, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/features/projects/store'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import {
  CATEGORY_ORDER,
  getDefaultStoredValue,
  getOptionDefinition,
  LEADER_KEY_OPTION_NAME,
  NEOVIM_OPTIONS_CATALOG,
} from '@/shared/lib/neovim-options/catalog'
import type {
  FilterType,
  NeovimOptionCategory,
  NeovimOptionDefinition,
  NeovimOptionStoredValue,
  OptionDependency,
  OptionPreset,
  ViewMode,
} from '@/shared/types/neovim-options'
import { CategorySidebar } from '../components/neovim-options/CategorySidebar'
import { FilterChips } from '../components/neovim-options/FilterChips'
import { GroupedOptionsList } from '../components/neovim-options/GroupedOptionsList'
import { HighlightOverridesSection } from '../components/neovim-options/HighlightOverridesSection'
import { LeaderKeyControl } from '../components/neovim-options/LeaderKeyControl'
import { OptionsList } from '../components/neovim-options/OptionsList'
import { PresetSelector } from '../components/neovim-options/PresetSelector'
import { useNeovimOptionsUrlState } from '../hooks/useNeovimOptionsUrlState'
import { useOptionFilters } from '../hooks/useOptionFilters'
import { useProjectNeovimOptions } from '../hooks/useProjectNeovimOptions'

interface PresetPreviewDialogState {
  open: boolean
  preset: OptionPreset | null
}

/**
 * Get the value to set for a dependency based on its configuration.
 */
function getDependencyValue(
  option: NeovimOptionDefinition,
  dependency: OptionDependency,
): NeovimOptionStoredValue {
  const fallback = getDefaultStoredValue(option)

  switch (option.valueType) {
    case 'boolean': {
      const nextValue =
        typeof dependency.requiredValue === 'boolean'
          ? dependency.requiredValue
          : true
      return { valueType: 'boolean', value: nextValue }
    }

    case 'number': {
      let nextValue = 0
      if (typeof dependency.requiredValue === 'number') {
        nextValue = dependency.requiredValue
      } else if (fallback.valueType === 'number') {
        nextValue = fallback.value
      }
      return { valueType: 'number', value: nextValue }
    }

    case 'string': {
      let nextValue = ''
      if (typeof dependency.requiredValue === 'string') {
        nextValue = dependency.requiredValue
      } else if (fallback.valueType === 'string') {
        nextValue = fallback.value
      }
      return { valueType: 'string', value: nextValue }
    }

    case 'string-list': {
      let nextValue: string[] = []
      if (typeof dependency.requiredValue === 'string') {
        nextValue = [dependency.requiredValue]
      } else if (fallback.valueType === 'string-list') {
        nextValue = fallback.value
      }
      return { valueType: 'string-list', value: nextValue }
    }

    case 'char-list': {
      let nextValue: string[] = []
      if (typeof dependency.requiredValue === 'string') {
        nextValue = [dependency.requiredValue]
      } else if (fallback.valueType === 'char-list') {
        nextValue = fallback.value
      }
      return { valueType: 'char-list', value: nextValue }
    }

    default: {
      const exhaustiveCheck: never = option.valueType
      throw new Error(
        `Unsupported dependency value type: ${exhaustiveCheck as string}`,
      )
    }
  }
}

/**
 * Calculate category counts from filtered options.
 */
function getCategoryCounts(
  options: NeovimOptionDefinition[],
): Record<NeovimOptionCategory, number> {
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

  for (const option of options) {
    counts[option.category] = (counts[option.category] ?? 0) + 1
  }

  return counts
}

/**
 * No Project State Component
 */
function NoProjectState(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
          <Settings2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Project Open</h2>
        <p className="text-muted-foreground mb-6">
          Open a project to configure Neovim options. Options are saved
          per-project and generate Lua configuration.
        </p>
      </div>
    </div>
  )
}

/**
 * Loading Skeleton Component
 */
function LoadingSkeleton(): React.JSX.Element {
  // Generate stable IDs for skeleton items
  const sidebarItems = [
    's1',
    's2',
    's3',
    's4',
    's5',
    's6',
    's7',
    's8',
    's9',
    's10',
    's11',
    's12',
  ]
  const cardItems = ['c1', 'c2', 'c3', 'c4']

  return (
    <div className="flex h-full">
      {/* Sidebar skeleton */}
      <div className="w-56 shrink-0 border-r bg-card p-4 space-y-2">
        {sidebarItems.map((id) => (
          <div key={id} className="h-9 w-full rounded bg-muted animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-6">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="flex gap-4">
          <div className="h-10 w-32 rounded bg-muted animate-pulse" />
          <div className="h-10 w-64 rounded bg-muted animate-pulse" />
        </div>
        {cardItems.map((id) => (
          <div
            key={id}
            className="h-32 w-full rounded bg-muted animate-pulse"
          />
        ))}
      </div>
    </div>
  )
}

export default function NeovimOptionsPage(): React.JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)
  const urlState = useNeovimOptionsUrlState()

  const {
    isLoading,
    effectiveValues,
    isModifiedFromDefault,
    getOptionValue,
    updateOption,
    resetOption,
    resetCategory,
    resetAll,
    applyPreset,
    modifiedCount,
    modifiedByCategory,
    conflicts,
    leaderKey,
    updateLeaderKey,
    resetLeaderKey,
    isLeaderKeyModified,
    highlightOverrides,
    updateHighlightOverrides,
  } = useProjectNeovimOptions()

  // Deferred loading skeleton: only show after a delay to avoid brief flash.
  // The page can render with catalog defaults immediately; stored options merge in
  // when loaded. The skeleton only appears for genuinely slow loads (>200ms).
  const [showSkeleton, setShowSkeleton] = useState(false)
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isLoading) {
      skeletonTimerRef.current = setTimeout(() => {
        setShowSkeleton(true)
      }, 200)
    } else {
      if (skeletonTimerRef.current !== null) {
        clearTimeout(skeletonTimerRef.current)
        skeletonTimerRef.current = null
      }
      setShowSkeleton(false)
    }

    return () => {
      if (skeletonTimerRef.current !== null) {
        clearTimeout(skeletonTimerRef.current)
        skeletonTimerRef.current = null
      }
    }
  }, [isLoading])

  // Use option filters with URL state as initial values
  const filters = useOptionFilters({
    conflicts,
    isModified: isModifiedFromDefault,
  })

  const {
    setView: setFilterView,
    setSearchQuery: setFilterSearchQuery,
    setFilters: setFilterChips,
    setSelectedCategory: setFilterCategory,
  } = filters

  // Sync URL state -> local filter state
  useEffect(() => {
    setFilterView(urlState.view)
    setFilterSearchQuery(urlState.search)
    setFilterChips(urlState.filters)
    setFilterCategory(urlState.category)
  }, [
    urlState.view,
    urlState.search,
    urlState.category,
    urlState.filters,
    setFilterView,
    setFilterSearchQuery,
    setFilterChips,
    setFilterCategory,
  ])

  // Sync filter changes back to URL
  const handleViewChange = useCallback(
    (view: ViewMode) => {
      urlState.setView(view)
    },
    [urlState],
  )

  const handleSearchChange = useCallback(
    (search: string) => {
      urlState.setSearch(search)
    },
    [urlState],
  )

  const handleFiltersChange = useCallback(
    (newFilters: FilterType[]) => {
      urlState.setFilters(newFilters)
    },
    [urlState],
  )

  const handleCategoryChange = useCallback(
    (category: NeovimOptionCategory | null) => {
      urlState.setCategory(category)
    },
    [urlState],
  )

  const [presetDialog, setPresetDialog] = useState<PresetPreviewDialogState>({
    open: false,
    preset: null,
  })

  useEffect(() => {
    if (!presetDialog.open || !presetDialog.preset) {
      return
    }

    let isCancelled = false

    void applyPreset(presetDialog.preset)
      .then(() => {
        if (!isCancelled) {
          setPresetDialog({ open: false, preset: null })
        }
      })
      .catch((error: unknown) => {
        console.error('[neovim-options] Failed to apply preset:', error)
        if (!isCancelled) {
          setPresetDialog({ open: false, preset: null })
        }
      })

    return () => {
      isCancelled = true
    }
  }, [presetDialog.open, presetDialog.preset, applyPreset])

  // Tutorial DOM event listener for resetting state
  useEffect(() => {
    const handleResetNeovimOptionsState = (): void => {
      // Reset to popular view with no filters/search
      urlState.setView('popular')
      urlState.setCategory(null)
      urlState.setSearch('')
      urlState.setFilters([])
    }

    window.addEventListener(
      'tutorial:reset-neovim-options-state',
      handleResetNeovimOptionsState,
    )

    return () => {
      window.removeEventListener(
        'tutorial:reset-neovim-options-state',
        handleResetNeovimOptionsState,
      )
    }
  }, [urlState])

  const handleOptionChange = useCallback(
    (optionName: string, value: NeovimOptionStoredValue): void => {
      void updateOption(optionName, value).catch((error: unknown) => {
        console.error(
          `[neovim-options] Failed to update option ${optionName}:`,
          error,
        )
      })
    },
    [updateOption],
  )

  const handleResetOption = useCallback(
    (optionName: string): void => {
      if (optionName === LEADER_KEY_OPTION_NAME) {
        void resetLeaderKey().catch((error: unknown) => {
          console.error(`[neovim-options] Failed to reset leader key:`, error)
        })
        return
      }
      void resetOption(optionName).catch((error: unknown) => {
        console.error(
          `[neovim-options] Failed to reset option ${optionName}:`,
          error,
        )
      })
    },
    [resetOption, resetLeaderKey],
  )

  const handleResetCategory = useCallback(
    (category: NeovimOptionCategory): void => {
      if (category === 'keymaps') {
        void resetLeaderKey().catch((error: unknown) => {
          console.error(
            `[neovim-options] Failed to reset keymaps category:`,
            error,
          )
        })
        return
      }
      void resetCategory(category).catch((error: unknown) => {
        console.error(
          `[neovim-options] Failed to reset category ${category}:`,
          error,
        )
      })
    },
    [resetCategory, resetLeaderKey],
  )

  const handleEnableDependency = useCallback(
    (dependency: OptionDependency): void => {
      const requiredOption = getOptionDefinition(dependency.optionName)
      if (!requiredOption) {
        return
      }

      const requiredValue = getDependencyValue(requiredOption, dependency)
      void updateOption(requiredOption.name, requiredValue).catch(
        (error: unknown) => {
          console.error(
            `[neovim-options] Failed to enable dependency ${dependency.optionName}:`,
            error,
          )
        },
      )
    },
    [updateOption],
  )

  // Handle leader key option value
  const getOptionValueWithLeader = useCallback(
    (optionName: string): NeovimOptionStoredValue => {
      if (optionName === LEADER_KEY_OPTION_NAME) {
        return { valueType: 'string', value: leaderKey }
      }
      return getOptionValue(optionName)
    },
    [getOptionValue, leaderKey],
  )

  // Handle leader key modified state
  const isModifiedWithLeader = useCallback(
    (optionName: string): boolean => {
      if (optionName === LEADER_KEY_OPTION_NAME) {
        return isLeaderKeyModified
      }
      return isModifiedFromDefault(optionName)
    },
    [isModifiedFromDefault, isLeaderKeyModified],
  )

  // Render custom control for leader key option
  const renderCustomControl = useCallback(
    (option: NeovimOptionDefinition): React.ReactNode | undefined => {
      if (option.name === LEADER_KEY_OPTION_NAME) {
        return (
          <LeaderKeyControl
            value={leaderKey}
            onChange={(key) => void updateLeaderKey(key)}
          />
        )
      }
      return undefined
    },
    [leaderKey, updateLeaderKey],
  )

  const handleSelectPreset = useCallback((preset: OptionPreset) => {
    setPresetDialog({ open: true, preset })
  }, [])

  // Calculate TOTAL counts from full catalog (unfiltered)
  const totalCounts = useMemo(() => {
    return getCategoryCounts([...NEOVIM_OPTIONS_CATALOG])
  }, [])

  // Use per-category visible counts from the hook (computed without category filter applied)
  // This ensures the sidebar shows meaningful counts for all categories regardless of selection
  const visibleCounts = filters.categoryVisibleCounts

  // Determine which options to display
  const displayedOptions = useMemo(() => {
    if (urlState.category) {
      return filters.groupedOptions[urlState.category] ?? []
    }
    return filters.filteredOptions
  }, [urlState.category, filters.groupedOptions, filters.filteredOptions])

  // Show no project state
  if (!currentProject) {
    return <NoProjectState />
  }

  // Show loading skeleton only after a delay — prevents flicker for fast loads
  if (showSkeleton) {
    return <LoadingSkeleton />
  }

  return (
    <div className="flex h-full" data-tutorial="neovim-options-page">
      {/* Category Sidebar */}
      <CategorySidebar
        selectedCategory={urlState.category}
        onSelectCategory={handleCategoryChange}
        totalCounts={totalCounts}
        visibleCounts={visibleCounts}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 border-b p-6">
          <div className="flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Neovim Options</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Configure Neovim behavior for{' '}
            <span className="font-medium text-foreground">
              {currentProject.name}
            </span>
          </p>
        </header>

        {/* Toolbar */}
        <div className="shrink-0 border-b p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* View Toggle */}
            <Tabs
              value={filters.view}
              onValueChange={(v) => handleViewChange(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger value="popular" className="gap-2">
                  <Star className="h-4 w-4" />
                  Popular
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-2">
                  <List className="h-4 w-4" />
                  All Options
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search options..."
                  value={urlState.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
                {urlState.search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2"
                    onClick={() => handleSearchChange('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Preset Selector */}
            <PresetSelector onSelectPreset={handleSelectPreset} />

            {/* Reset All (if modified) */}
            {(modifiedCount > 0 || isLeaderKeyModified) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void resetAll().catch((error: unknown) => {
                    console.error(
                      '[neovim-options] Failed to reset all options:',
                      error,
                    )
                  })
                }}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset All
              </Button>
            )}
          </div>

          {/* Filter Chips */}
          <FilterChips
            activeFilters={filters.activeFilters}
            onChange={handleFiltersChange}
            availableCounts={{
              recommended: filters.filteredOptions.filter(
                (o) => o.isCommunityRecommended,
              ).length,
              modified: modifiedCount,
              conflicts: Object.keys(conflicts).length,
            }}
          />
        </div>

        {/* Results Summary */}
        <div className="shrink-0 px-6 py-3 text-sm text-muted-foreground border-b bg-muted/30">
          Showing {displayedOptions.length} option
          {displayedOptions.length !== 1 ? 's' : ''}
          {urlState.category && (
            <>
              {' '}
              in{' '}
              <span className="font-medium text-foreground">
                {CATEGORY_ORDER.find((c) => c === urlState.category)
                  ?.replace(/-/g, ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            </>
          )}
          {modifiedCount > 0 && (
            <span className="ml-2">• {modifiedCount} modified</span>
          )}
        </div>

        {/* Options List */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {displayedOptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium mb-2">
                  No options match your filters
                </p>
                <p className="mb-4">Try adjusting your search or filters</p>
                <Button variant="outline" onClick={() => urlState.clearAll()}>
                  Clear all filters
                </Button>
              </div>
            ) : urlState.category ? (
              /* Single category view */
              <OptionsList
                options={displayedOptions}
                getOptionValue={getOptionValueWithLeader}
                effectiveValues={effectiveValues}
                isModified={isModifiedWithLeader}
                conflicts={conflicts}
                onChange={handleOptionChange}
                onReset={handleResetOption}
                onEnableDependency={handleEnableDependency}
                renderCustomControl={renderCustomControl}
              />
            ) : (
              /* All categories view (grouped) */
              <GroupedOptionsList
                groupedOptions={filters.groupedOptions}
                modifiedByCategory={modifiedByCategory}
                getOptionValue={getOptionValueWithLeader}
                effectiveValues={effectiveValues}
                isModified={isModifiedWithLeader}
                conflicts={conflicts}
                onChange={handleOptionChange}
                onReset={handleResetOption}
                onResetCategory={handleResetCategory}
                onEnableDependency={handleEnableDependency}
                renderCustomControl={renderCustomControl}
              />
            )}

            {/* Highlight Overrides Section */}
            <div className="mt-12 pt-8 border-t">
              <HighlightOverridesSection
                overrides={highlightOverrides}
                onChange={(overrides) =>
                  void updateHighlightOverrides(overrides)
                }
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
