import { getRepositoryMetadata } from '@/metadata'
import { parseRepositoryRef } from '@/shared/lib/repository-ref'
import type {
  PluginSchema,
  RepositoryAuthorSource,
  SchemaOption,
  SchemaSource,
} from '@/shared/types'

export interface GroupTreeNode {
  id: string
  label: string
  count: number
  hasOwnOptions: boolean
  children: GroupTreeNode[]
}

export interface ResolvedPluginMetadata {
  readonly repoSlug?: string | undefined
  readonly repoUrl: string
  readonly owner?: string | undefined
  readonly author?: string | undefined
  readonly authorSource?: RepositoryAuthorSource | undefined
  readonly stars?: number | undefined
  readonly createdAt?: string | undefined
  readonly pushedAt?: string | undefined
  readonly fetchedAt?: string | undefined
  readonly metadataSource: 'snapshot' | 'schema' | 'none'
}

// ============================================
// Star Count Formatting
// ============================================

/**
 * Format a star count with a "k" suffix for thousands.
 *
 * Examples:
 *   undefined → null
 *   0         → "0"
 *   999       → "999"
 *   1000      → "1.0k"
 *   1500      → "1.5k"
 *   16400     → "16.4k"
 *   1000000   → "1000.0k"
 */
export function formatStars(stars: number | undefined): string | null {
  if (stars === undefined) return null
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`
  return String(stars)
}

// ============================================
// Author Extraction
// ============================================

/**
 * Resolve plugin metadata for UI display.
 *
 * Priority:
 *   1. bundled repository snapshot metadata
 *   2. schema-authored fallback for non-built-in schemas only
 *   3. no metadata fallback for built-in schemas
 */
export function resolvePluginMetadata(
  schema: PluginSchema,
  source: SchemaSource,
): ResolvedPluginMetadata {
  const snapshotEntry = getRepositoryMetadata(schema.pluginRepo)
  if (snapshotEntry !== undefined) {
    return {
      repoSlug: snapshotEntry.repoSlug,
      repoUrl: snapshotEntry.repoUrl,
      owner: snapshotEntry.owner,
      author: snapshotEntry.author,
      authorSource: snapshotEntry.authorSource,
      stars: snapshotEntry.stars,
      createdAt: snapshotEntry.createdAt,
      pushedAt: snapshotEntry.pushedAt,
      fetchedAt: snapshotEntry.fetchedAt,
      metadataSource: 'snapshot',
    }
  }

  const parsed = parseRepositoryRef(schema.pluginRepo)
  const repoSlug = parsed.success ? parsed.repoSlug : undefined
  const repoUrl = parsed.success ? parsed.repoUrl : schema.pluginRepo

  if (source !== 'builtin') {
    return {
      repoSlug,
      repoUrl,
      author: schema.author,
      stars: schema.stars,
      metadataSource:
        schema.author !== undefined || schema.stars !== undefined
          ? 'schema'
          : 'none',
    }
  }

  return {
    repoSlug,
    repoUrl,
    metadataSource: 'none',
  }
}

export function getAuthorName(
  schema: PluginSchema,
  source: SchemaSource,
): string | undefined {
  return resolvePluginMetadata(schema, source).author
}

export function getResolvedStars(
  schema: PluginSchema,
  source: SchemaSource,
): number | undefined {
  return resolvePluginMetadata(schema, source).stars
}

// ============================================
// Tagline / Description
// ============================================

/**
 * Get the display text for a plugin.
 * Prefers tagline, falls back to description.
 * Returns undefined when neither exists.
 */
export function getTagline(schema: PluginSchema): string | undefined {
  return schema.tagline ?? schema.description
}

// ============================================
// Option Grouping
// ============================================

/**
 * Group schema options by their `group` field.
 * Options without a group are placed under 'General'.
 * Preserves insertion order within each group.
 *
 * This centralizes logic previously duplicated in
 * PluginConfigPanel.tsx and PluginPreviewPanel.tsx.
 */
export function groupOptionsByGroup(
  options: SchemaOption[],
): Map<string, SchemaOption[]> {
  const groups = new Map<string, SchemaOption[]>()
  for (const opt of options) {
    const group = opt.group ?? 'General'
    const existing = groups.get(group)
    if (existing !== undefined) {
      existing.push(opt)
    } else {
      groups.set(group, [opt])
    }
  }
  return groups
}

function sortNodes(nodes: GroupTreeNode[]): GroupTreeNode[] {
  return [...nodes].sort((a, b) => a.label.localeCompare(b.label))
}

export function buildGroupTree(options: SchemaOption[]): GroupTreeNode[] {
  const grouped = groupOptionsByGroup(options)
  const roots = new Map<string, GroupTreeNode>()

  for (const [groupName, groupOptions] of grouped.entries()) {
    const segments = groupName.split(' / ')
    const parentSegment = segments[0] ?? 'General'
    const parent = roots.get(parentSegment) ?? {
      id: parentSegment,
      label: parentSegment,
      count: 0,
      hasOwnOptions: false,
      children: [],
    }

    if (segments.length === 1) {
      parent.hasOwnOptions = true
      parent.count += groupOptions.length
      roots.set(parentSegment, parent)
      continue
    }

    const childLabel = segments.slice(1).join(' / ')
    parent.children.push({
      id: groupName,
      label: childLabel,
      count: groupOptions.length,
      hasOwnOptions: true,
      children: [],
    })
    parent.count += groupOptions.length
    roots.set(parentSegment, parent)
  }

  return sortNodes(
    Array.from(roots.values()).map((root) => ({
      ...root,
      children: sortNodes(root.children),
    })),
  )
}
