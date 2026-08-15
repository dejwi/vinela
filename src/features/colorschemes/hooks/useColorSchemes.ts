import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePluginStore } from '@/features/plugins/store'
import { useProjectStore } from '@/features/projects/store'
import type { ColorSchemeDisplayInfo } from '@/shared/types'
import { getColorSchemeDisplayList, useColorSchemeStore } from '../store'

interface UseColorSchemesReturn {
  displayList: ColorSchemeDisplayInfo[]
  activeSchemeId: string | null
  isLoading: boolean
  installColorScheme: (id: string) => Promise<boolean>
  uninstallColorScheme: (id: string) => Promise<boolean>
  setActiveColorScheme: (id: string | null) => Promise<boolean>
  actionState: {
    installing: string[]
    uninstalling: string[]
  }
}

export function useColorSchemes(): UseColorSchemesReturn {
  const projectPath = useProjectStore((s) => s.currentProject?.absolutePath)
  const {
    catalog,
    preferences,
    installedPlugins,
    isLoading,
    initialize,
    installColorScheme: storeInstall,
    uninstallColorScheme: storeUninstall,
    setActiveColorScheme: storeSetActive,
    syncWithPlugins,
  } = useColorSchemeStore()

  // Subscribe to plugin store changes
  const pluginStoreVersion = usePluginStore((s) => s.installedPlugins.length)

  const [actionState, setActionState] = useState<{
    installing: string[]
    uninstalling: string[]
  }>({ installing: [], uninstalling: [] })

  // Initialize on mount / project change
  useEffect(() => {
    if (projectPath) {
      void initialize(projectPath)
    }
  }, [projectPath, initialize])

  // Sync when plugins change (using pluginStoreVersion as a trigger)
  // biome-ignore lint/correctness/useExhaustiveDependencies: pluginStoreVersion triggers sync; syncWithPlugins is stable (Zustand store action)
  useEffect(() => {
    if (projectPath) {
      void syncWithPlugins(projectPath)
    }
  }, [projectPath, pluginStoreVersion, syncWithPlugins])

  const displayList = useMemo(
    () => getColorSchemeDisplayList(catalog, preferences, installedPlugins),
    [catalog, preferences, installedPlugins],
  )

  const installColorScheme = useCallback(
    async (id: string): Promise<boolean> => {
      if (!projectPath) return false

      setActionState((s) => ({ ...s, installing: [...s.installing, id] }))

      try {
        const entry = catalog.find((e) => e.id === id)
        const name = entry?.name ?? id

        const result = await storeInstall(projectPath, id)

        if (result.success) {
          toast.success('Theme installed', {
            description: `${name} is ready to use.`,
          })
          return true
        } else {
          toast.error('Failed to install theme', {
            description: result.error,
          })
          return false
        }
      } finally {
        setActionState((s) => ({
          ...s,
          installing: s.installing.filter((i) => i !== id),
        }))
      }
    },
    [projectPath, catalog, storeInstall],
  )

  const uninstallColorScheme = useCallback(
    async (id: string): Promise<boolean> => {
      if (!projectPath) return false

      setActionState((s) => ({ ...s, uninstalling: [...s.uninstalling, id] }))

      try {
        const entry = catalog.find((e) => e.id === id)
        const name = entry?.name ?? id

        const result = await storeUninstall(projectPath, id)

        if (result.success) {
          toast.success('Theme removed', {
            description: `${name} has been removed.`,
          })
          return true
        } else {
          toast.error('Failed to uninstall theme', {
            description: result.error,
          })
          return false
        }
      } finally {
        setActionState((s) => ({
          ...s,
          uninstalling: s.uninstalling.filter((i) => i !== id),
        }))
      }
    },
    [projectPath, catalog, storeUninstall],
  )

  const setActiveColorScheme = useCallback(
    async (id: string | null): Promise<boolean> => {
      if (!projectPath) return false

      const entry = id ? catalog.find((e) => e.id === id) : null
      const name = entry?.name ?? id ?? 'default'

      const result = await storeSetActive(projectPath, id)

      if (result.success) {
        toast.success('Active theme updated', {
          description: id
            ? `${name} is now the active theme.`
            : 'Using Neovim default theme.',
        })
        return true
      } else {
        toast.error('Failed to set active theme', {
          description: result.error,
        })
        return false
      }
    },
    [projectPath, catalog, storeSetActive],
  )

  return {
    displayList,
    activeSchemeId: preferences.activeScheme,
    isLoading,
    installColorScheme,
    uninstallColorScheme,
    setActiveColorScheme,
    actionState,
  }
}
