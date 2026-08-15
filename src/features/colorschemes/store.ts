import * as pluginStorage from '@/features/plugins/storage'
import { createStore } from '@/shared/lib/store'
import type {
  ColorSchemeCatalogEntry,
  ColorSchemeDisplayInfo,
  ProjectColorSchemesFile,
} from '@/shared/types'
import type { InstallResult, SetActiveResult, UninstallResult } from './storage'
import * as storage from './storage'
import { getThemePluginSchemaId, isThemeSchemaId } from './utils'

interface ColorSchemeState {
  // State
  catalog: ColorSchemeCatalogEntry[]
  preferences: ProjectColorSchemesFile
  // Theme plugin schema IDs → enabled state (Record for Zustand/Immer JSON serialization)
  installedPlugins: Record<string, { enabled: boolean }>
  isLoading: boolean

  // Actions - all return results, don't swallow errors
  initialize: (projectPath: string) => Promise<void>
  installColorScheme: (
    projectPath: string,
    catalogEntryId: string,
  ) => Promise<InstallResult>
  uninstallColorScheme: (
    projectPath: string,
    catalogEntryId: string,
  ) => Promise<UninstallResult>
  setActiveColorScheme: (
    projectPath: string,
    catalogEntryId: string | null,
  ) => Promise<SetActiveResult>

  // Sync with plugin store (call after plugin changes)
  syncWithPlugins: (projectPath: string) => Promise<void>
}

export const useColorSchemeStore = createStore<ColorSchemeState>(
  (set, get) => ({
    catalog: [],
    preferences: { activeScheme: null, variantPreferences: {} },
    installedPlugins: {},
    isLoading: false,

    initialize: async (projectPath) => {
      set((state) => {
        state.isLoading = true
      })

      try {
        const catalog = storage.loadCatalog()
        const preferencesResult =
          await storage.loadColorSchemePreferences(projectPath)

        // Handle error case by using defaults
        const preferences: ProjectColorSchemesFile = preferencesResult.success
          ? preferencesResult.data
          : { activeScheme: null, variantPreferences: {} }

        if (!preferencesResult.success) {
          console.error(
            'Failed to load color scheme preferences:',
            preferencesResult.error,
          )
        }

        const pluginsResult =
          await pluginStorage.loadInstalledPlugins(projectPath)

        // Track both installed AND enabled state
        const installedPluginsRecord: Record<string, { enabled: boolean }> = {}
        for (const plugin of pluginsResult.plugins) {
          if (isThemeSchemaId(plugin.schemaId)) {
            installedPluginsRecord[plugin.schemaId] = {
              enabled: plugin.enabled,
            }
          }
        }

        // Canonical format only - no migration

        set((state) => {
          state.catalog = catalog
          state.preferences = preferences
          state.installedPlugins = installedPluginsRecord
          state.isLoading = false
        })
      } catch (err) {
        console.error('Failed to initialize colorschemes:', err)
        set((state) => {
          state.isLoading = false
        })
      }
    },

    installColorScheme: async (projectPath, catalogEntryId) => {
      const result = await storage.installColorScheme(
        projectPath,
        catalogEntryId,
        true,
      )

      if (result.success) {
        // Refresh state
        await get().initialize(projectPath)
      }

      return result
    },

    uninstallColorScheme: async (projectPath, catalogEntryId) => {
      const result = await storage.uninstallColorScheme(
        projectPath,
        catalogEntryId,
      )

      if (result.success) {
        await get().initialize(projectPath)
      }

      return result
    },

    setActiveColorScheme: async (projectPath, catalogEntryId) => {
      const result = await storage.setActiveColorScheme(
        projectPath,
        catalogEntryId,
      )

      if (result.success) {
        await get().initialize(projectPath)
      }

      return result
    },

    syncWithPlugins: async (projectPath) => {
      // Called when plugin store changes to keep in sync
      const pluginsResult =
        await pluginStorage.loadInstalledPlugins(projectPath)
      const installedPluginsRecord: Record<string, { enabled: boolean }> = {}

      for (const plugin of pluginsResult.plugins) {
        if (isThemeSchemaId(plugin.schemaId)) {
          installedPluginsRecord[plugin.schemaId] = { enabled: plugin.enabled }
        }
      }

      set((state) => {
        state.installedPlugins = installedPluginsRecord
      })
    },
  }),
)

/**
 * Derive display list from state.
 * Installation status comes from plugin state, not colorschemes.json.
 */
export function getColorSchemeDisplayList(
  catalog: ColorSchemeCatalogEntry[],
  preferences: ProjectColorSchemesFile,
  installedPlugins: Record<string, { enabled: boolean }>,
): ColorSchemeDisplayInfo[] {
  return catalog.map((entry): ColorSchemeDisplayInfo => {
    const pluginSchemaId = getThemePluginSchemaId(entry.pluginRepo)
    const pluginState = installedPlugins[pluginSchemaId]
    const isInstalled = pluginState !== undefined

    // Theme is only "active" if plugin is both installed AND enabled
    const isPluginEnabled = pluginState?.enabled ?? false
    const isActive = isPluginEnabled && preferences.activeScheme === entry.id

    if (isInstalled) {
      return {
        status: 'installed',
        catalog: entry,
        pluginSchemaId,
        isActive,
        isPluginEnabled,
      }
    }

    return {
      status: 'available',
      catalog: entry,
      pluginSchemaId,
    }
  })
}
