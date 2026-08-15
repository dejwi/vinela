/**
 * useProjectNeovimOptions Hook
 *
 * Manages Neovim options for the current project.
 * Loads options from storage, merges with defaults from catalog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/features/projects/store'
import {
  readNeovimOptions,
  writeLeaderKey,
  writeNeovimOptions,
} from '@/features/settings/storage/neovim-options'
import {
  areStoredValuesEqual,
  getDefaultStoredValue,
  isDefaultValue,
  NEOVIM_OPTIONS_CATALOG,
} from '@/shared/lib/neovim-options/catalog'
import type {
  HighlightOverride,
  NeovimOptionStoredValue,
  OptionConflictSummary,
  OptionPreset,
} from '@/shared/types/neovim-options'

/** Default leader key (Space) */
const DEFAULT_LEADER_KEY = ' '

interface MutationContext {
  projectPath: string
  generation: number
}

/**
 * Helper class for managing mutation context to prevent stale async reverts.
 * Tracks project path and generation to ensure revert operations only apply
 * to the current project context, not a stale one from a previous project.
 */
class MutationContextTracker {
  private currentPath: string | null = null
  private currentGeneration = 0

  updatePath(path: string | null): void {
    // Only increment generation when path actually changes
    // This prevents false staleness when same project is re-selected
    if (this.currentPath !== path) {
      this.currentPath = path
      this.currentGeneration++
    }
  }

  capture(path: string): MutationContext {
    return { projectPath: path, generation: this.currentGeneration }
  }

  isCurrent(ctx: MutationContext): boolean {
    return (
      this.currentPath === ctx.projectPath &&
      this.currentGeneration === ctx.generation
    )
  }
}

export interface UseProjectNeovimOptionsResult {
  /** Whether options are being loaded */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** All effective option values (stored + defaults) */
  effectiveValues: Record<string, NeovimOptionStoredValue>
  /** Check if an option has been modified from default */
  isModifiedFromDefault: (optionName: string) => boolean
  /** Get the current value for an option */
  getOptionValue: (optionName: string) => NeovimOptionStoredValue
  /** Update a single option value */
  updateOption: (
    optionName: string,
    value: NeovimOptionStoredValue,
  ) => Promise<void>
  /** Reset a single option to default */
  resetOption: (optionName: string) => Promise<void>
  /** Reset all options in a category to defaults */
  resetCategory: (category: string) => Promise<void>
  /** Reset all options and leader key to defaults */
  resetAll: () => Promise<void>
  /** Apply a preset (batch update) */
  applyPreset: (preset: OptionPreset) => Promise<void>
  /** Map of option conflicts from graph nodes */
  conflicts: Record<string, OptionConflictSummary>
  /** Refresh the conflict map */
  refreshConflicts: () => Promise<void>
  /** Total number of modified options */
  modifiedCount: number
  /** Count of modified options per category */
  modifiedByCategory: Record<string, number>
  /** Current leader key (defaults to Space) */
  leaderKey: string
  /** Update the leader key */
  updateLeaderKey: (key: string) => Promise<void>
  /** Reset leader key to default */
  resetLeaderKey: () => Promise<void>
  /** Whether leader key is modified from default */
  isLeaderKeyModified: boolean
  /** Current highlight overrides */
  highlightOverrides: HighlightOverride[]
  /** Update highlight overrides */
  updateHighlightOverrides: (overrides: HighlightOverride[]) => Promise<void>
  /** Reset highlight overrides to empty */
  resetHighlightOverrides: () => Promise<void>
}

