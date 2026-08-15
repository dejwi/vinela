import { createStore } from '@/shared/lib/store'
import type {
  InstalledPlugin,
  PluginCategory,
  PluginConfigValue,
  PluginDisplayInfo,
  PluginInstallOverride,
  PluginSchema,
  ResolvedSchema,
  SchemaImportScope,
  StoreInitStatus,
} from '@/shared/types'
import type { BrowseSortOption, InstalledSortOption } from './sort-filter'
import * as pluginStorage from './storage'

interface PluginState {
  // State
  schemas: ResolvedSchema[]
  installedPlugins: InstalledPlugin[]
  /** Discriminated init status — replaces boolean `initialized` + `isLoading` */
  initStatus: StoreInitStatus
  error: string | null

  // UI State — Plugins Page
  activeTab: 'installed' | 'browse'
  searchQuery: string
  installedSort: InstalledSortOption
  browseSort: BrowseSortOption
  selectedCategory: PluginCategory | null

  // Actions
  loadSchemas: (projectPath: string) => Promise<void>
  loadInstalledPlugins: (projectPath: string) => Promise<void>
  initializePlugins: (projectPath: string) => Promise<void>

  installPlugin: (projectPath: string, schemaId: string) => Promise<void>
  uninstallPlugin: (projectPath: string, schemaId: string) => Promise<void>
  togglePlugin: (
    projectPath: string,
    schemaId: string,
    enabled: boolean,
  ) => Promise<void>
  updatePluginConfig: (
    projectPath: string,
    schemaId: string,
    config: Record<string, PluginConfigValue>,
  ) => Promise<void>
  updateLuaFieldOverride: (
    projectPath: string,
    schemaId: string,
    optionKey: string,
    include: boolean,
  ) => Promise<void>
  clearLuaFieldOverride: (
    projectPath: string,
    schemaId: string,
    optionKey: string,
  ) => Promise<void>
  updatePluginInstallOverride: (
    projectPath: string,
    schemaId: string,
    override: PluginInstallOverride,
  ) => Promise<void>
  clearPluginInstallOverride: (
    projectPath: string,
    schemaId: string,
  ) => Promise<void>
  resetPluginToDefaults: (
    projectPath: string,
    schemaId: string,
    defaults: Record<string, PluginConfigValue>,
  ) => Promise<void>

  // Schema management
  saveGlobalSchema: (schema: PluginSchema, projectPath: string) => Promise<void>
  deleteGlobalSchema: (schemaId: string, projectPath: string) => Promise<void>

  /**
   * Import a schema to global schemas directory.
   * Validates the schema before saving.
   * Reloads schemas after saving so the UI reflects the new schema.
   */
  importSchema: (
    schema: PluginSchema,
    projectPath: string,
    scope: SchemaImportScope,
  ) => Promise<void>
  deleteSchema: (
    schemaId: string,
    source: SchemaImportScope,
    projectPath: string,
  ) => Promise<void>

  // Export
  exportStandalone: (
    projectPath: string,
  ) => Promise<{ copied: string[]; alreadyLocal: string[] } | null>

  // UI Actions
  setActiveTab: (tab: 'installed' | 'browse') => void
  setSearchQuery: (query: string) => void
  setInstalledSort: (option: InstalledSortOption) => void
  setBrowseSort: (option: BrowseSortOption) => void
  setSelectedCategory: (category: PluginCategory | null) => void

