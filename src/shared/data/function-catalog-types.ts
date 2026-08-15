import type {
  PortDataType,
  RunFunctionDefaultValue,
  RunFunctionSource,
} from '@/shared/types'
import type { CatalogEntryBase } from './catalog-types'

// ============================================
// Function Catalog Category Keys
// ============================================

/**
 * Category key contract:
 * - Core Neovim:      "core:<slug>"           e.g. "core:path", "core:system"
 * - Plugin (all):     "plugin:<id>:all"        e.g. "plugin:telescope.nvim:all"
 * - Plugin (sub-cat): "plugin:<id>:cat:<slug>" e.g. "plugin:telescope.nvim:cat:pickers"
 */
export type FunctionCategoryKey = string

/**
 * Core category slug — stable identifiers for all core function categories.
 * Display labels live in CORE_CATEGORY_LABELS.
 */
export type CoreCategorySlug =
  | 'env' // Environment
  | 'path' // Paths & Files
  | 'feature' // Feature Detection
  | 'system' // System & Shell
  | 'ui' // User Interface
  | 'text' // Text Processing
  | 'register' // Registers
  | 'buffer' // Buffer Operations
  | 'window' // Window & Layout
  | 'lsp' // Language Server (LSP)
  | 'diagnostic' // Diagnostics
  | 'notify' // Notifications & Output
  | 'timing' // Scheduling & Timers
  | 'treesitter' // Treesitter
  | 'data' // Data & Tables

/**
 * SINGLE canonical ordering for all core categories.
 * The builder constructs CORE_CATEGORIES from this array ONLY.
 * Do NOT use Object.keys(CORE_CATEGORY_LABELS) for ordering.
 */
export const CORE_CATEGORY_ORDER = [
  'lsp', // LSP first (most popular for IDE users)
  'diagnostic', // Diagnostics (closely related to LSP)
  'buffer', // Buffer operations
  'window', // Window operations
  'path', // Paths & Files
  'feature', // Feature Detection
  'system', // System & Shell
  'notify', // Notifications
  'ui', // User Interface
  'text', // Text Processing
  'data', // Data & Tables
  'timing', // Scheduling & Timers
  'treesitter', // Treesitter
  'register', // Registers
  'env', // Environment
] as const satisfies readonly CoreCategorySlug[]

export const CORE_CATEGORY_LABELS: Record<CoreCategorySlug, string> = {
  env: 'Environment',
  path: 'Paths & Files',
  feature: 'Feature Detection',
  system: 'System & Shell',
  ui: 'User Interface',
  text: 'Text Processing',
  register: 'Registers',
  buffer: 'Buffer Operations',
  window: 'Window & Layout',
  lsp: 'Language Server (LSP)',
  diagnostic: 'Diagnostics',
  notify: 'Notifications & Output',
  timing: 'Scheduling & Timers',
  treesitter: 'Treesitter',
  data: 'Data & Tables',
}

/** Build a core category key from a slug */
export function coreCategoryKey(slug: CoreCategorySlug): FunctionCategoryKey {
  return `core:${slug}`
}

/** Build a "plugin all" category key */
export function pluginAllCategoryKey(pluginId: string): FunctionCategoryKey {
  return `plugin:${pluginId}:all`
}

/** Build a plugin sub-category key */
export function pluginSubCategoryKey(
  pluginId: string,
  slug: string,
): FunctionCategoryKey {
  return `plugin:${pluginId}:cat:${slug}`
}

// ============================================
// Function Catalog Entry
// ============================================

export interface FunctionCatalogEntry extends CatalogEntryBase {
  /** The category label (denormalized for display; derived from category key) */
  readonly categoryLabel: string

  /** Source: core Neovim or a specific plugin */
  readonly functionSource: RunFunctionSource

  /** Lua call template string, e.g. "vim.fn.expand($params)" */
  readonly luaCall: string

  /** Parameter signatures */
  readonly params: readonly FunctionCatalogParam[]

  /** Return type */
  readonly returns: PortDataType

  /** Help reference, e.g. ":help expand()" */
  readonly sourceDoc: string

  /** Notes for the info tooltip */
  readonly notes: string

  /** Signature string for display, e.g. "expand({string}[, {nosuf}])" */
  readonly signature: string

  /** Whether this entry is from a plugin (for badge rendering) */
  readonly isPlugin: boolean

  /** Search aliases for fuzzy matching */
  readonly aliases?: readonly string[] | undefined

  // ============================================
  // New fields (Phase 1 additions)
  // ============================================

  /** Beginner-friendly explanation (1-2 sentences) */
  readonly whatItDoes?: string | undefined

  /** Technical note for advanced users */
  readonly technicalNote?: string | undefined

  /** Show in Popular view */
  readonly isPopular?: boolean | undefined

  /** Whether this is a pre-configured function variant (template) */
  readonly isTemplate?: boolean | undefined

  /** Pre-filled parameter defaults for templates */
  readonly templateDefaults?:
    | Readonly<Record<string, RunFunctionDefaultValue>>
    | undefined

  /** For templates: key of the underlying base function entry */
  readonly baseFunctionKey?: string | undefined

  /** Hide from basic/popular views (e.g., callback-heavy functions) */
  readonly advancedOnly?: boolean | undefined

  /** Neovim version requirement (e.g., 'nvim-0.10') */
  readonly requires?: string | undefined

  /** Beginner-friendly description of what the return value represents */
  readonly returnDescription?: string | undefined

  /** How params are passed: 'positional' (default) or 'named-table' */
  readonly paramsStyle?: 'positional' | 'named-table' | undefined
}

export interface FunctionCatalogParam {
  readonly name: string
  readonly type: PortDataType
  readonly optional: boolean
  readonly description?: string | undefined
  readonly example?: string | undefined
  readonly tier?: 'basic' | 'advanced' | undefined
  readonly group?: string | undefined
  readonly allowedValues?: readonly string[] | undefined
  /** Per-value descriptions for allowedValues dropdown. Keys match allowedValues entries. */
  readonly allowedValueDescriptions?:
    | Readonly<Record<string, string>>
    | undefined
  readonly multi?: boolean | undefined
  readonly objectShape?: readonly FunctionCatalogParam[] | undefined
  readonly defaultValue?: RunFunctionDefaultValue | undefined
  /** Friendly label for the node port (if different from param name) */
  readonly portLabel?: string | undefined
}

// ============================================
// Core Function Template Definition
// ============================================

/**
 * Lightweight template definition. The builder resolves the base function
 * and derives the full FunctionCatalogEntry (params, luaCall, signature, etc.)
 * at build time. This ensures base function changes propagate automatically.
 */
export interface CoreFunctionTemplateDefinition {
  /** Unique template key, e.g. 'check-neovim-version' (prefixed with 'template:' at build time) */
  readonly key: string
  /** Technical name of the base function in one of the catalog arrays */
  readonly baseFunctionName: string
  /** User-friendly label for this template variant */
  readonly label: string
  /** One-line description for the card */
  readonly shortDescription: string
  /** Beginner-friendly explanation */
  readonly whatItDoes: string
  /** Pre-filled parameter values (discriminated union, NOT stringly-typed) */
  readonly defaults: Readonly<Record<string, RunFunctionDefaultValue>>
  /** Search aliases */
  readonly aliases?: readonly string[] | undefined
  /** Show in Popular view */
  readonly isPopular?: boolean | undefined

  /** How params are passed: 'positional' (default) or 'named-table' */
  readonly paramsStyle?: 'positional' | 'named-table' | undefined
}
