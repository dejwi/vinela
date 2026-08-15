/**
 * Generic catalog primitives shared by both action catalog and function catalog.
 * These types are domain-agnostic.
 */

/**
 * A category in any catalog. The key is a stable machine identifier;
 * the label is a human-readable display string that can change freely.
 */
export interface CatalogCategory {
  /** Stable machine key, e.g. "core:path" or "plugin:telescope.nvim:all" */
  readonly key: string
  /** Human-readable display label, e.g. "Path Functions" */
  readonly label: string
  /** Optional icon name (lucide icon string) */
  readonly icon?: string | undefined
}

/**
 * Base fields every catalog entry must have. Generic catalogs extend this.
 */
export interface CatalogEntryBase {
  /** Unique key identifying this entry across the catalog */
  readonly key: string
  /** The category key this entry belongs to */
  readonly categoryKey: string
  /** Human-readable label (display name) */
  readonly label: string
  /** One-line description */
  readonly shortDescription: string
}
