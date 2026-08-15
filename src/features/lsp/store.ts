/**
 * LSP Store
 *
 * Zustand store for managing LSP server configuration with hardened
 * initialization patterns (dedup, stale-guard, generation counter).
 */

import { createStore } from '@/shared/lib/store'
import type { StoreInitStatus } from '@/shared/types/init-lifecycle'
import { loadProjectLspConfig, saveProjectLspConfig } from './storage'

// ── Module-level dedup ─────────────────────────────────────────────
/**
 * In-flight init promise per project path. Prevents duplicate concurrent
 * disk reads when both eager init and useEffect safety net fire.
 */
let inflightInit: { projectPath: string; promise: Promise<void> } | null = null

/**
 * Monotonically increasing generation counter. Incremented on every
 * loadFromProject call. After async work completes, the store checks
 * whether the generation is still current before writing results.
 * This prevents stale project A data from overwriting project B state.
 */
let initGeneration = 0

interface LspState {
  // State
  enabledServers: string[]
  initStatus: StoreInitStatus
  error: string | null

  // Actions
  loadFromProject: (projectPath: string) => Promise<void>
  toggleServer: (serverName: string) => Promise<void>
  enableServer: (serverName: string) => Promise<void>
  disableServer: (serverName: string) => Promise<void>
  setEnabledServers: (servers: string[]) => Promise<void>
  resetForProjectClose: () => void
  clearError: () => void
}

export const useLspStore = createStore<LspState>((set, get) => ({
  enabledServers: [],
  initStatus: { status: 'idle' },
  error: null,

  loadFromProject: async (projectPath: string): Promise<void> => {
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

    const doInit = async (): Promise<void> => {
      set((state) => {
        state.initStatus = { status: 'loading', projectPath }
        state.error = null
      })

      try {
        const config = await loadProjectLspConfig(projectPath)

        // ── Staleness check: abort if a newer init has started ──
        if (myGeneration !== initGeneration) {
          return
        }

        set((state) => {
          state.enabledServers = config.enabledServers
          state.initStatus = { status: 'ready', projectPath }
        })
      } catch (err) {
        // ── Staleness check on error path too ──
        if (myGeneration !== initGeneration) {
          return
        }
        set((state) => {
          state.error = err instanceof Error ? err.message : String(err)
          state.initStatus = {
            status: 'error',
            projectPath,
            error: state.error ?? 'Unknown error',
          }
        })
      } finally {
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

  toggleServer: async (serverName: string): Promise<void> => {
    const { enabledServers, initStatus } = get()
    if (initStatus.status !== 'ready') return

    const isEnabled = enabledServers.includes(serverName)
    const updated = isEnabled
      ? enabledServers.filter((s) => s !== serverName)
      : [...enabledServers, serverName].sort()

    set((state) => {
      state.enabledServers = updated
    })
    await saveProjectLspConfig(initStatus.projectPath, {
      enabledServers: updated,
    })
  },

  enableServer: async (serverName: string): Promise<void> => {
    const { enabledServers, initStatus } = get()
    if (initStatus.status !== 'ready') return
    if (enabledServers.includes(serverName)) return

    const updated = [...enabledServers, serverName].sort()
    set((state) => {
      state.enabledServers = updated
    })
    await saveProjectLspConfig(initStatus.projectPath, {
      enabledServers: updated,
    })
  },

  disableServer: async (serverName: string): Promise<void> => {
    const { enabledServers, initStatus } = get()
    if (initStatus.status !== 'ready') return
    if (!enabledServers.includes(serverName)) return

    const updated = enabledServers.filter((s) => s !== serverName)
    set((state) => {
      state.enabledServers = updated
    })
    await saveProjectLspConfig(initStatus.projectPath, {
      enabledServers: updated,
    })
  },

  setEnabledServers: async (servers: string[]): Promise<void> => {
    const { initStatus } = get()
    if (initStatus.status !== 'ready') return

    const sorted = [...servers].sort()
    set((state) => {
      state.enabledServers = sorted
    })
    await saveProjectLspConfig(initStatus.projectPath, {
      enabledServers: sorted,
    })
  },

  resetForProjectClose: (): void => {
    // Bump generation so any in-flight init is discarded
    initGeneration += 1
    inflightInit = null

    set((state) => {
      state.enabledServers = []
      state.initStatus = { status: 'idle' }
      state.error = null
    })
  },

  clearError: (): void => {
    set((state) => {
      state.error = null
    })
  },
}))

/**
 * Test-only: reset module-level state for test isolation.
 * MUST NOT be used in production code.
 */
export function _resetLspStoreTestState(): void {
  initGeneration = 0
  inflightInit = null
  useLspStore.getState().resetForProjectClose()
}