  clearError: () => void

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
 * initializePlugins call. After async work completes, the store checks
 * whether the generation is still current before writing results.
 * This prevents stale project A data from overwriting project B state.
 */
let initGeneration = 0

function cloneInstallOverride(
  override: PluginInstallOverride | undefined,
): PluginInstallOverride | undefined {
  if (override === undefined) {
    return undefined
  }

  return {
    ...(override.name !== undefined && { name: override.name }),
    ...(override.version !== undefined && {
      version:
        override.version.mode === 'semver-range'
          ? { mode: 'semver-range', value: override.version.value }
          : {
              mode: 'ref',
              refKind: override.version.refKind,
              value: override.version.value,
            },
    }),
  }
}

function cloneInstalledPluginsForRollback(
  plugins: readonly InstalledPlugin[],
): InstalledPlugin[] {
  return plugins.map((plugin) => ({
    ...plugin,
    config: plugin.config,
    ...(plugin.luaFieldOverrides !== undefined && {
      luaFieldOverrides: { ...plugin.luaFieldOverrides },
    }),
    ...(plugin.installOverride !== undefined && {
      installOverride: cloneInstallOverride(plugin.installOverride),
    }),
  }))
}

function shouldApplyProjectScopedPluginState(
  initStatus: StoreInitStatus,
  projectPath: string,
  generation: number,
): boolean {
  if (generation !== initGeneration) {
    return false
  }

  return (
    (initStatus.status === 'loading' ||
      initStatus.status === 'ready' ||
      initStatus.status === 'error') &&
    initStatus.projectPath === projectPath
  )
}

export const usePluginStore = createStore<PluginState>((set, get) => ({
  schemas: [],
  installedPlugins: [],
  initStatus: { status: 'idle' },
  error: null,

  // UI State defaults
  activeTab: 'installed',
  searchQuery: '',
  installedSort: 'name-asc',
  browseSort: 'stars-desc',
  selectedCategory: null,

  loadSchemas: async (projectPath) => {
    const generationAtStart = initGeneration
    try {
      const schemas = await pluginStorage.loadAllSchemas(projectPath)
      if (
        shouldApplyProjectScopedPluginState(
          get().initStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set({ schemas })
      }
    } catch (err) {
      if (
        shouldApplyProjectScopedPluginState(
          get().initStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.error = `Failed to load schemas: ${String(err)}`
        })
      }
    }
  },

  loadInstalledPlugins: async (projectPath) => {
    try {
      const result = await pluginStorage.loadInstalledPlugins(projectPath)

      set((state) => {
        state.installedPlugins = result.plugins
      })

      // Handle non-normal statuses
      switch (result.status) {
        case 'corrupted':
          set((state) => {
            state.error =
              `Plugin configuration file appears corrupted: ${result.error}. ` +
              `Your plugin settings may have been reset. You can reinstall plugins from the Plugins page.`
          })
          // Also log for debugging
          console.error('[Plugins] plugins.json corrupted:', result.error)
          break

        case 'permission-denied':
          set((state) => {
            state.error =
              `Cannot read plugin configuration: ${result.error}. ` +
              `Check file permissions for the project directory.`
          })
          console.error(
            '[Plugins] plugins.json permission denied:',
            result.error,
          )
          break

        case 'file-not-found':
          // Normal for new projects — no action needed
          break

        case 'loaded':
          // Normal successful load — no action needed
          break
      }
    } catch (err) {
      set((state) => {
        state.error = `Failed to load plugins: ${String(err)}`
      })
    }
  },

  initializePlugins: async (projectPath) => {
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
        // Load both in parallel — atomic staleness check after both complete
        const [schemas, pluginsResult] = await Promise.all([
          pluginStorage.loadAllSchemas(projectPath),
          pluginStorage.loadInstalledPlugins(projectPath),
        ])

        // ── Staleness check: abort if a newer init has started ──
        if (myGeneration !== initGeneration) {
          return
        }

        // Handle error states from plugin load
        let errorMessage: string | null = null
        switch (pluginsResult.status) {
          case 'corrupted':
            errorMessage =
              `Plugin configuration file appears corrupted: ${pluginsResult.error}. ` +
              `Your plugin settings may have been reset. You can reinstall plugins from the Plugins page.`
            console.error(
              '[Plugins] plugins.json corrupted:',
              pluginsResult.error,
            )
            break
          case 'permission-denied':
            errorMessage =
              `Cannot read plugin configuration: ${pluginsResult.error}. ` +
              `Check file permissions for the project directory.`
            console.error(
              '[Plugins] plugins.json permission denied:',
              pluginsResult.error,
            )
            break
          case 'file-not-found':
          case 'loaded':
            // Normal cases - no error
            break
        }

        set({
          schemas,
          installedPlugins: pluginsResult.plugins,
          error: errorMessage,
          initStatus: { status: 'ready', projectPath },
        })
      } catch (err) {
        // ── Staleness check on error path too ──
        if (myGeneration !== initGeneration) {
          return
        }

        set((state) => {
          state.initStatus = {
            status: 'error',
            projectPath,
            error: String(err),
          }
          state.error = `Failed to initialize plugins: ${String(err)}`
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

  installPlugin: async (projectPath, schemaId) => {
    try {
      await pluginStorage.installPlugin(projectPath, schemaId)
      await get().loadInstalledPlugins(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to install plugin: ${String(err)}`
      })
    }
  },

  uninstallPlugin: async (projectPath, schemaId) => {
    try {
      await pluginStorage.uninstallPlugin(projectPath, schemaId)
      await get().loadInstalledPlugins(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to uninstall plugin: ${String(err)}`
      })
    }
  },

  togglePlugin: async (projectPath, schemaId, enabled) => {
    try {
      await pluginStorage.togglePlugin(projectPath, schemaId, enabled)
      await get().loadInstalledPlugins(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to toggle plugin: ${String(err)}`
      })
    }
  },

  updatePluginConfig: async (projectPath, schemaId, config) => {
    try {
      await pluginStorage.updatePluginConfig(projectPath, schemaId, config)
      await get().loadInstalledPlugins(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to update config: ${String(err)}`
      })
    }
  },

  updateLuaFieldOverride: async (projectPath, schemaId, optionKey, include) => {
    try {
      set((state) => {
        const plugin = state.installedPlugins.find(
          (p) => p.schemaId === schemaId,
        )
        if (plugin !== undefined) {
          if (plugin.luaFieldOverrides === undefined) {
            plugin.luaFieldOverrides = {}
          }
          plugin.luaFieldOverrides[optionKey] = include
        }
      })

      await pluginStorage.updateLuaFieldOverride(
        projectPath,
        schemaId,
        optionKey,
        include,
      )
    } catch (err) {
      set((state) => {
        state.error = `Failed to update lua include toggle: ${String(err)}`
      })
    }
  },

  clearLuaFieldOverride: async (projectPath, schemaId, optionKey) => {
    try {
      set((state) => {
        const plugin = state.installedPlugins.find(
          (p) => p.schemaId === schemaId,
        )
        if (plugin?.luaFieldOverrides === undefined) {
          return
        }

        delete plugin.luaFieldOverrides[optionKey]
        if (Object.keys(plugin.luaFieldOverrides).length === 0) {
          delete plugin.luaFieldOverrides
        }
      })

      await pluginStorage.clearLuaFieldOverride(
        projectPath,
        schemaId,
        optionKey,
      )
    } catch (err) {
      set((state) => {
        state.error = `Failed to clear lua include toggle: ${String(err)}`
      })
    }
  },

  updatePluginInstallOverride: async (projectPath, schemaId, override) => {
    const previousInstalledPlugins = cloneInstalledPluginsForRollback(
      get().installedPlugins,
    )
    const generationAtStart = initGeneration

    try {
      set((state) => {
        const plugin = state.installedPlugins.find(
          (p) => p.schemaId === schemaId,
        )
        if (plugin !== undefined) {
          plugin.installOverride = cloneInstallOverride(override)
        }
      })

      await pluginStorage.updatePluginInstallOverride(
        projectPath,
        schemaId,
        override,
      )

      const result = await pluginStorage.loadInstalledPlugins(projectPath)
      const nextInitStatus = get().initStatus
      if (
        shouldApplyProjectScopedPluginState(
          nextInitStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.installedPlugins = result.plugins
        })
      }
    } catch (err) {
      const nextInitStatus = get().initStatus
      if (
        shouldApplyProjectScopedPluginState(
          nextInitStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.installedPlugins = previousInstalledPlugins
          state.error = `Failed to update plugin install version: ${String(err)}`
        })
      }
      throw err
    }
  },

  clearPluginInstallOverride: async (projectPath, schemaId) => {
    const previousInstalledPlugins = cloneInstalledPluginsForRollback(
      get().installedPlugins,
    )
    const generationAtStart = initGeneration

    try {
      set((state) => {
        const plugin = state.installedPlugins.find(
          (p) => p.schemaId === schemaId,
        )
        if (plugin !== undefined) {
          delete plugin.installOverride
        }
      })

      await pluginStorage.clearPluginInstallOverride(projectPath, schemaId)

      const result = await pluginStorage.loadInstalledPlugins(projectPath)
      const nextInitStatus = get().initStatus
      if (
        shouldApplyProjectScopedPluginState(
          nextInitStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.installedPlugins = result.plugins
        })
      }
    } catch (err) {
      const nextInitStatus = get().initStatus
      if (
        shouldApplyProjectScopedPluginState(
          nextInitStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.installedPlugins = previousInstalledPlugins
          state.error = `Failed to reset plugin install version: ${String(err)}`
        })
      }
      throw err
    }
  },

