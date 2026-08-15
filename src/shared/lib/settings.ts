import { PROJECT_BACKUP_DIR_NAME } from '@/shared/lib/app-identity'
import { APP_PATHS } from '@/shared/lib/paths'
import {
  appFileExists,
  folderExists,
  readAppFile,
  writeAppFile,
} from '@/shared/lib/storage-api'
import type { AppSettings, RecentProject } from '@/shared/types'

/**
 * Default values for settings that have defaults.
 * Used by getSettingWithDefault() to provide fallback values.
 */
export const SETTING_DEFAULTS = {
  theme: 'system' as const,
  autoSaveDelay: 1000,
  showGrid: true,
  snapToGrid: false,
  gridSpacing: 20,
  showMinimap: true,
  confirmNodeDeletion: true,
} satisfies Partial<AppSettings>

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  recentProjects: [],
  neovimOutputPath: undefined,
}

const MAX_RECENT_PROJECTS = 5

let settingsUpdateQueue: Promise<void> = Promise.resolve()

type RuntimePlatform = 'windows' | 'macos' | 'linux' | 'unknown'

interface RecentProjectsValidationResult {
  validProjects: RecentProject[]
  invalidPaths: Set<string>
}

function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    recentProjects: settings.recentProjects.map((project) => ({ ...project })),
  }
}

function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    theme: settings.theme ?? DEFAULT_SETTINGS.theme,
    recentProjects: Array.isArray(settings.recentProjects)
      ? settings.recentProjects.map((project) => ({ ...project }))
      : [],
    neovimOutputPath: settings.neovimOutputPath,
    autoSaveDelay: settings.autoSaveDelay,
    showGrid: settings.showGrid,
    snapToGrid: settings.snapToGrid,
    gridSpacing: settings.gridSpacing,
    showMinimap: settings.showMinimap,
    confirmNodeDeletion: settings.confirmNodeDeletion,
    tutorialProgress: settings.tutorialProgress,
  }
}

function enqueueSettingsUpdate<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = settingsUpdateQueue.then(operation, operation)
  settingsUpdateQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  )
  return queuedOperation
}

function detectRuntimePlatform(): RuntimePlatform {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }

  const platformHint = [
    navigator.userAgent,
    navigator.platform,
    navigatorWithUserAgentData.userAgentData?.platform,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  if (platformHint.includes('win')) {
    return 'windows'
  }
  if (platformHint.includes('mac')) {
    return 'macos'
  }
  if (platformHint.includes('linux') || platformHint.includes('x11')) {
    return 'linux'
  }

  return 'unknown'
}

function getDefaultSettings(): AppSettings {
  return cloneSettings(DEFAULT_SETTINGS)
}

async function readSettingsFromDisk(): Promise<AppSettings> {
  const exists = await appFileExists(APP_PATHS.SETTINGS)
  if (!exists) {
    return getDefaultSettings()
  }

  try {
    const settings = await readAppFile<Partial<AppSettings>>(APP_PATHS.SETTINGS)
    return normalizeSettings(settings)
  } catch {
    return getDefaultSettings()
  }
}

/**
 * Get a setting value with its default fallback.
 * Returns the stored value if set, otherwise the default.
 */
export function getSettingWithDefault<K extends keyof typeof SETTING_DEFAULTS>(
  settings: AppSettings,
  key: K,
): (typeof SETTING_DEFAULTS)[K] {
  const value = settings[key] as (typeof SETTING_DEFAULTS)[K] | undefined
  return value !== undefined ? value : SETTING_DEFAULTS[key]
}

/**
 * Get a fresh copy of default app settings.
 */
export function getDefaultAppSettings(): AppSettings {
  return getDefaultSettings()
}

/**
 * Get the default Neovim output path for the current platform.
 */
export function getDefaultNeovimOutputPath(): string {
  const platform = detectRuntimePlatform()
  if (platform === 'windows') {
    return '%LOCALAPPDATA%\\nvim\\init.lua'
  }
  return '~/.config/nvim/init.lua'
}

/**
 * Load app settings from AppData.
 */
export async function loadAppSettings(): Promise<AppSettings> {
  const settings = await readSettingsFromDisk()
  const { validProjects, invalidPaths } = await filterValidProjects(
    settings.recentProjects,
  )

  if (invalidPaths.size === 0) {
    return settings
  }

  void updateAppSettings((currentSettings) => ({
    ...currentSettings,
    recentProjects: currentSettings.recentProjects.filter(
      (project) => !invalidPaths.has(project.absolutePath),
    ),
  })).catch(console.warn)

  return {
    ...settings,
    recentProjects: validProjects,
  }
}

