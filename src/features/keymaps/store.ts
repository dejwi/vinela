import { v4 as uuidv4 } from 'uuid'
import { usePluginStore } from '@/features/plugins/store'
import { createStore } from '@/shared/lib/store'
import type { KeymapMode, StoreInitStatus } from '@/shared/types'
import {
  type KeymapValidationIssue,
  validateKeymapReferences,
} from './lib/keymap-validation'
import { scanGraphsForKeymaps } from './scanner'
import { loadKeymaps, saveKeymaps } from './storage'
import type {
  GraphSourcedKeymap,
  ManualKeymapAction,
  ProjectKeymap,
} from './types'

interface KeymapState {
  // ── State ──────────────────────────────────────
  /** All manual keymaps loaded from keymaps.json */
  manualKeymaps: ProjectKeymap[]
  /** All keymaps detected from graphs */
  graphKeymaps: GraphSourcedKeymap[]
  /** Validation issues for plugin references */
  validationIssues: KeymapValidationIssue[]
  /** Discriminated init status — replaces boolean `initialized` + `isLoading` */
  initStatus: StoreInitStatus
  /** Error message, if any */
  error: string | null
  /** Current project path (needed for save operations) */
  projectPath: string | null

  // ── Actions ────────────────────────────────────
  /** Load all keymaps (manual + scan graphs) for a project */
  loadAllKeymaps: (projectPath: string) => Promise<void>
  /** Re-scan graphs only (e.g., after graph editor changes) */
  refreshGraphKeymaps: (projectPath: string) => Promise<void>
  /** Validate current keymaps against plugins store */
  validateKeymaps: () => void

  /** Create a new manual keymap */
  addManualKeymap: (params: {
    modes: KeymapMode[]
    keySequence: string
    action: ManualKeymapAction
    description: string
    silent: boolean
    noremap: boolean
    expr: boolean
  }) => Promise<void>

  /** Update an existing manual keymap */
  updateManualKeymap: (
    keymapId: string,
    updates: Partial<Omit<ProjectKeymap, 'id'>>,
  ) => Promise<void>

  /** Delete a manual keymap */
  deleteManualKeymap: (keymapId: string) => Promise<void>

  /** Toggle the enabled state of a manual keymap */
  toggleManualKeymap: (keymapId: string) => Promise<void>

  /** Clear error state */
  clearError: () => void

  /** Reset all state when closing a project */
  resetForProjectClose: () => void
}

// ── Module-level dedup ─────────────────────────────────────────────
/**
 * In-flight init promise per project path. Prevents duplicate concurrent
 * disk reads when both eager init and useEffect safety net fire.
 */
let inflightInit: { projectPath: string; promise: Promise<void> } | null = null

/**
 * Monotonically increasing generation counter. Incremented on every
 * loadAllKeymaps call. After async work completes, the store checks
 * whether the generation is still current before writing results.
 * This prevents stale project A data from overwriting project B state.
 */
let initGeneration = 0

/**
 * Plugin store subscription for reactive keymap validation.
 * Unsubscribed when project is closed to prevent memory leaks.
 */
let unsubscribePlugins: (() => void) | null = null

type PluginStoreState = ReturnType<typeof usePluginStore.getState>

interface PluginValidationSnapshot {
  installedPlugins: PluginStoreState['installedPlugins']
  schemas: PluginStoreState['schemas']
  initStatus: PluginStoreState['initStatus']['status']
}

function getPluginValidationSnapshot(
  pluginState: PluginStoreState,
): PluginValidationSnapshot {
  return {
    installedPlugins: pluginState.installedPlugins,
    schemas: pluginState.schemas,
    initStatus: pluginState.initStatus.status,
  }
}

function hasPluginValidationInputChanged(
  previous: PluginValidationSnapshot,
  current: PluginValidationSnapshot,
): boolean {
  return (
    previous.installedPlugins !== current.installedPlugins ||
    previous.schemas !== current.schemas ||
    previous.initStatus !== current.initStatus
  )
}

function clearPluginValidationSubscription(): void {
  unsubscribePlugins?.()
  unsubscribePlugins = null
}