  resetPluginToDefaults: async (projectPath, schemaId, defaults) => {
    try {
      await pluginStorage.resetPluginToDefaults(projectPath, schemaId, defaults)
      await get().loadInstalledPlugins(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to reset plugin defaults: ${String(err)}`
      })
    }
  },

  saveGlobalSchema: async (schema, projectPath) => {
    try {
      await pluginStorage.saveGlobalSchema(schema)
      await get().loadSchemas(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to save schema: ${String(err)}`
      })
    }
  },

  importSchema: async (schema, projectPath, scope) => {
    const generationAtStart = initGeneration
    try {
      if (scope === 'global') {
        await pluginStorage.saveGlobalSchema(schema)
      } else {
        await pluginStorage.saveProjectSchema(projectPath, schema)
      }
      await get().loadSchemas(projectPath)
    } catch (err) {
      if (
        shouldApplyProjectScopedPluginState(
          get().initStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.error = `Failed to import schema: ${String(err)}`
        })
      }
      throw err
    }
  },

  deleteSchema: async (schemaId, source, projectPath) => {
    const generationAtStart = initGeneration
    try {
      if (source === 'global') {
        await pluginStorage.deleteGlobalSchema(schemaId)
      } else {
        await pluginStorage.deleteProjectSchema(projectPath, schemaId)
      }
      await get().loadSchemas(projectPath)
    } catch (err) {
      if (
        shouldApplyProjectScopedPluginState(
          get().initStatus,
          projectPath,
          generationAtStart,
        )
      ) {
        set((state) => {
          state.error = `Failed to delete schema: ${String(err)}`
        })
      }
      throw err
    }
  },

  deleteGlobalSchema: async (schemaId, projectPath) => {
    try {
      await pluginStorage.deleteGlobalSchema(schemaId)
      await get().loadSchemas(projectPath)
    } catch (err) {
      set((state) => {
        state.error = `Failed to delete schema: ${String(err)}`
      })
    }
  },

  exportStandalone: async (projectPath) => {
    const { installedPlugins } = get()
    const usedSchemaIds = installedPlugins.map((p) => p.schemaId)
    const result = await pluginStorage.exportStandalone(
      projectPath,
      usedSchemaIds,
    )
    if (result.success) {
      await get().loadSchemas(projectPath)
      return { copied: result.copied, alreadyLocal: result.alreadyLocal }
    }
    set((state) => {
      state.error = result.error
    })
    return null
  },

  // UI Actions
  setActiveTab: (tab) =>
    set((state) => {
      state.activeTab = tab
    }),

  setSearchQuery: (query) =>
    set((state) => {
      state.searchQuery = query
    }),

  setInstalledSort: (option) =>
    set((state) => {
      state.installedSort = option
    }),

  setBrowseSort: (option) =>
    set((state) => {
      state.browseSort = option
    }),

  setSelectedCategory: (category) =>
    set((state) => {
      state.selectedCategory = category
    }),

  clearError: () =>
    set((state) => {
      state.error = null
    }),

  resetForProjectClose: () => {
    // Bump generation so any in-flight init is discarded
    initGeneration += 1
    inflightInit = null

    set((state) => {
      state.schemas = []
      state.installedPlugins = []
      state.initStatus = { status: 'idle' }
      state.error = null
      state.activeTab = 'installed'
      state.searchQuery = ''
      state.installedSort = 'name-asc'
      state.browseSort = 'stars-desc'
      state.selectedCategory = null
    })
  },
}))