export function useProjectNeovimOptions(): UseProjectNeovimOptionsResult {
  const projectPath = useProjectStore(
    (state) => state.currentProject?.absolutePath,
  )

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storedOptions, setStoredOptions] = useState<
    Record<string, NeovimOptionStoredValue>
  >({})
  const [conflicts, setConflicts] = useState<
    Record<string, OptionConflictSummary>
  >({})
  const [leaderKey, setLeaderKey] = useState<string>(DEFAULT_LEADER_KEY)
  const [highlightOverrides, setHighlightOverrides] = useState<
    HighlightOverride[]
  >([])

  // Mutation context tracker to prevent stale async reverts
  const mutationTrackerRef = useRef(new MutationContextTracker())

  // Update tracker when project path changes
  useEffect(() => {
    mutationTrackerRef.current.updatePath(projectPath ?? null)
  }, [projectPath])

  // Check if leader key is modified from default
  const isLeaderKeyModified = leaderKey !== DEFAULT_LEADER_KEY

  // Load options from canonical storage (no migration)
  useEffect(() => {
    if (!projectPath) {
      // Clear all state when no project is active
      setStoredOptions({})
      setConflicts({})
      setLeaderKey(DEFAULT_LEADER_KEY)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadOptions() {
      setIsLoading(true)
      setError(null)

      try {
        const fileData = projectPath
          ? await readNeovimOptions(projectPath)
          : null

        if (!cancelled) {
          setStoredOptions(fileData?.options ?? {})
          setHighlightOverrides(fileData?.highlightOverrides ?? [])

          // Load leader key from project storage (no migration - pre-production)
          if (fileData?.leaderKey !== undefined) {
            setLeaderKey(fileData.leaderKey)
          } else {
            setLeaderKey(DEFAULT_LEADER_KEY)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load options',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
    }
  }, [projectPath])

  // Build effective values (stored + defaults)
  const effectiveValues = useMemo(() => {
    const result: Record<string, NeovimOptionStoredValue> = {}

    for (const option of NEOVIM_OPTIONS_CATALOG) {
      const stored = storedOptions[option.name]
      if (stored !== undefined) {
        result[option.name] = stored
      } else {
        result[option.name] = getDefaultStoredValue(option)
      }
    }

    return result
  }, [storedOptions])

  // Calculate modified counts
  const { modifiedCount, modifiedByCategory } = useMemo(() => {
    let count = 0
    const byCategory: Record<string, number> = {}

    for (const option of NEOVIM_OPTIONS_CATALOG) {
      const stored = storedOptions[option.name]
      if (stored !== undefined) {
        const defaultValue = getDefaultStoredValue(option)
        if (!areStoredValuesEqual(stored, defaultValue)) {
          count++
          byCategory[option.category] = (byCategory[option.category] ?? 0) + 1
        }
      }
    }

    // Count leader key if modified
    if (isLeaderKeyModified) {
      byCategory['keymaps'] = (byCategory['keymaps'] ?? 0) + 1
    }

    return { modifiedCount: count, modifiedByCategory: byCategory }
  }, [storedOptions, isLeaderKeyModified])

  // Check if an option is modified from default
  const isModifiedFromDefault = useCallback(
    (optionName: string): boolean => {
      const option = NEOVIM_OPTIONS_CATALOG.find((o) => o.name === optionName)
      if (!option) return false

      const stored = storedOptions[optionName]
      if (stored === undefined) return false

      return !isDefaultValue(option, stored)
    },
    [storedOptions],
  )

  // Get current value for an option
  const getOptionValue = useCallback(
    (optionName: string): NeovimOptionStoredValue => {
      const stored = effectiveValues[optionName]
      if (stored !== undefined) return stored

      const optionDef = NEOVIM_OPTIONS_CATALOG.find(
        (o) => o.name === optionName,
      )
      if (optionDef === undefined) {
        throw new Error(
          `Invariant: unknown option name "${optionName}" not in catalog`,
        )
      }
      return getDefaultStoredValue(optionDef)
    },
    [effectiveValues],
  )

  // Update a single option
  const updateOption = useCallback(
    async (
      optionName: string,
      value: NeovimOptionStoredValue,
    ): Promise<void> => {
      if (!projectPath) return

      const ctx = mutationTrackerRef.current.capture(projectPath)
      const updated = { ...storedOptions, [optionName]: value }
      setStoredOptions(updated)

      const result = await writeNeovimOptions(projectPath, updated)
      if (!result.success) {
        // Only revert if context is still current (prevent project B revert for project A failure)
        if (mutationTrackerRef.current.isCurrent(ctx)) {
          setStoredOptions(storedOptions)
        }
        throw new Error(result.error)
      }
    },
    [projectPath, storedOptions],
  )

  // Reset a single option
  const resetOption = useCallback(
    async (optionName: string): Promise<void> => {
      if (!projectPath) return

      const ctx = mutationTrackerRef.current.capture(projectPath)
      const { [optionName]: _removed, ...rest } = storedOptions
      void _removed
      setStoredOptions(rest)

      const result = await writeNeovimOptions(projectPath, rest)
      if (!result.success) {
        // Only revert if context is still current (prevent project B revert for project A failure)
        if (mutationTrackerRef.current.isCurrent(ctx)) {
          setStoredOptions(storedOptions)
        }
        throw new Error(result.error)
      }
    },
    [projectPath, storedOptions],
  )

  // Reset all options in a category
  const resetCategory = useCallback(
    async (category: string): Promise<void> => {
      if (!projectPath) return

      const ctx = mutationTrackerRef.current.capture(projectPath)
      const categoryOptions = NEOVIM_OPTIONS_CATALOG.filter(
        (o) => o.category === category,
      )
      const categoryNames = new Set(categoryOptions.map((o) => o.name))

      const updated: Record<string, NeovimOptionStoredValue> = {}
      for (const [name, value] of Object.entries(storedOptions)) {
        if (!categoryNames.has(name)) {
          updated[name] = value
        }
      }

      setStoredOptions(updated)

      const result = await writeNeovimOptions(projectPath, updated)
      if (!result.success) {
        // Only revert if context is still current (prevent project B revert for project A failure)
        if (mutationTrackerRef.current.isCurrent(ctx)) {
          setStoredOptions(storedOptions)
        }
        throw new Error(result.error)
      }
    },
    [projectPath, storedOptions],
  )

  // Reset all options and leader key to defaults atomically
  const resetAll = useCallback(async (): Promise<void> => {
    if (!projectPath) return

    const ctx = mutationTrackerRef.current.capture(projectPath)
    const previousOptions = storedOptions
    const previousLeaderKey = leaderKey
    const defaultOptions: Record<string, NeovimOptionStoredValue> = {}

    setStoredOptions(defaultOptions)
    setLeaderKey(DEFAULT_LEADER_KEY)

    const result = await writeNeovimOptions(
      projectPath,
      defaultOptions,
      DEFAULT_LEADER_KEY,
    )
    if (!result.success) {
      // Only revert if context is still current (prevent project B revert for project A failure)
      if (mutationTrackerRef.current.isCurrent(ctx)) {
        setStoredOptions(previousOptions)
        setLeaderKey(previousLeaderKey)
      }
      throw new Error(result.error)
    }
  }, [projectPath, storedOptions, leaderKey])

  // Apply a preset
  const applyPreset = useCallback(
    async (preset: OptionPreset): Promise<void> => {
      if (!projectPath) return

      const ctx = mutationTrackerRef.current.capture(projectPath)
      const updated = { ...storedOptions, ...preset.options }
      setStoredOptions(updated)

      const result = await writeNeovimOptions(projectPath, updated)
      if (!result.success) {
        // Only revert if context is still current (prevent project B revert for project A failure)
        if (mutationTrackerRef.current.isCurrent(ctx)) {
          setStoredOptions(storedOptions)
        }
        throw new Error(result.error)
      }
    },
    [projectPath, storedOptions],
  )

  // Refresh conflicts (placeholder - will be implemented with conflict scanner)
  const refreshConflicts = useCallback(async (): Promise<void> => {
    // TODO: Implement conflict scanning from graphs
    // For now, return empty
    setConflicts({})
  }, [])

  // Load conflicts on mount
  useEffect(() => {
    void refreshConflicts()
  }, [refreshConflicts])

  // Update leader key
  const updateLeaderKey = useCallback(
    async (key: string): Promise<void> => {
      if (!projectPath) return

      const ctx = mutationTrackerRef.current.capture(projectPath)
      const previousKey = leaderKey
      setLeaderKey(key)

      const result = await writeLeaderKey(projectPath, key)
      if (!result.success) {
        // Only revert if context is still current (prevent project B revert for project A failure)
        if (mutationTrackerRef.current.isCurrent(ctx)) {
          setLeaderKey(previousKey)
        }
        throw new Error(result.error)
      }
    },
    [projectPath, leaderKey],
  )

  // Reset leader key to default
  const resetLeaderKey = useCallback(async (): Promise<void> => {
    if (!projectPath) return

    const ctx = mutationTrackerRef.current.capture(projectPath)
    const previousKey = leaderKey
    setLeaderKey(DEFAULT_LEADER_KEY)

    const result = await writeLeaderKey(projectPath, DEFAULT_LEADER_KEY)
    if (!result.success) {
      // Only revert if context is still current (prevent project B revert for project A failure)
      if (mutationTrackerRef.current.isCurrent(ctx)) {
        setLeaderKey(previousKey)
      }
      throw new Error(result.error)
    }
  }, [projectPath, leaderKey])

  // Update highlight overrides
  const updateHighlightOverrides = useCallback(
    async (overrides: HighlightOverride[]): Promise<void> => {
      if (!projectPath) return

      const ctx = mutationTrackerRef.current.capture(projectPath)
      const previousOverrides = highlightOverrides
      setHighlightOverrides(overrides)

      const result = await writeNeovimOptions(
        projectPath,
        storedOptions,
        leaderKey,
        overrides,
      )
      if (!result.success) {
        // Only revert if context is still current (prevent project B revert for project A failure)
        if (mutationTrackerRef.current.isCurrent(ctx)) {
          setHighlightOverrides(previousOverrides)
        }
        throw new Error(result.error)
      }
    },
    [projectPath, highlightOverrides, storedOptions, leaderKey],
  )

  // Reset highlight overrides to empty
  const resetHighlightOverrides = useCallback(async (): Promise<void> => {
    if (!projectPath) return

    const ctx = mutationTrackerRef.current.capture(projectPath)
    const previousOverrides = highlightOverrides
    setHighlightOverrides([])

    const result = await writeNeovimOptions(
      projectPath,
      storedOptions,
      leaderKey,
      [],
    )
    if (!result.success) {
      // Only revert if context is still current (prevent project B revert for project A failure)
      if (mutationTrackerRef.current.isCurrent(ctx)) {
        setHighlightOverrides(previousOverrides)
      }
      throw new Error(result.error)
    }
  }, [projectPath, highlightOverrides, storedOptions, leaderKey])

  return {
    isLoading,
    error,
    effectiveValues,
    isModifiedFromDefault,
    getOptionValue,
    updateOption,
    resetOption,
    resetCategory,
    resetAll,
    applyPreset,
    conflicts,
    refreshConflicts,
    modifiedCount,
    modifiedByCategory,
    leaderKey,
    updateLeaderKey,
    resetLeaderKey,
    isLeaderKeyModified,
    highlightOverrides,
    updateHighlightOverrides,
    resetHighlightOverrides,
  }
}
