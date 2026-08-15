import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getDefaultAppSettings,
  loadAppSettings,
  SETTING_DEFAULTS,
  updateAppSettings,
} from '@/shared/lib/settings'
import type { AppSettings } from '@/shared/types'

/**
 * Discriminated union result type for setting mutations.
 */
export type SettingMutationResult =
  | { success: true }
  | { success: false; error: string }

export interface UseAppSettingsReturn {
  /** Current settings, null while loading */
  settings: AppSettings | null
  /** True during initial load */
  isLoading: boolean
  /** Update a single setting by key. Saves immediately. */
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<SettingMutationResult>
  /** Reset a single setting to its default (removes from storage). */
  resetSetting: <K extends keyof AppSettings>(
    key: K,
  ) => Promise<SettingMutationResult>
}

/**
 * Module-level cache shared across all hook instances.
 * Avoids redundant disk reads when multiple components use settings.
 */
let cachedSettings: AppSettings | null = null
let loadPromise: Promise<AppSettings> | null = null

/**
 * Subscribers: components register a callback to be notified when
 * settings change (so all hook instances stay in sync).
 */
const subscribers = new Set<(settings: AppSettings) => void>()

function notifySubscribers(settings: AppSettings): void {
  for (const callback of subscribers) {
    callback(settings)
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

const NON_RESETTABLE_KEYS: ReadonlySet<keyof AppSettings> = new Set([
  'recentProjects',
])

export function useAppSettings(): UseAppSettingsReturn {
  const [settings, setSettings] = useState<AppSettings | null>(cachedSettings)
  const [isLoading, setIsLoading] = useState(cachedSettings === null)

  // Subscribe to cache updates from other hook instances
  useEffect(() => {
    const handleUpdate = (newSettings: AppSettings): void => {
      setSettings(newSettings)
    }
    subscribers.add(handleUpdate)
    return () => {
      subscribers.delete(handleUpdate)
    }
  }, [])

  // Load settings on first mount (shared across instances)
  useEffect(() => {
    let isActive = true

    if (cachedSettings !== null) {
      setSettings(cachedSettings)
      setIsLoading(false)
      return
    }

    if (loadPromise === null) {
      loadPromise = loadAppSettings()
    }

    void loadPromise
      .then((loaded) => {
        cachedSettings = loaded
        if (!isActive) {
          return
        }
        setSettings(loaded)
        notifySubscribers(loaded)
      })
      .catch((error: unknown) => {
        const fallbackSettings = getDefaultAppSettings()
        cachedSettings = fallbackSettings

        toast.error('Failed to load settings', {
          description: toErrorMessage(error),
        })

        if (!isActive) {
          return
        }

        setSettings(fallbackSettings)
        notifySubscribers(fallbackSettings)
      })
      .finally(() => {
        loadPromise = null
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(
      key: K,
      value: AppSettings[K],
    ): Promise<SettingMutationResult> => {
      if (cachedSettings === null) {
        return { success: false, error: 'Settings are still loading' }
      }

      try {
        const updated = await updateAppSettings((current) => {
          return { ...current, [key]: value } as AppSettings
        })
        cachedSettings = updated
        notifySubscribers(updated)
        return { success: true }
      } catch (error) {
        const errorResult: SettingMutationResult = {
          success: false,
          error: toErrorMessage(error),
        }
        toast.error('Failed to save setting', {
          description: errorResult.error,
        })
        return errorResult
      }
    },
    [],
  )

  const resetSetting = useCallback(
    async <K extends keyof AppSettings>(
      key: K,
    ): Promise<SettingMutationResult> => {
      if (cachedSettings === null) {
        return { success: false, error: 'Settings are still loading' }
      }

      if (NON_RESETTABLE_KEYS.has(key)) {
        return {
          success: false,
          error: `Cannot reset required setting: ${String(key)}`,
        }
      }

      try {
        const updated = await updateAppSettings((current) => {
          const next: AppSettings = { ...current }

          switch (key) {
            case 'theme':
              next.theme = SETTING_DEFAULTS.theme
              break
            case 'autoSaveDelay':
              next.autoSaveDelay = SETTING_DEFAULTS.autoSaveDelay
              break
            case 'showGrid':
              next.showGrid = SETTING_DEFAULTS.showGrid
              break
            case 'snapToGrid':
              next.snapToGrid = SETTING_DEFAULTS.snapToGrid
              break
            case 'gridSpacing':
              next.gridSpacing = SETTING_DEFAULTS.gridSpacing
              break
            case 'showMinimap':
              next.showMinimap = SETTING_DEFAULTS.showMinimap
              break
            case 'confirmNodeDeletion':
              next.confirmNodeDeletion = SETTING_DEFAULTS.confirmNodeDeletion
              break
            default:
              delete (next as Partial<AppSettings>)[key]
          }

          return next
        })

        cachedSettings = updated
        notifySubscribers(updated)
        return { success: true }
      } catch (error) {
        const errorResult: SettingMutationResult = {
          success: false,
          error: toErrorMessage(error),
        }
        toast.error('Failed to reset setting', {
          description: errorResult.error,
        })
        return errorResult
      }
    },
    [],
  )

  return { settings, isLoading, updateSetting, resetSetting }
}

/**
 * Pre-warm the settings cache from outside React.
 * Call this before React renders (e.g., in main.tsx) to ensure
 * the hook's module-level cache is populated, eliminating the
 * loading state on first mount.
 *
 * Safe to call multiple times — deduplicates with in-flight loads.
 * Catches internally — never throws an unhandled rejection.
 */
export function preloadSettings(): void {
  if (cachedSettings !== null) {
    return
  }

  if (loadPromise === null) {
    loadPromise = loadAppSettings()
  }

  void loadPromise
    .then((loaded) => {
      cachedSettings = loaded
      notifySubscribers(loaded)
    })
    .catch((error: unknown) => {
      const fallbackSettings = getDefaultAppSettings()
      cachedSettings = fallbackSettings
      // Don't show a toast here — we're outside React.
      // The hook will handle error display if needed.
      if (import.meta.env.DEV) {
        console.warn('Failed to pre-load settings:', error)
      }
    })
    .finally(() => {
      loadPromise = null
    })
}