/**
 * Reset module-level state for test isolation.
 * Call in beforeEach to prevent state leaking between tests.
 */
export function _resetPluginStoreTestState(): void {
  inflightInit = null
  initGeneration = 0
}

/**
 * Combine schemas and installed plugins into display info.
 * Used by UI components to show install status.
 */
export function getPluginDisplayList(
  schemas: ResolvedSchema[],
  installedPlugins: InstalledPlugin[],
): PluginDisplayInfo[] {
  const installedMap = new Map(installedPlugins.map((p) => [p.schemaId, p]))
  const result: PluginDisplayInfo[] = []

  // 1. Map schemas to installed/available entries
  const matchedSchemaIds = new Set<string>()
  for (const { schema, source } of schemas) {
    const installed = installedMap.get(schema.id)
    if (installed) {
      result.push({ status: 'installed', schema, source, installed })
      matchedSchemaIds.add(schema.id)
    } else {
      result.push({ status: 'available', schema, source })
    }
  }

  // 2. Detect orphaned plugins (installed but no matching schema)
  for (const plugin of installedPlugins) {
    if (!matchedSchemaIds.has(plugin.schemaId)) {
      result.push({
        status: 'orphaned',
        installed: plugin,
        schemaId: plugin.schemaId,
      })
    }
  }

  return result
}
