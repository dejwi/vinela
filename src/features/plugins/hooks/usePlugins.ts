import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useProjectStore } from '@/features/projects/store'
import type {
  PluginConfigValue,
  PluginDisplayInfo,
  PluginInstallOverride,
  PluginSchema,
  SchemaImportScope,
  StoreInitStatus,
} from '@/shared/types'
import { getPluginDisplayList, usePluginStore } from '../store'
import { getEffectiveInstallVersionDisplay } from '../utils/install-version'

/**
 * Hook that initializes plugin data when project is loaded.
 * Returns the display list combining schemas + install state.
 */
export function usePlugins(): {
  plugins: PluginDisplayInfo[]
  /** True during the async loading phase or when idle (not yet started) */
  isLoading: boolean
  /** The full init lifecycle status for richer UI states */
  initStatus: StoreInitStatus
  error: string | null
  retry: () => void
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
  exportStandalone: (projectPath: string) => Promise<void>
  importSchema: (
    projectPath: string,
    schema: PluginSchema,
    alsoInstall: boolean,
    scope: SchemaImportScope,
  ) => Promise<void>
  deleteSchema: (
    projectPath: string,
    schemaId: string,
    source: SchemaImportScope,
  ) => Promise<void>
  actionState: {
    installing: string[]
    uninstalling: string[]
    deletingSchemas: string[]
  }
} {
  const projectPath = useProjectStore((s) => s.currentProject?.absolutePath)
  const schemas = usePluginStore((s) => s.schemas)
  const installedPlugins = usePluginStore((s) => s.installedPlugins)
  const initStatus = usePluginStore((s) => s.initStatus)
  const error = usePluginStore((s) => s.error)
  const initializePlugins = usePluginStore((s) => s.initializePlugins)

  // Treat both 'idle' and 'loading' as loading states — idle means not yet started
  const isLoading =
    initStatus.status === 'loading' || initStatus.status === 'idle'

  useEffect(() => {
    if (projectPath) {
      void initializePlugins(projectPath)
    }
  }, [projectPath, initializePlugins])

  const plugins = useMemo(
    () => getPluginDisplayList(schemas, installedPlugins),
    [schemas, installedPlugins],
  )

  const retry = useCallback((): void => {
    if (projectPath) {
      // Reset to idle so the guard doesn't skip, then re-initialize
      usePluginStore.setState((state) => {
        state.initStatus = { status: 'idle' }
      })
      void initializePlugins(projectPath)
    }
  }, [projectPath, initializePlugins])

  // Track action states
  const [installingIds, setInstallingIds] = useState<string[]>([])
  const [uninstallingIds, setUninstallingIds] = useState<string[]>([])
  const [deletingSchemaIds, setDeletingSchemaIds] = useState<string[]>([])

  const installPlugin = useCallback(
    async (projectPath: string, schemaId: string): Promise<void> => {
      setInstallingIds((prev) => [...prev, schemaId])
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((s) => s.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId

        await usePluginStore.getState().installPlugin(projectPath, schemaId)
        await initializePlugins(projectPath)

        toast.success(`Plugin installed`, {
          description: `${pluginName} has been successfully installed.`,
        })
      } catch (error) {
        toast.error(`Failed to install plugin`, {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        setInstallingIds((prev) => prev.filter((id) => id !== schemaId))
      }
    },
    [initializePlugins],
  )

  const uninstallPlugin = useCallback(
    async (projectPath: string, schemaId: string): Promise<void> => {
      setUninstallingIds((prev) => [...prev, schemaId])
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((s) => s.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId

        await usePluginStore.getState().uninstallPlugin(projectPath, schemaId)
        await initializePlugins(projectPath)

        toast.success(`Plugin removed`, {
          description: `${pluginName} has been successfully uninstalled.`,
        })
      } catch (error) {
        toast.error(`Failed to remove plugin`, {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        setUninstallingIds((prev) => prev.filter((id) => id !== schemaId))
      }
    },
    [initializePlugins],
  )

  const togglePlugin = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      enabled: boolean,
    ): Promise<void> => {
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((s) => s.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId

        await usePluginStore
          .getState()
          .togglePlugin(projectPath, schemaId, enabled)

        toast.success(enabled ? 'Plugin enabled' : 'Plugin disabled', {
          description: `${pluginName} is now ${enabled ? 'enabled' : 'disabled'}.`,
        })
      } catch (error) {
        toast.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin`, {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const updatePluginConfig = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      config: Record<string, PluginConfigValue>,
    ): Promise<void> => {
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((s) => s.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId

        await usePluginStore
          .getState()
          .updatePluginConfig(projectPath, schemaId, config)

        toast.success('Configuration saved', {
          description: `Changes to ${pluginName} have been saved.`,
        })
      } catch (error) {
        toast.error('Failed to save configuration', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const updateLuaFieldOverride = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      optionKey: string,
      include: boolean,
    ): Promise<void> => {
      try {
        await usePluginStore
          .getState()
          .updateLuaFieldOverride(projectPath, schemaId, optionKey, include)
      } catch (error) {
        toast.error('Failed to update Lua include toggle', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const clearLuaFieldOverride = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      optionKey: string,
    ): Promise<void> => {
      try {
        await usePluginStore
          .getState()
          .clearLuaFieldOverride(projectPath, schemaId, optionKey)
      } catch (error) {
        toast.error('Failed to clear Lua include toggle', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const updatePluginInstallOverride = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      override: PluginInstallOverride,
    ): Promise<void> => {
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((candidate) => candidate.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId

        await usePluginStore
          .getState()
          .updatePluginInstallOverride(projectPath, schemaId, override)

        toast.success('Install version saved', {
          description: `Saved install target for ${pluginName}.`,
        })
      } catch (error) {
        toast.error('Failed to save install version', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const clearPluginInstallOverride = useCallback(
    async (projectPath: string, schemaId: string): Promise<void> => {
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((candidate) => candidate.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId
        const defaultTarget = getEffectiveInstallVersionDisplay(
          schema?.schema.pack?.version,
          undefined,
        )

        await usePluginStore
          .getState()
          .clearPluginInstallOverride(projectPath, schemaId)

        toast.success('Install version reset', {
          description: `${pluginName} now uses ${defaultTarget.label.toLowerCase()}.`,
        })
      } catch (error) {
        toast.error('Failed to reset install version', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const resetPluginToDefaults = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      defaults: Record<string, PluginConfigValue>,
    ): Promise<void> => {
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((s) => s.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId

        await usePluginStore
          .getState()
          .resetPluginToDefaults(projectPath, schemaId, defaults)

        toast.success('Configuration reset', {
          description: `${pluginName} was reset to defaults.`,
        })
      } catch (error) {
        toast.error('Failed to reset configuration', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const exportStandalone = useCallback(
    async (projectPath: string): Promise<void> => {
      try {
        const result = await usePluginStore
          .getState()
          .exportStandalone(projectPath)

        if (result) {
          toast.success('Export complete', {
            description: `Exported ${result.copied.length} schema(s) to project.`,
          })
        }
      } catch (error) {
        toast.error('Export failed', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [],
  )

  const importSchema = useCallback(
    async (
      projectPath: string,
      schema: PluginSchema,
      alsoInstall: boolean,
      scope: SchemaImportScope,
    ): Promise<void> => {
      try {
        await usePluginStore.getState().importSchema(schema, projectPath, scope)

        if (alsoInstall) {
          await usePluginStore.getState().installPlugin(projectPath, schema.id)
          await initializePlugins(projectPath)
          toast.success('Plugin imported and installed', {
            description:
              scope === 'project'
                ? `${schema.pluginName} has been added to the current project.`
                : `${schema.pluginName} has been added to the current project and is available in all projects.`,
          })
        } else {
          toast.success('Schema imported', {
            description:
              scope === 'project'
                ? `${schema.pluginName} was added to the current project.`
                : `${schema.pluginName} is available in all projects.`,
          })
        }
      } catch (error) {
        toast.error('Import failed', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [initializePlugins],
  )

  const deleteSchema = useCallback(
    async (
      projectPath: string,
      schemaId: string,
      source: SchemaImportScope,
    ): Promise<void> => {
      setDeletingSchemaIds((previous) => [...previous, schemaId])
      try {
        const schema = usePluginStore
          .getState()
          .schemas.find((candidate) => candidate.schema.id === schemaId)
        const pluginName = schema?.schema.pluginName ?? schemaId
        await usePluginStore
          .getState()
          .deleteSchema(schemaId, source, projectPath)
        toast.success('Plugin removed from catalog', {
          description: `${pluginName} was removed from the ${source === 'global' ? 'global' : 'project'} catalog.`,
        })
      } catch (error) {
        toast.error('Failed to remove plugin from catalog', {
          description: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        setDeletingSchemaIds((previous) =>
          previous.filter((id) => id !== schemaId),
        )
      }
    },
    [],
  )

  return {
    plugins,
    isLoading,
    initStatus,
    error,
    retry,
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePluginConfig,
    updateLuaFieldOverride,
    clearLuaFieldOverride,
    updatePluginInstallOverride,
    clearPluginInstallOverride,
    resetPluginToDefaults,
    exportStandalone,
    importSchema,
    deleteSchema,
    actionState: {
      installing: installingIds,
      uninstalling: uninstallingIds,
      deletingSchemas: deletingSchemaIds,
    },
  }
}

export function usePluginActions(): {
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
  exportStandalone: (projectPath: string) => Promise<void>
  importSchema: (
    projectPath: string,
    schema: PluginSchema,
    alsoInstall: boolean,
    scope: SchemaImportScope,
  ) => Promise<void>
  deleteSchema: (
    projectPath: string,
    schemaId: string,
    source: SchemaImportScope,
  ) => Promise<void>
  actionState: {
    installing: string[]
    uninstalling: string[]
    deletingSchemas: string[]
  }
} {
  const {
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePluginConfig,
    updateLuaFieldOverride,
    clearLuaFieldOverride,
    updatePluginInstallOverride,
    clearPluginInstallOverride,
    resetPluginToDefaults,
    exportStandalone,
    importSchema,
    deleteSchema,
    actionState,
  } = usePlugins()

  return {
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePluginConfig,
    updateLuaFieldOverride,
    clearLuaFieldOverride,
    updatePluginInstallOverride,
    clearPluginInstallOverride,
    resetPluginToDefaults,
    exportStandalone,
    importSchema,
    deleteSchema,
    actionState,
  }
}
