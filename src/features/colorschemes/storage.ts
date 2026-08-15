import { catalog } from '@/colorschemes'
import * as pluginStorage from '@/features/plugins/storage'
import {
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type {
  ColorSchemeCatalogEntry,
  PluginSchema,
  ProjectColorSchemesFile,
} from '@/shared/types'
import {
  extractRepoName,
  getThemePluginSchemaId,
  isThemeSchemaId,
} from './utils'

const COLORSCHEMES_FILE = 'colorschemes.json'

// ============================================
// Result Types (Discriminated Unions)
// ============================================

export type InstallResult =
  | { success: true; pluginSchemaId: string; wasAlreadyInstalled: boolean }
  | { success: false; error: string }

export type UninstallResult =
  | { success: true; pluginRemoved: boolean }
  | { success: false; error: string }

export type SetActiveResult =
  | { success: true }
  | { success: false; error: string }

/** Result type for loading color scheme preferences with explicit success/error branches */
export type LoadColorSchemePreferencesResult =
  | { success: true; data: ProjectColorSchemesFile; source: 'file' | 'default' }
  | { success: false; error: string }

// ============================================
// Validation Helpers
// ============================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Runtime validator for ProjectColorSchemesFile.
 * Returns true if the data conforms to the expected shape.
 */
function isValidColorSchemePreferences(
  data: unknown,
): data is ProjectColorSchemesFile {
  if (!isRecord(data)) return false

  const activeScheme = data['activeScheme']
  const variantPreferences = data['variantPreferences']

  // activeScheme must be string | null
  if (activeScheme !== null && typeof activeScheme !== 'string') {
    return false
  }

  // variantPreferences must be a plain object (not array/null)
  if (!isRecord(variantPreferences)) return false

  // Every value must be a string
  for (const value of Object.values(variantPreferences)) {
    if (typeof value !== 'string') return false
  }

  return true
}

// ============================================
// Catalog Loading
// ============================================

/**
 * Load the bundled color scheme catalog.
 */
export function loadCatalog(): ColorSchemeCatalogEntry[] {
  return catalog
}

// ============================================
// Preferences Loading/Saving
// ============================================

/**
 * Load project's colorscheme preferences (NOT installation state).
 * Installation state is derived from plugins.json.
 *
 * @param projectPath - Path to the project directory
 * @returns Discriminated union result with success/error branches
 */
export async function loadColorSchemePreferences(
  projectPath: string,
): Promise<LoadColorSchemePreferencesResult> {
  // Check file existence first (consistent with plugins, keymaps, neovim-options, lsp)
  const exists = await projectFileExists(projectPath, COLORSCHEMES_FILE)
  if (!exists) {
    return {
      success: true,
      data: { activeScheme: null, variantPreferences: {} },
      source: 'default',
    }
  }

  // File exists — any error here is a real problem
  try {
    const data = await readProjectFile<unknown>(projectPath, COLORSCHEMES_FILE)

    // Canonical format only - no migration
    if (isValidColorSchemePreferences(data)) {
      return { success: true, data, source: 'file' }
    }

    return {
      success: false,
      error:
        'Invalid colorschemes.json format: expected activeScheme (string | null) and variantPreferences (Record<string, string>)',
    }
  } catch (error) {
    // Actual read/parse error - return failure
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Save colorscheme preferences.
 *
 * @param projectPath - Path to the project directory
 * @param prefs - Preferences to save
 */
export async function saveColorSchemePreferences(
  projectPath: string,
  prefs: ProjectColorSchemesFile,
): Promise<void> {
  await writeProjectFile(projectPath, COLORSCHEMES_FILE, prefs)
}

// ============================================
// Theme Schema Management
// ============================================

/**
 * Create a plugin schema for a theme.
 * Uses filesystem-safe ID format with '--' delimiter.
 *
 * @param entry - Catalog entry for the theme
 * @returns Plugin schema for the theme
 */
function createThemePluginSchema(entry: ColorSchemeCatalogEntry): PluginSchema {
  const schemaId = getThemePluginSchemaId(entry.pluginRepo)
  const pluginName = extractRepoName(entry.pluginRepo)

  return {
    id: schemaId,
    pluginName,
    pluginRepo: entry.pluginRepo,
    version: '1.0.0',
    description: `Color scheme plugin: ${entry.name}`,
    options: [],
    functions: [],
  }
}

/**
 * Ensure theme schema exists in project.
 * Skips fallback creation when a built-in/global/project schema already exists.
 */
async function ensureThemeSchema(
  projectPath: string,
  entry: ColorSchemeCatalogEntry,
): Promise<void> {
  const schemaId = getThemePluginSchemaId(entry.pluginRepo)
  const resolvedSchemas = await pluginStorage.getResolvedSchemas(projectPath)
  const schemaExists = resolvedSchemas.some((schema) => schema.id === schemaId)
  if (schemaExists) {
    return
  }

  const schema = createThemePluginSchema(entry)
  await pluginStorage.saveProjectSchema(projectPath, schema)
}

// ============================================
// Installation State Derivation
// ============================================

/**
 * Derive installed color schemes from plugins.json.
 * This is the key function that eliminates dual source of truth.
 *
 * @param projectPath - Path to the project directory
 * @returns Set of installed catalog entry IDs
 */
export async function getInstalledColorSchemes(
  projectPath: string,
): Promise<Set<string>> {
  const { plugins: installedPlugins } =
    await pluginStorage.loadInstalledPlugins(projectPath)
  const prefsResult = await loadColorSchemePreferences(projectPath)

  // Throw on non-ENOENT failures to prevent silent corruption masking
  if (!prefsResult.success) {
    throw new Error(
      `Failed to load color scheme preferences: ${prefsResult.error}`,
    )
  }

  const prefs = prefsResult.data

  const installed = new Set<string>()

  // For each installed theme plugin, find which variant is preferred
  for (const plugin of installedPlugins) {
    if (isThemeSchemaId(plugin.schemaId)) {
      const preferredVariant = prefs.variantPreferences[plugin.schemaId]
      if (preferredVariant) {
        installed.add(preferredVariant)
      } else {
        // Plugin installed but no variant preference - find default
        const variants = catalog.filter(
          (e) => getThemePluginSchemaId(e.pluginRepo) === plugin.schemaId,
        )
        const firstVariant = variants[0]
        if (firstVariant) {
          // Use first variant as default
          installed.add(firstVariant.id)
        }
      }
    }
  }

  return installed
}

/**
 * Get the set of installed theme plugin schema IDs.
 *
 * @param projectPath - Path to the project directory
 * @returns Set of theme plugin schema IDs
 */
export async function getInstalledThemePluginIds(
  projectPath: string,
): Promise<Set<string>> {
  const { plugins: installedPlugins } =
    await pluginStorage.loadInstalledPlugins(projectPath)
  const themePluginIds = new Set<string>()

  for (const plugin of installedPlugins) {
    if (isThemeSchemaId(plugin.schemaId)) {
      themePluginIds.add(plugin.schemaId)
    }
  }

  return themePluginIds
}

// ============================================
// Install/Uninstall Operations
// ============================================

/**
 * Install a colorscheme (installs underlying plugin if needed).
 * Variants of the same plugin share one plugin installation.
 *
 * @param projectPath - Path to the project directory
 * @param catalogEntryId - Catalog entry ID to install
 * @param setActive - Whether to set this as the active scheme
 * @returns Result of the installation
 */
export async function installColorScheme(
  projectPath: string,
  catalogEntryId: string,
  setActive: boolean = true,
): Promise<InstallResult> {
  const entry = catalog.find((e) => e.id === catalogEntryId)
  if (!entry) {
    return { success: false, error: `Unknown colorscheme: ${catalogEntryId}` }
  }

  const pluginSchemaId = getThemePluginSchemaId(entry.pluginRepo)

  try {
    // Check if plugin already installed (another variant might have installed it)
    const { plugins: installedPlugins } =
      await pluginStorage.loadInstalledPlugins(projectPath)
    const wasAlreadyInstalled = installedPlugins.some(
      (p: { schemaId: string }) => p.schemaId === pluginSchemaId,
    )

    if (!wasAlreadyInstalled) {
      // Ensure theme schema exists
      await ensureThemeSchema(projectPath, entry)
      // Install the plugin
      await pluginStorage.installPlugin(projectPath, pluginSchemaId)
    }

    // Update preferences (atomic - single file write)
    const prefsResult = await loadColorSchemePreferences(projectPath)

    if (!prefsResult.success) {
      return {
        success: false,
        error: `Failed to load preferences: ${prefsResult.error}`,
      }
    }

    const prefs = prefsResult.data
    prefs.variantPreferences[pluginSchemaId] = catalogEntryId
    if (setActive) {
      prefs.activeScheme = catalogEntryId
    }
    await saveColorSchemePreferences(projectPath, prefs)

    return { success: true, pluginSchemaId, wasAlreadyInstalled }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Uninstall a colorscheme.
 * Only removes plugin if no other variants from same plugin are "active".
 *
 * @param projectPath - Path to the project directory
 * @param catalogEntryId - Catalog entry ID to uninstall
 * @returns Result of the uninstallation
 */
export async function uninstallColorScheme(
  projectPath: string,
  catalogEntryId: string,
): Promise<UninstallResult> {
  const entry = catalog.find((e) => e.id === catalogEntryId)
  if (!entry) {
    return { success: false, error: `Unknown colorscheme: ${catalogEntryId}` }
  }

  const pluginSchemaId = getThemePluginSchemaId(entry.pluginRepo)

  try {
    // Update preferences first
    const prefsResult = await loadColorSchemePreferences(projectPath)

    if (!prefsResult.success) {
      return {
        success: false,
        error: `Failed to load preferences: ${prefsResult.error}`,
      }
    }

    const prefs = prefsResult.data

    // Clear this variant preference
    const currentPreference = prefs.variantPreferences[pluginSchemaId]
    if (currentPreference === catalogEntryId) {
      delete prefs.variantPreferences[pluginSchemaId]
    }

    // Clear active if it was this one
    if (prefs.activeScheme === catalogEntryId) {
      // Find another installed theme to activate, or null
      const otherActive = Object.values(prefs.variantPreferences)[0] ?? null
      prefs.activeScheme = otherActive
    }

    await saveColorSchemePreferences(projectPath, prefs)

    // Check if any other variants from this plugin are still preferred
    const stillHasVariants = Object.keys(prefs.variantPreferences).includes(
      pluginSchemaId,
    )

    let pluginRemoved = false
    if (!stillHasVariants) {
      // Safe to remove the plugin
      await pluginStorage.uninstallPlugin(projectPath, pluginSchemaId)
      pluginRemoved = true
    }

    return { success: true, pluginRemoved }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ============================================
// Active Scheme Management
// ============================================

/**
 * Set the active colorscheme.
 *
 * @param projectPath - Path to the project directory
 * @param catalogEntryId - Catalog entry ID to set as active (null for default)
 * @returns Result of the operation
 */
export async function setActiveColorScheme(
  projectPath: string,
  catalogEntryId: string | null,
): Promise<SetActiveResult> {
  try {
    const prefsResult = await loadColorSchemePreferences(projectPath)

    if (!prefsResult.success) {
      return {
        success: false,
        error: `Failed to load preferences: ${prefsResult.error}`,
      }
    }

    const prefs = prefsResult.data

    if (catalogEntryId !== null) {
      // Verify this variant is "installed" (has a preference set)
      const entry = catalog.find((e) => e.id === catalogEntryId)
      if (!entry) {
        return {
          success: false,
          error: `Unknown colorscheme: ${catalogEntryId}`,
        }
      }

      const pluginSchemaId = getThemePluginSchemaId(entry.pluginRepo)
      const { plugins: installedPlugins } =
        await pluginStorage.loadInstalledPlugins(projectPath)
      const isInstalled = installedPlugins.some(
        (p: { schemaId: string }) => p.schemaId === pluginSchemaId,
      )

      if (!isInstalled) {
        return {
          success: false,
          error: `Colorscheme not installed: ${catalogEntryId}`,
        }
      }
    }

    prefs.activeScheme = catalogEntryId
    await saveColorSchemePreferences(projectPath, prefs)

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
