import type {
  AvailablePluginDisplayInfo,
  PluginCategory,
  PluginDisplayInfo,
} from '@/shared/types'
import { isAvailablePlugin } from '@/shared/types'
import { resolvePluginMetadata } from './format-utils'

// ============================================
// Sort Option Types
// ============================================

/**
 * Sort options for the Installed tab.
 * 'recently-added' uses InstalledPlugin.addedAt (only available for installed plugins).
 */
export type InstalledSortOption = 'name-asc' | 'recently-added'

/**
 * Sort options for the Browse tab.
 * 'stars-desc' uses PluginSchema.stars (undefined treated as 0).
 */
export type BrowseSortOption = 'stars-desc' | 'name-asc'

// ============================================
// Search Logic
// ============================================

/**
 * Returns true if the plugin matches the search query.
 *
 * Matches against (all case-insensitive):
 *   - schema.pluginName
 *   - schema.description
 *   - schema.tagline
 *   - schema.tags (any tag)
 *
 * Empty query always returns true.
 */
export function matchesSearch(
  plugin: PluginDisplayInfo,
  query: string,
): boolean {
  if (query === '') return true

  const q = query.toLowerCase()
  if (plugin.status === 'orphaned') {
    return plugin.schemaId.toLowerCase().includes(q)
  }

  const { schema } = plugin
  const repositoryMetadata = resolvePluginMetadata(schema, plugin.source)

  if (schema.pluginName.toLowerCase().includes(q)) return true
  if (schema.description?.toLowerCase().includes(q) === true) return true
  if (schema.tagline?.toLowerCase().includes(q) === true) return true
  if (schema.tags?.some((tag) => tag.toLowerCase().includes(q)) === true)
    return true
  if (repositoryMetadata.author?.toLowerCase().includes(q) === true) return true
  if (repositoryMetadata.owner?.toLowerCase().includes(q) === true) return true
  if (repositoryMetadata.repoSlug?.toLowerCase().includes(q) === true)
    return true

  return false
}

// ============================================
// Sort Logic — Installed Tab
// ============================================

/**
 * Sort installed plugins by the given option.
 *
 * Sort contracts:
 *   'name-asc':       alphabetical by pluginName (case-insensitive). Names are
 *                     unique so no tie-breaker is needed.
 *   'recently-added': primary = installed.addedAt DESC (newest first),
 *                     tie-breaker = pluginName ASC.
 *
 * Returns a new array (does not mutate input).
 */
export function sortInstalled(
  plugins: PluginDisplayInfo[],
  option: InstalledSortOption,
): PluginDisplayInfo[] {
  return [...plugins].sort((a, b) => {
    const nameA = a.status === 'orphaned' ? a.schemaId : a.schema.pluginName
    const nameB = b.status === 'orphaned' ? b.schemaId : b.schema.pluginName

    if (option === 'name-asc') {
      return nameA.toLowerCase().localeCompare(nameB.toLowerCase())
    }

    // 'recently-added': primary = addedAt DESC, tie-breaker = name ASC
    const addedAtA =
      a.status === 'installed' || a.status === 'orphaned'
        ? a.installed.addedAt
        : 0
    const addedAtB =
      b.status === 'installed' || b.status === 'orphaned'
        ? b.installed.addedAt
        : 0
    const timeDiff = addedAtB - addedAtA
    if (timeDiff !== 0) return timeDiff

    return nameA.toLowerCase().localeCompare(nameB.toLowerCase())
  })
}

/**
 * Sort installed plugins by the given option, grouping orphaned plugins at the bottom.
 *
 * Sort contracts:
 *   - Orphaned plugins are always grouped at the end, regardless of sort option
 *   - Within each group (healthy, orphaned), plugins are sorted by the given option
 *
 * Returns a new array (does not mutate input).
 */
export function sortInstalledWithGrouping(
  plugins: PluginDisplayInfo[],
  option: InstalledSortOption,
): PluginDisplayInfo[] {
  // Separate orphaned from healthy
  const healthy: PluginDisplayInfo[] = []
  const orphaned: PluginDisplayInfo[] = []

  for (const plugin of plugins) {
    if (plugin.status === 'orphaned') {
      orphaned.push(plugin)
    } else {
      healthy.push(plugin)
    }
  }

  // Sort each group
  const sortedHealthy = sortInstalled(healthy, option)
  const sortedOrphaned = sortInstalled(orphaned, option)

  // Concatenate: healthy first, then orphaned
  return [...sortedHealthy, ...sortedOrphaned]
}

// ============================================
// Browse Eligibility
// ============================================

/**
 * Return only plugins available to install in the Browse tab.
 */
export function filterBrowseEligible(
  plugins: readonly PluginDisplayInfo[],
): AvailablePluginDisplayInfo[] {
  return plugins.filter(isAvailablePlugin)
}

// ============================================
// Category Filter Logic
// ============================================

/**
 * Filter plugins by category.
 *
 * If `selectedCategory` is null, all plugins are returned.
 * Otherwise, only plugins whose `schema.category` matches are returned.
 *
 * Returns a new array (does not mutate input).
 */
export function filterByCategory<
  T extends Exclude<PluginDisplayInfo, { status: 'orphaned' }>,
>(plugins: readonly T[], selectedCategory: PluginCategory | null): T[] {
  if (selectedCategory === null) return [...plugins]
  return plugins.filter((p) => p.schema.category === selectedCategory)
}

/**
 * Compute the count of plugins per category from a list.
 * Categories with zero plugins are not included in the result.
 */
export function computeCategoryCounts(
  plugins: PluginDisplayInfo[],
): Partial<Record<PluginCategory, number>> {
  const counts: Partial<Record<PluginCategory, number>> = {}
  for (const plugin of plugins) {
    if (plugin.status === 'orphaned') continue
    const { category } = plugin.schema
    if (category !== undefined) {
      counts[category] = (counts[category] ?? 0) + 1
    }
  }
  return counts
}

// ============================================
// Sort Logic — Browse Tab
// ============================================

/**
 * Sort browse plugins by the given option.
 *
 * Sort contracts:
 *   'stars-desc': primary = schema.stars DESC (undefined treated as 0),
 *                 tie-breaker = pluginName ASC.
 *   'name-asc':   alphabetical by pluginName (case-insensitive). Names are
 *                 unique so no tie-breaker is needed.
 *
 * Returns a new array (does not mutate input).
 */
export function sortBrowse<
  T extends Exclude<PluginDisplayInfo, { status: 'orphaned' }>,
>(plugins: readonly T[], option: BrowseSortOption): T[] {
  return [...plugins].sort((a, b) => {
    const nameA = a.schema.pluginName
    const nameB = b.schema.pluginName

    if (option === 'name-asc') {
      return nameA.toLowerCase().localeCompare(nameB.toLowerCase())
    }

    // 'stars-desc': primary = stars DESC, tie-breaker = name ASC
    const starsA = resolvePluginMetadata(a.schema, a.source).stars
    const starsB = resolvePluginMetadata(b.schema, b.source).stars

    if (starsA === undefined && starsB !== undefined) return 1
    if (starsA !== undefined && starsB === undefined) return -1

    const starsDiff = (starsB ?? 0) - (starsA ?? 0)
    if (starsDiff !== 0) return starsDiff

    return nameA.toLowerCase().localeCompare(nameB.toLowerCase())
  })
}
