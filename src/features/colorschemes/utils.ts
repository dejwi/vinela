import { catalog } from '@/colorschemes'
import {
  type ColorSchemeCatalogEntry,
  getThemePluginSchemaId,
  isThemeSchemaId,
} from '@/shared/types'

export { getThemePluginSchemaId, isThemeSchemaId }

/**
 * Resolve schema ID for a theme plugin repository.
 * Returns canonical built-in IDs for known repos; otherwise falls back
 * to the legacy filesystem-safe `theme--<repo>` format.
 *
 * Examples:
 * - 'https://github.com/folke/tokyonight.nvim' → 'tokyonight'
 * - 'https://github.com/example/custom-theme.nvim' → 'theme--custom-theme.nvim'
 *
 * @param pluginRepo - Full GitHub repository URL
 * @returns Canonical built-in ID or legacy `theme--<repo>` ID
 */
/**
 * Group catalog entries by their underlying plugin.
 * Multiple variants of the same theme (e.g., tokyonight-storm, tokyonight-night)
 * will be grouped together under the same plugin ID.
 *
 * @param catalog - Array of color scheme catalog entries
 * @returns Map of plugin schema ID to array of catalog entries
 */
export function groupCatalogByPlugin(
  catalog: ColorSchemeCatalogEntry[],
): Map<string, ColorSchemeCatalogEntry[]> {
  const groups = new Map<string, ColorSchemeCatalogEntry[]>()

  for (const entry of catalog) {
    const pluginId = getThemePluginSchemaId(entry.pluginRepo)
    const existing = groups.get(pluginId)

    if (existing) {
      existing.push(entry)
    } else {
      groups.set(pluginId, [entry])
    }
  }

  return groups
}

/**
 * Find a catalog entry by its ID.
 *
 * @param catalogEntryId - Catalog entry ID to find
 * @returns The catalog entry or undefined if not found
 */
export function findCatalogEntry(
  catalogEntryId: string,
): ColorSchemeCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === catalogEntryId)
}

/**
 * Find a catalog entry by its plugin repo URL.
 * Returns the first variant found for that plugin.
 *
 * @param pluginRepo - Plugin repository URL
 * @returns The first matching catalog entry or undefined
 */
export function findCatalogEntryByRepo(
  pluginRepo: string,
): ColorSchemeCatalogEntry | undefined {
  return catalog.find((entry) => entry.pluginRepo === pluginRepo)
}

/**
 * Get all catalog entries for a given plugin schema ID.
 *
 * @param pluginSchemaId - Plugin schema ID
 * @returns Array of catalog entries for that plugin
 */
export function getCatalogEntriesByPluginId(
  pluginSchemaId: string,
): ColorSchemeCatalogEntry[] {
  return catalog.filter(
    (entry) => getThemePluginSchemaId(entry.pluginRepo) === pluginSchemaId,
  )
}

/**
 * Extract the repository name from a GitHub URL.
 *
 * @param pluginRepo - Full GitHub repository URL
 * @returns Repository name (e.g., 'tokyonight.nvim')
 */
export function extractRepoName(pluginRepo: string): string {
  const match = /github\.com\/[^/]+\/([^/]+?)(?:\.git)?$/.exec(pluginRepo)
  return match?.[1] ?? pluginRepo.replace(/[^a-zA-Z0-9.-]/g, '-')
}

/**
 * Get a display name for a theme plugin from its schema ID.
 *
 * @param pluginSchemaId - Theme plugin schema ID
 * @returns Human-readable name
 */
export function getThemeDisplayName(pluginSchemaId: string): string {
  if (!isThemeSchemaId(pluginSchemaId)) {
    return pluginSchemaId
  }

  const baseId = pluginSchemaId.startsWith('theme--')
    ? pluginSchemaId.slice('theme--'.length)
    : pluginSchemaId

  return baseId.replace(/\.nvim$/, '').replace(/-/g, ' ')
}