export const useKeymapStore = createStore<KeymapState>((set, get) => ({
  manualKeymaps: [],
  graphKeymaps: [],
  validationIssues: [],
  initStatus: { status: 'idle' },
  error: null,
  projectPath: null,

  validateKeymaps: () => {
    const state = get()
    const { installedPlugins, schemas } = usePluginStore.getState()
    const issues = validateKeymapReferences(
      state.manualKeymaps,
      installedPlugins,
      schemas,
    )
    set((s) => {
      s.validationIssues = issues
    })
  },

  loadAllKeymaps: async (projectPath) => {
    const currentStatus = get().initStatus

    // ── Guard: skip if already ready for this exact project ──
    if (
      currentStatus.status === 'ready' &&
      currentStatus.projectPath === projectPath
    ) {
      return
    }

    // ── Dedup: if an init is already in-flight for this project, join it ──
    if (inflightInit !== null && inflightInit.projectPath === projectPath) {
      return inflightInit.promise
    }

    // ── Capture generation before starting async work ──
    initGeneration += 1
    const myGeneration = initGeneration

    // Always clear the previous plugin subscription at init start.
    // This prevents stale callbacks from a prior project/load attempt.
    clearPluginValidationSubscription()

    const doInit = async (): Promise<void> => {
      set((state) => {
        state.initStatus = { status: 'loading', projectPath }
        state.error = null
        state.projectPath = projectPath
      })

      try {
        // Load both in parallel — atomic staleness check after both complete
        const [manual, graphSourced] = await Promise.all([
          loadKeymaps(projectPath),
          scanGraphsForKeymaps(projectPath),
        ])

        // ── Staleness check: abort if a newer init has started ──
        if (myGeneration !== initGeneration) {
          return
        }

        set((state) => {
          state.manualKeymaps = manual
          state.graphKeymaps = graphSourced
          state.initStatus = { status: 'ready', projectPath }
        })

        // Subscribe with a narrowed scope so keymap revalidation only runs when
        // plugin validation inputs change (installed plugins, schemas, init status).
        // UI-only plugin store updates (searchQuery, activeTab, sort) are ignored.
        unsubscribePlugins = usePluginStore.subscribe(
          (pluginState, previousPluginState) => {
            const current = getPluginValidationSnapshot(pluginState)
            const previous = getPluginValidationSnapshot(previousPluginState)

            if (!hasPluginValidationInputChanged(previous, current)) {
              return
            }

            if (current.initStatus !== 'ready') {
              return
            }

            get().validateKeymaps()
          },
        )

        get().validateKeymaps()
      } catch (err) {
        // ── Staleness check on error path too ──
        if (myGeneration !== initGeneration) {
          return
        }

        // If this generation failed, ensure no prior subscriber remains active.
        clearPluginValidationSubscription()

        set((state) => {
          state.error =
            err instanceof Error ? err.message : 'Failed to load keymaps'
          state.initStatus = {
            status: 'error',
            projectPath,
            error:
              err instanceof Error ? err.message : 'Failed to load keymaps',
          }
        })
      } finally {
        // Defensive cleanup for failed/interleaved inits.
        // Keep the subscription only for the currently-ready generation.
        if (
          myGeneration === initGeneration &&
          get().initStatus.status !== 'ready'
        ) {
          clearPluginValidationSubscription()
        }

        // ── Clear inflight only if this is still the current request ──
        if (
          inflightInit?.projectPath === projectPath &&
          myGeneration === initGeneration
        ) {
          inflightInit = null
        }
      }
    }

    const promise = doInit()
    inflightInit = { projectPath, promise }
    return promise
  },

  refreshGraphKeymaps: async (projectPath) => {
    try {
      const graphSourced = await scanGraphsForKeymaps(projectPath)
      set((state) => {
        state.graphKeymaps = graphSourced
      })
    } catch (err) {
      set((state) => {
        state.error =
          err instanceof Error ? err.message : 'Failed to refresh graph keymaps'
      })
    }
  },

  addManualKeymap: async (params) => {
    const { projectPath, manualKeymaps } = get()
    if (!projectPath) {
      throw new Error('No project loaded')
    }

    const previousKeymaps = [...manualKeymaps]

    const newKeymap: ProjectKeymap = {
      id: uuidv4(),
      modes: params.modes,
      keySequence: params.keySequence,
      action: params.action,
      description: params.description,
      silent: params.silent,
      noremap: params.noremap,
      expr: params.expr,
      enabled: true,
    }

    // Optimistic update
    set((state) => {
      state.manualKeymaps.push(newKeymap)
    })

    get().validateKeymaps()

    try {
      await saveKeymaps(projectPath, get().manualKeymaps)
    } catch (err) {
      // Rollback on failure
      set((state) => {
        state.manualKeymaps = previousKeymaps
        state.error = err instanceof Error ? err.message : 'Failed to save'
      })
      get().validateKeymaps()
      throw err
    }
  },

  updateManualKeymap: async (keymapId, updates) => {
    const { projectPath, manualKeymaps } = get()
    if (!projectPath) {
      throw new Error('No project loaded')
    }

    const previousKeymaps = [...manualKeymaps]

    // Optimistic update
    set((state) => {
      const index = state.manualKeymaps.findIndex((k) => k.id === keymapId)
      if (index !== -1) {
        const existing = state.manualKeymaps[index]
        if (existing !== undefined) {
          state.manualKeymaps[index] = { ...existing, ...updates }
        }
      }
    })

    get().validateKeymaps()

    try {
      await saveKeymaps(projectPath, get().manualKeymaps)
    } catch (err) {
      // Rollback on failure
      set((state) => {
        state.manualKeymaps = previousKeymaps
        state.error = err instanceof Error ? err.message : 'Failed to save'
      })
      get().validateKeymaps()
      throw err
    }
  },

  deleteManualKeymap: async (keymapId) => {
    const { projectPath, manualKeymaps } = get()
    if (!projectPath) {
      throw new Error('No project loaded')
    }

    const previousKeymaps = [...manualKeymaps]

    // Optimistic update
    set((state) => {
      state.manualKeymaps = state.manualKeymaps.filter((k) => k.id !== keymapId)
    })

    get().validateKeymaps()

    try {
      await saveKeymaps(projectPath, get().manualKeymaps)
    } catch (err) {
      // Rollback on failure
      set((state) => {
        state.manualKeymaps = previousKeymaps
        state.error = err instanceof Error ? err.message : 'Failed to save'
      })
      get().validateKeymaps()
      throw err
    }
  },

  toggleManualKeymap: async (keymapId) => {
    const { projectPath, manualKeymaps } = get()
    if (!projectPath) {
      throw new Error('No project loaded')
    }

    const previousKeymaps = manualKeymaps.map((k) => ({ ...k }))

    // Optimistic update
    set((state) => {
      const keymap = state.manualKeymaps.find((k) => k.id === keymapId)
      if (keymap) {
        keymap.enabled = !keymap.enabled
      }
    })

    get().validateKeymaps()

    try {
      await saveKeymaps(projectPath, get().manualKeymaps)
    } catch (err) {
      // Rollback on failure
      set((state) => {
        state.manualKeymaps = previousKeymaps
        state.error = err instanceof Error ? err.message : 'Failed to save'
      })
      get().validateKeymaps()
      throw err
    }
  },

  clearError: () =>
    set((state) => {
      state.error = null
    }),

  resetForProjectClose: () => {
    // Bump generation so any in-flight init is discarded
    initGeneration += 1
    inflightInit = null

    // Unsubscribe from plugin store to prevent memory leaks
    unsubscribePlugins?.()
    unsubscribePlugins = null

    set((state) => {
      state.manualKeymaps = []
      state.graphKeymaps = []
      state.validationIssues = []
      state.initStatus = { status: 'idle' }
      state.error = null
      state.projectPath = null
    })
  },
}))

/**
 * Reset module-level state for test isolation.
 * Call in beforeEach to prevent state leaking between tests.
 */
export function _resetKeymapStoreTestState(): void {
  inflightInit = null
  initGeneration = 0
  clearPluginValidationSubscription()
}