/**
 * Filter out projects whose folders no longer exist.
 */
async function filterValidProjects(
  projects: RecentProject[],
): Promise<RecentProjectsValidationResult> {
  const results = await Promise.all(
    projects.map(async (project) => {
      const exists = await folderExists(project.absolutePath)
      return exists ? project : null
    }),
  )
  const validProjects = results.filter((project): project is RecentProject => {
    return project !== null
  })

  const validPaths = new Set(
    validProjects.map((project) => project.absolutePath),
  )
  const invalidPaths = new Set(
    projects
      .filter((project) => !validPaths.has(project.absolutePath))
      .map((project) => project.absolutePath),
  )

  return { validProjects, invalidPaths }
}

/**
 * Save app settings to AppData.
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await updateAppSettings(() => cloneSettings(settings))
}

/**
 * Atomically update app settings with serialized read-modify-write.
 */
export async function updateAppSettings(
  updater: (current: AppSettings) => AppSettings,
): Promise<AppSettings> {
  return enqueueSettingsUpdate(async () => {
    const currentSettings = await readSettingsFromDisk()
    const updatedSettings = normalizeSettings(
      updater(cloneSettings(currentSettings)),
    )
    await writeAppFile(APP_PATHS.SETTINGS, updatedSettings)
    return cloneSettings(updatedSettings)
  })
}

/**
 * Add or update a project in the recent projects list.
 */
export async function addRecentProject(
  absolutePath: string,
  name: string,
): Promise<void> {
  await updateAppSettings((settings) => {
    const recentProjects = settings.recentProjects.filter(
      (project) => project.absolutePath !== absolutePath,
    )

    recentProjects.unshift({
      absolutePath,
      name,
      lastOpenedAt: Date.now(),
    })

    return {
      ...settings,
      recentProjects: recentProjects.slice(0, MAX_RECENT_PROJECTS),
    }
  })
}

/**
 * Remove a project from the recent projects list.
 */
export async function removeRecentProject(absolutePath: string): Promise<void> {
  await updateAppSettings((settings) => ({
    ...settings,
    recentProjects: settings.recentProjects.filter(
      (project) => project.absolutePath !== absolutePath,
    ),
  }))
}

/**
 * Restore a recent project entry (for undo functionality).
 * Preserves the entry's original timestamp and position intent.
 */
export async function restoreRecentProject(
  project: RecentProject,
): Promise<void> {
  await updateAppSettings((settings) => {
    // Remove any existing entry with the same path
    const filtered = settings.recentProjects.filter(
      (p) => p.absolutePath !== project.absolutePath,
    )

    // Insert at the beginning to restore visibility
    filtered.unshift(project)

    return {
      ...settings,
      recentProjects: filtered.slice(0, MAX_RECENT_PROJECTS),
    }
  })
}

/**
 * Update app theme.
 */
export async function updateTheme(
  theme: 'light' | 'dark' | 'system',
): Promise<void> {
  await updateAppSettings((settings) => ({
    ...settings,
    theme,
  }))
}

/**
 * Update Neovim output path.
 */
export async function updateNeovimOutputPath(
  path: string | undefined,
): Promise<void> {
  await updateAppSettings((settings) => ({
    ...settings,
    neovimOutputPath: path,
  }))
}

/**
 * Get the effective Neovim output path from settings or default.
 */
export function getEffectiveOutputPath(settings: AppSettings): string {
  return settings.neovimOutputPath ?? getDefaultNeovimOutputPath()
}

/**
 * Derive the backup folder path from an output path.
 * Example: ~/.config/nvim/init.lua -> ~/.config/nvim/.vinela-backups
 */
export function getBackupFolderPath(outputPath: string): string {
  const lastSlash = outputPath.lastIndexOf('/')
  const lastBackslash = outputPath.lastIndexOf('\\')
  const separatorIndex = Math.max(lastSlash, lastBackslash)

  if (separatorIndex === -1) {
    // No path separator - shouldn't happen with valid paths
    return PROJECT_BACKUP_DIR_NAME
  }

  const parent = outputPath.substring(0, separatorIndex)
  const separator = lastSlash > lastBackslash ? '/' : '\\'
  return `${parent}${separator}${PROJECT_BACKUP_DIR_NAME}`
}
