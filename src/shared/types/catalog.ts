// Unified Action & Function Catalog Types
// Consolidates discovery of all executable capabilities (core Neovim commands, key sequences, plugin functions, and plugin commands)

import type { PortDataType } from './graph'
import type { SchemaExCommandParamEmit } from './schema'

// ============================================
// Catalog Categories (Capability-Based)
// ============================================

export type CatalogCategory =
  | 'files'
  | 'editing'
  | 'navigation'
  | 'search'
  | 'copy-paste'
  | 'layout'
  | 'folding'
  | 'lsp'
  | 'git'
  | 'packages'
  | 'terminal'
  | 'help'
  | 'uncategorized' // Default for items without explicit category

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  files: 'Files',
  editing: 'Editing',
  navigation: 'Navigation',
  search: 'Search',
  'copy-paste': 'Copy & Paste',
  layout: 'Layout',
  folding: 'Folding',
  lsp: 'LSP',
  git: 'Git',
  packages: 'Packages',
  terminal: 'Terminal',
  help: 'Help',
  uncategorized: 'Other',
}

export const CATALOG_CATEGORY_ICONS: Record<CatalogCategory, string> = {
  files: 'File',
  editing: 'Edit3',
  navigation: 'Compass',
  search: 'Search',
  'copy-paste': 'Clipboard',
  layout: 'Layout',
  folding: 'ChevronsDownUp',
  lsp: 'Lightbulb',
  git: 'GitBranch',
  packages: 'Package',
  terminal: 'Terminal',
  help: 'HelpCircle',
  uncategorized: 'MoreHorizontal',
}

// Display order in sidebar
export const CATALOG_CATEGORIES: readonly CatalogCategory[] = [
  'files',
  'editing',
  'navigation',
  'search',
  'copy-paste',
  'layout',
  'folding',
  'lsp',
  'git',
  'packages',
  'terminal',
  'help',
  'uncategorized', // Always last
] as const

// ============================================
// Category Normalization
// ============================================

/**
 * Set of valid catalog categories for O(1) lookup
 */
const VALID_CATALOG_CATEGORIES = new Set<string>(CATALOG_CATEGORIES)

/**
 * Normalize a category value to a valid CatalogCategory.
 * Returns 'uncategorized' for invalid/unknown values.
 * Logs a warning in dev mode for invalid values.
 */
export function normalizeCatalogCategory(
  value: unknown,
  context?: string,
): CatalogCategory {
  // Handle undefined/null
  if (value === undefined || value === null) {
    return 'uncategorized'
  }

  // Must be a string
  if (typeof value !== 'string') {
    if (import.meta.env.DEV) {
      console.warn(
        `[Catalog] Invalid category type: expected string, got ${typeof value}${context ? ` (${context})` : ''}`,
      )
    }
    return 'uncategorized'
  }

  // Check if valid
  if (VALID_CATALOG_CATEGORIES.has(value)) {
    return value as CatalogCategory
  }

  // Invalid string value
  if (import.meta.env.DEV) {
    console.warn(
      `[Catalog] Unknown category "${value}"${context ? ` (${context})` : ''}, using 'uncategorized'`,
    )
  }
  return 'uncategorized'
}

/**
 * Type guard to check if a value is a valid CatalogCategory
 */
export function isValidCatalogCategory(
  value: unknown,
): value is CatalogCategory {
  return typeof value === 'string' && VALID_CATALOG_CATEGORIES.has(value)
}

// ============================================
// Catalog Source (Core vs Plugin)
// ============================================

export type CatalogSource =
  | { readonly sourceType: 'core' }
  | {
      readonly sourceType: 'plugin'
      readonly pluginId: string
      readonly pluginName: string
    }

// ============================================
// Catalog Entry Parameters
// ============================================

/** Parameter for commands/keys (template placeholders) */
export interface CatalogCommandParam {
  readonly name: string
  readonly type:
    | 'string'
    | 'number'
    | 'character'
    | 'file-path'
    | 'directory-path'
    | 'boolean'
    | 'select'
  readonly required: boolean
  readonly label: string
  readonly placeholder: string
  readonly description: string
  readonly default?: string
  readonly allowedValues?: readonly string[]
  readonly allowedValueDescriptions?: Readonly<Record<string, string>>
  readonly tier?: 'basic' | 'advanced'
  readonly group?: string
  readonly escape?: 'ex-argument'
  readonly emit?: SchemaExCommandParamEmit
}

/** Parameter for functions (typed ports) */
export interface CatalogFunctionParam {
  readonly name: string
  readonly type: PortDataType
  readonly required: boolean
  readonly default?: unknown
  readonly description?: string
}

// ============================================
// Catalog Entry (Discriminated Union)
// ============================================

/** Shared fields for all catalog entry types */
interface CatalogEntryBase {
  /** Unique key: "core:write" or "telescope:find_files" */
  readonly key: string
  readonly source: CatalogSource

  // Display
  readonly label: string // "Save File", "Find Files"
  readonly shortDescription: string // One-liner
  readonly category: CatalogCategory
  readonly isPopular: boolean
  readonly aliases: readonly string[] // Search aliases

  // Documentation (optional)
  readonly whatItDoes?: string // Detailed explanation
  readonly example?: string
  readonly technicalNote?: string
  readonly sourceDoc?: string // URL to docs
}

/** Discriminated union for catalog entries - single discriminator */
export type CatalogEntry =
  | (CatalogEntryBase & {
      readonly type: 'command'
      readonly template: string
      readonly params: readonly CatalogCommandParam[]
    })
  | (CatalogEntryBase & {
      readonly type: 'keys'
      readonly template: string
      readonly params: readonly CatalogCommandParam[]
    })
  | (CatalogEntryBase & {
      readonly type: 'function'
      readonly pluginId: string
      readonly functionName: string
      readonly params: readonly CatalogFunctionParam[]
      readonly returns?: PortDataType
      readonly relatedCommand?: string // For "Also available as command" UI
    })

export type CatalogActionEntry = Extract<
  CatalogEntry,
  { type: 'command' | 'keys' }
>

export function isCatalogActionEntry(
  entry: CatalogEntry,
): entry is CatalogActionEntry {
  return entry.type === 'command' || entry.type === 'keys'
}

// ============================================
// Type Guards
// ============================================

export function isCommandEntry(
  entry: CatalogEntry,
): entry is CatalogEntry & { type: 'command' } {
  return entry.type === 'command'
}

export function isKeysEntry(
  entry: CatalogEntry,
): entry is CatalogEntry & { type: 'keys' } {
  return entry.type === 'keys'
}

export function isFunctionEntry(
  entry: CatalogEntry,
): entry is CatalogEntry & { type: 'function' } {
  return entry.type === 'function'
}
