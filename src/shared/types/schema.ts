// Import PortDataType for function params (reuse data flow types)
import type { PortDataType } from './graph'

// ============================================
// Schema Option Types (Discriminated Union)
// ============================================

// UI field types for schema options (determines which form component to render)
export type SchemaOptionType =
  | 'string' // Text input
  | 'number' // Number input
  | 'boolean' // Toggle/checkbox
  | 'select' // Dropdown selection
  | 'array' // List editor
  | 'mapping-table' // Structured table editor
  | 'object' // Nested object editor
  | 'color' // Color picker
  | 'keysequence' // Key capture input
  | 'lua' // Lua code editor
  | 'plugin-keymap' // Visual keymap table editor

export interface SelectOption {
  value: string
  label: string
}

export type SchemaNoticeSeverity = 'warning'

export type SchemaNoticeSurface = 'configuration' | 'generation'

export type SchemaNoticeComparableValue = string | number | boolean

export type SchemaNoticeWhen =
  | { kind: 'has-explicit-value' }
  | { kind: 'equals'; value: SchemaNoticeComparableValue }
  | { kind: 'not-equals'; value: SchemaNoticeComparableValue }

export interface SchemaOptionNotice {
  severity: SchemaNoticeSeverity
  surfaces: SchemaNoticeSurface[]
  when: SchemaNoticeWhen
  message: string
  details?: string | undefined
  suggestions?: string[] | undefined
}

export type SchemaDefaultEmission = 'emit' | 'explicit-only'

export type SchemaJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly SchemaJsonValue[]
  | { readonly [key: string]: SchemaJsonValue }

export type SchemaLuaValue =
  | { readonly kind: 'json'; readonly value: SchemaJsonValue }
  | { readonly kind: 'lua'; readonly lua: string }

export type SchemaEmitIncludeRule =
  | { readonly kind: 'always' }
  | { readonly kind: 'explicit-only' }
  | { readonly kind: 'non-default' }
  | { readonly kind: 'non-empty' }

export type SchemaEmitValueRule = {
  readonly kind: 'value-map'
  readonly values: Readonly<Record<string, SchemaLuaValue>>
  readonly onUnknown?: 'omit' | 'emit-original' | 'warn-and-omit' | undefined
}

export type SchemaStringEmitRule = {
  readonly kind: 'path'
  readonly trim?: boolean | undefined
  readonly omitWhenEmpty?: boolean | undefined
  readonly expandWithVimFnExpand?: boolean | undefined
  readonly warnWhenRelative?: boolean | undefined
}

export interface SchemaOptionEmit {
  readonly include?: SchemaEmitIncludeRule | undefined
  readonly valueRule?: SchemaEmitValueRule | undefined
  readonly stringRule?: SchemaStringEmitRule | undefined
}

export type SchemaOptionEmitConfig = SchemaOptionEmit | SchemaMappingTableEmit

export interface SchemaSubtreeGateRule {
  readonly kind: 'subtree-gate'
  readonly scope: string
  readonly when: {
    readonly key: string
    readonly equals: string | number | boolean
  }
  readonly action: 'omit-subtree'
  readonly warnOnExplicitDescendants?: boolean | undefined
  readonly message?: string | undefined
}

export interface SchemaSubtreeFilterRule {
  readonly kind: 'subtree-filter'
  readonly scope: string
  readonly mode: 'meaningful-only'
  readonly preserveKeys?: readonly string[] | undefined
}

export interface SchemaConflictRule {
  readonly kind: 'conflict'
  readonly left: string
  readonly right: string
  readonly severity: 'warning' | 'error'
  readonly when?: 'both-explicit' | 'both-meaningful' | undefined
  readonly message: string
}

export type SchemaGenerationRule =
  | SchemaConflictRule
  | SchemaSubtreeGateRule
  | SchemaSubtreeFilterRule

export type PluginCapability =
  | {
      readonly kind: 'lsp-package-installer'
      readonly provider: 'mason-registry'
    }
  | {
      readonly kind: 'lsp-server-enabler'
      readonly api: 'vim.lsp.enable'
      readonly minNvimVersion: string
    }

// Base fields shared by all option types
interface SchemaOptionBase {
  key: string
  /**
   * Optional Lua emission path.
   *
   * When set, Lua generation emits this option at `emitKey` while UI/storage
   * continue to use `key`.
   */
  emitKey?: string
  label: string
  description?: string
  required?: boolean
  /** Show this option only when condition is met */
  visibleWhen?: {
    key: string
    equals: string | number | boolean
  }
  /** Show as disabled when condition is unmet */
  enabledWhen?: {
    key: string
    equals: string | number | boolean
  }
  /** Group/section for UI organization */
  group?: string
  /** Schema-authored notices for configuration UI and generation diagnostics */
  notices?: SchemaOptionNotice[]
  /** Whether schema defaults should emit without an explicit stored value */
  defaultEmission?: SchemaDefaultEmission
  /** Generic schema-driven emission rules used by the Lua generator */
  emit?: SchemaOptionEmitConfig | undefined
}

// Discriminated union for each option type
export type SchemaOption =
  | SchemaStringOption
  | SchemaNumberOption
  | SchemaBooleanOption
  | SchemaSelectOption
  | SchemaArrayOption
  | SchemaMappingTableOption
  | SchemaObjectOption
  | SchemaColorOption
  | SchemaKeySequenceOption
  | SchemaLuaOption
  | SchemaPluginKeymapOption

export interface SchemaStringOption extends SchemaOptionBase {
  readonly type: 'string'
  default?: string
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  /** Hint for UI: 'input' (default) or 'textarea' for multi-line */
  uiHint?: 'input' | 'textarea'
}

export interface SchemaNumberOption extends SchemaOptionBase {
  readonly type: 'number'
  default?: number
  validation?: {
    min?: number
    max?: number
    step?: number
    integer?: boolean
  }
}

export interface SchemaBooleanOption extends SchemaOptionBase {
  readonly type: 'boolean'
  default?: boolean
}

interface SchemaSelectOptionBase extends SchemaOptionBase {
  readonly type: 'select'
  options: SelectOption[]
}

export interface SchemaSingleSelectOption extends SchemaSelectOptionBase {
  /** Allow multiple selections */
  multi?: false | undefined
  default?: string
}

export interface SchemaMultiSelectOption extends SchemaSelectOptionBase {
  /** Allow multiple selections */
  multi: true
  default?: string[]
}

export type SchemaSelectOption =
  | SchemaSingleSelectOption
  | SchemaMultiSelectOption

export interface SchemaArrayOption extends SchemaOptionBase {
  readonly type: 'array'
  default?: unknown[]
  /** Type of items in the array */
  items: SchemaArrayItemType
  validation?: {
    minItems?: number
    maxItems?: number
    uniqueItems?: boolean
  }
}

export type SchemaMappingTableAutoFillFallback =
  | 'preserve'
  | 'empty'
  | 'column-default'

export interface SchemaMappingTableAutoFill {
  readonly kind: 'value-by-column'
  readonly sourceColumn: string
  readonly values: Readonly<Record<string, string>>
  readonly fallback?: SchemaMappingTableAutoFillFallback | undefined
}

interface SchemaMappingTableColumnBase {
  readonly key: string
  readonly label: string
  readonly default?: string | undefined
  readonly autoFill?: SchemaMappingTableAutoFill | undefined
}

export type SchemaMappingTableColumn =
  | (SchemaMappingTableColumnBase & {
      readonly type: 'string'
      readonly options?: undefined
    })
  | (SchemaMappingTableColumnBase & {
      readonly type: 'select'
      readonly options: readonly SelectOption[]
    })

export interface SchemaMappingTableConflictGroup {
  readonly column: string
  readonly values: readonly string[]
  readonly severity: 'warning'
  readonly message: string
}

export interface SchemaMappingTableEmit {
  readonly targetKey: string
  readonly keyColumn: string
  readonly valueColumn: string
  readonly valueTemplate: string
  readonly outputKeyMap?: Readonly<Record<string, string>> | undefined
}

export type SchemaMappingTableDefaultRow = Readonly<Record<string, string>>

export type SchemaMappingTableDefault = readonly SchemaMappingTableDefaultRow[]

export interface SchemaMappingTableOption extends SchemaOptionBase {
  readonly type: 'mapping-table'
  readonly default?: SchemaMappingTableDefault | undefined
  readonly columns: readonly SchemaMappingTableColumn[]
  readonly emit: SchemaMappingTableEmit
  readonly conflictGroups?:
    | readonly SchemaMappingTableConflictGroup[]
    | undefined
}

/** What type of elements the array contains */
export type SchemaArrayItemType =
  | { readonly itemType: 'string' }
  | { readonly itemType: 'number' }
  | { readonly itemType: 'select'; options: SelectOption[] }

export interface SchemaObjectOption extends SchemaOptionBase {
  readonly type: 'object'
  default?: Record<string, unknown>
  /** Nested properties of this object */
  properties: SchemaOption[]
}

export interface SchemaColorOption extends SchemaOptionBase {
  readonly type: 'color'
  default?: string
  /** Color format: 'hex' (default), 'rgb', 'hsl' */
  format?: 'hex' | 'rgb' | 'hsl'
}

export interface SchemaKeySequenceOption extends SchemaOptionBase {
  readonly type: 'keysequence'
  default?: string
}

export interface SchemaLuaOption extends SchemaOptionBase {
  readonly type: 'lua'
  default?: string
  /** UI-only textarea placeholder; never persisted/emitted */
  inputPlaceholder?: string
  /** Expected return type for validation hints */
  expectedReturnType?: PortDataType
}

// ============================================
// Plugin Keymap Option
// ============================================

/**
 * A command available in a plugin's keymap system.
 * e.g., blink.cmp's 'accept', 'fallback', 'select_next', etc.
 */
export interface PluginKeymapCommand {
  /** The command string used in config/Lua output (e.g., 'accept') */
  readonly name: string
  /** Human-readable display label (e.g., 'Accept Completion') */
  readonly label: string
  /** Description of what this command does */
  readonly description?: string
  /**
   * Whether this is a terminal/control-flow command (like 'fallback').
   * UI can visually distinguish these from action commands.
   */
  readonly isTerminal?: boolean
}

/**
 * A preset keymap configuration that provides a base set of bindings.
 * The preset's mappings are shown in the UI and can be overridden individually.
 */
export interface PluginKeymapPreset {
  /** Preset identifier used in Lua output (e.g., 'default', 'super-tab') */
  readonly id: string
  /** Display label for the dropdown */
  readonly label: string
  /** Description of what this preset provides */
  readonly description?: string
  /**
   * The default key bindings this preset defines.
   * Key = Vim notation (e.g., '<CR>'), Value = ordered list of command names.
   */
  readonly mappings: Record<string, string[]>
}

/**
 * Schema option for configuring plugin-specific keymaps visually.
 *
 * Replaces the pattern of select (preset) + lua (raw override table)
 * with a single structured option that stores JSON and generates Lua.
 *
 * The UI shows: preset dropdown + effective keymaps table + add/edit/disable.
 */
export interface SchemaPluginKeymapOption extends SchemaOptionBase {
  readonly type: 'plugin-keymap'
  /** Available commands that can be assigned to keys */
  readonly commands: PluginKeymapCommand[]
  /** Available presets (base keymap configurations) */
  readonly presets: PluginKeymapPreset[]
  /** Default preset ID when no user config exists. Must reference a valid preset id. */
  readonly defaultPreset: string
  /** Whether keys can be explicitly disabled (set to false in Lua output) */
  readonly allowDisable?: boolean
}

/** Entry in a plugin keymap command list - either a named command or raw Lua */
export type PluginKeymapCommandEntry =
  | string // Named command: 'accept', 'fallback'
  | { readonly lua: string } // Custom Lua: function(cmp) ... end

/**
 * Editor metadata stored alongside plugin-keymap config.
 * This is UI-only data — not used for Lua generation.
 *
 * Canonical location: `_meta.rebindLinks` in the stored config value.
 * Legacy: top-level `rebindLinks` is accepted on read for backward compatibility.
 */
export interface PluginKeymapMeta {
  /**
   * Maps normalizedNewKey → normalizedOldKey for linked rebind pairs.
   * Invariants (enforced on write and hydration):
   * - All keys/values are normalized via normalizeKeymapKey().
   * - No self-links (newKey !== oldKey).
   * - Referential integrity: newKey has a command-array override, oldKey has false override.
   */
  readonly rebindLinks?: Record<string, string>
}

/** Shape of a plugin-keymap config value (for type-safe internal use) */
export interface PluginKeymapConfigValue {
  readonly preset?: string
  readonly overrides?: Record<string, PluginKeymapCommandEntry[] | false>
  /**
   * Editor metadata namespace. Not used for Lua generation.
   * Written as `_meta` in the stored JSON.
   */
  readonly _meta?: PluginKeymapMeta
}

export type VimPackVersionSpec =
  | { readonly mode: 'ref'; readonly value: string }
  | { readonly mode: 'semver-range'; readonly value: string }

export type PluginInstallRefKind = 'branch' | 'tag' | 'commit' | 'ref'

export type PluginInstallVersionOverride =
  | { readonly mode: 'semver-range'; readonly value: string }
  | {
      readonly mode: 'ref'
      readonly refKind: PluginInstallRefKind
      readonly value: string
    }

export interface PluginInstallOverride {
  readonly name?: string | undefined
  readonly version?: PluginInstallVersionOverride | undefined
}

export interface VimPackInstallSpec {
  readonly name?: string | undefined
  readonly version?: VimPackVersionSpec | undefined
}

// ============================================
// Schema Function Types
// ============================================

export interface SchemaFunctionParam {
  name: string
  type: PortDataType
  optional?: boolean
  description?: string
  tier?: 'basic' | 'advanced' | undefined
  group?: string | undefined
  allowedValues?: string[] | undefined
  allowedValueDescriptions?: Readonly<Record<string, string>> | undefined
  multi?: boolean | undefined
  objectShape?: SchemaFunctionParam[] | undefined
  defaultValue?: SchemaFunctionTemplateDefault | undefined
  portLabel?: string | undefined
  example?: string | undefined
}

export function isStructuredParam(p: SchemaFunctionParam): boolean {
  return Array.isArray(p.objectShape) && p.objectShape.length > 0
}

export function isMultiSelectParam(p: SchemaFunctionParam): boolean {
  return p.multi === true && Array.isArray(p.allowedValues)
}

export interface SchemaFunction {
  name: string
  description?: string
  params: SchemaFunctionParam[]
  returns?: PortDataType
  /** Template like "require('telescope.builtin').find_files($params)" */
  luaCall: string
  /** User-friendly display name. If omitted, auto-derived from name. */
  label?: string | undefined
  /** Short one-line description for catalog cards (falls back to description) */
  shortDescription?: string | undefined
  /** Beginner-friendly explanation (1-2 sentences, non-empty when provided) */
  whatItDoes?: string | undefined
  /** Technical note for advanced users (non-empty when provided) */
  technicalNote?: string | undefined
  /** Show in Popular view */
  isPopular?: boolean | undefined
  /** Search aliases for discoverability (non-empty strings) */
  aliases?: string[] | undefined
  /** Catalog category for organization (e.g., 'navigation', 'search') */
  category?: string | undefined
  /** Usage example string */
  example?: string | undefined
  /** URL or help reference to documentation */
  sourceDoc?: string | undefined
  /** Related Ex command (e.g., ':Telescope find_files') for deduplication */
  relatedCommand?: string | undefined
}

export type SchemaOptionWithPrimitiveDefault = Exclude<
  SchemaOption,
  | SchemaPluginKeymapOption
  | SchemaArrayOption
  | SchemaMappingTableOption
  | SchemaObjectOption
>

export function hasPrimitiveDefault(
  option: SchemaOption,
): option is SchemaOptionWithPrimitiveDefault {
  return (
    option.type !== 'plugin-keymap' &&
    option.type !== 'array' &&
    option.type !== 'mapping-table' &&
    option.type !== 'object'
  )
}

export function isSelectArrayItemType(
  item: SchemaArrayItemType,
): item is Extract<SchemaArrayItemType, { itemType: 'select' }> {
  return item.itemType === 'select'
}

// ============================================
// Plugin Schema Function Templates
// ============================================

/**
 * JSON-safe discriminated union for template default values.
 * Used in schema JSON files. Matches the runtime RunFunctionDefaultValue shape.
 *
 * ✅ CORRECT (discriminated union):
 *   { "kind": "scalar", "value": "config" }
 *   { "kind": "lua", "lua": "vim.log.levels.INFO" }
 *
 * ❌ WRONG (stringly-typed sentinel — DO NOT USE):
 *   "lua:vim.log.levels.INFO"
 */
export type SchemaFunctionTemplateDefault =
  | { readonly kind: 'scalar'; readonly value: string | number | boolean }
  | { readonly kind: 'lua'; readonly lua: string }
  | { readonly kind: 'multiselect'; readonly values: string[] }
  | {
      readonly kind: 'object'
      readonly entries: Record<string, SchemaFunctionTemplateDefault>
    }

export interface SchemaFunctionTemplate {
  /** Unique key within this schema, e.g. "search-lua-files" */
  key: string
  /** Which function from the functions array this is a variant of (by name) */
  baseFunctionName: string
  /** User-friendly label, e.g. "Search Lua Files" */
  label: string
  /** Short description for the card subtitle */
  shortDescription: string
  /** Beginner-friendly explanation */
  whatItDoes?: string | undefined
  /** Pre-filled parameter values (required, discriminated union, type-safe) */
  defaults: Record<string, SchemaFunctionTemplateDefault>
  /** Search aliases */
  aliases?: string[] | undefined
  /** Show in Popular view */
  isPopular?: boolean | undefined
}

// ============================================
// Schema Ex Command
// ============================================

export interface SchemaExCommandParam {
  /** Parameter name matching a {placeholder} in the template (e.g. 'file', 'package') */
  name: string
  /** Placeholder text shown in the input field (e.g. '/path/to/file') */
  placeholder: string
  /** User-friendly description of what this parameter accepts */
  description: string
  label?: string
  type?: SchemaExCommandParamType
  optional?: boolean
  defaultValue?: string | number | boolean
  allowedValues?: string[]
  allowedValueDescriptions?: Readonly<Record<string, string>>
  tier?: 'basic' | 'advanced'
  group?: string
  escape?: 'ex-argument'
  emit?: SchemaExCommandParamEmit
}

export type SchemaExCommandParamType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'file-path'
  | 'directory-path'
  | 'select'

export type SchemaExCommandParamEmit =
  | { kind: 'value' }
  | { kind: 'flag'; token: string }
  | { kind: 'option'; prefix: string }

export interface SchemaExCommandTemplate {
  key: string
  baseCommandName: string
  label: string
  shortDescription: string
  defaults: Record<string, string | number | boolean>
  example?: string
  whatItDoes?: string
  aliases?: string[]
  isPopular?: boolean
}

export interface SchemaExCommand {
  /** The Ex command name without leading colon (e.g. 'Telescope', 'Mason', 'TSInstall') */
  name: string
  /** User-friendly description */
  description: string
  /** Template showing typical usage. Use {name} placeholders for parameters (e.g. ':MasonInstall {package}') */
  template: string
  /** Usage example */
  example: string
  /** Help reference (e.g. ':help :Telescope') */
  sourceDoc: string
  /** Optional parameters for template placeholder substitution */
  params?: SchemaExCommandParam[]

  // ---- DISPLAY / CATALOG FIELDS ----
  /** User-friendly display label (falls back to name) */
  label?: string | undefined
  /** Short one-line description for catalog cards (falls back to description) */
  shortDescription?: string | undefined
  /** Catalog category for organization */
  category?: string | undefined
  /** Beginner-friendly explanation */
  whatItDoes?: string | undefined
  /** Technical note for advanced users */
  technicalNote?: string | undefined
  /** Show in Popular view */
  isPopular?: boolean | undefined
  /** Search aliases for discoverability */
  aliases?: string[] | undefined
}

// ============================================
// Plugin Setup Metadata
// ============================================

/**
 * Schema-authored Lua template for plugin setup emission.
 * Replaces the default require().setup({...}) call when present.
 */
export type PluginSetupRenderer = {
  readonly kind: 'lua-template'
  readonly template: string
}

/**
 * Describes how to initialize/setup a plugin at startup.
 * Used by the Lua generator to produce the correct require().setup() call.
 *
 * If omitted from a schema, the generator will emit a comment:
 *   -- Plugin 'x' has no setup metadata; configure manually
 */
export interface PluginSetupMetadata {
  /**
   * Module path for require().
   * This is often different from the plugin name.
   * Examples:
   *   - 'telescope' (for telescope.nvim)
   *   - 'nvim-treesitter' (for nvim-treesitter)
   *   - 'mason' (for mason.nvim)
   */
  requirePath: string

  /**
   * Function to call on the required module.
   * Defaults to 'setup' if omitted.
   * Examples:
   *   - 'setup' (most plugins) → require('x').setup({...})
   *   - 'config' → require('x').config({...})
   */
  setupFunction?: string | undefined

  /**
   * How schema options map to the setup function's arguments.
   * - 'table' (default): All options passed as a single table argument
   *     → require('x').setup({ opt1 = val1, opt2 = val2 })
   * - 'individual': Each option passed as a separate call
   *     → Not commonly needed, reserved for future use
   */
  optionMapping?: 'table' | 'individual' | undefined

  /**
   * Raw Lua code to execute BEFORE the setup call.
   * Use for vim.g settings or prerequisite configuration.
   * Example: "vim.g.mapleader = ' '"
   */
  preSetup?: string | undefined

  /**
   * Raw Lua code to execute AFTER the setup call.
   * Use for post-initialization configuration.
   * Example: "require('telescope').load_extension('fzf')"
   */
  postSetup?: string | undefined

  /**
   * Optional custom setup renderer. When present, replaces the default
   * require().setup({...}) emission. Supports {{config}} and {{requirePath}}
   * placeholders in trusted schema-authored Lua templates.
   */
  render?: PluginSetupRenderer | undefined
}

// ============================================
// Plugin Category
// ============================================

/**
 * Category for organizing plugins in the Browse tab.
 * Used as a discriminated string literal union for type safety.
 */
export type PluginCategory =
  | 'editor' // Editor Enhancement (motions, editing, text objects)
  | 'lsp' // LSP / Completion (language servers, autocomplete)
  | 'ui' // UI / Appearance (statusline, colorschemes, icons)
  | 'navigation' // Navigation (file finders, project trees, buffers)
  | 'git' // Git (signs, blame, diffview)
  | 'debugging' // Debugging (DAP, breakpoints)
  | 'syntax' // Syntax / Language (treesitter, filetype-specific)
  | 'utility' // Utility (sessions, snippets, terminal, misc)

export const PLUGIN_CATEGORIES: readonly PluginCategory[] = [
  'editor',
  'lsp',
  'ui',
  'navigation',
  'git',
  'debugging',
  'syntax',
  'utility',
] as const

export const PLUGIN_CATEGORY_LABELS: Record<PluginCategory, string> = {
  editor: 'Editor Enhancement',
  lsp: 'LSP & Completion',
  ui: 'UI & Appearance',
  navigation: 'Navigation',
  git: 'Git',
  debugging: 'Debugging',
  syntax: 'Syntax & Language',
  utility: 'Utility',
}

// ============================================
// Plugin Schema
// ============================================

export interface PluginSchema {
  id: string
  pluginName: string
  pluginRepo: string // GitHub URL
  version: string
  description?: string
  pack?: VimPackInstallSpec | undefined
  dependencies?: string[] // Other plugin IDs
  options: SchemaOption[]
  functions: SchemaFunction[]
  events?: string[] // Custom events this plugin emits
  /** Ex commands this plugin provides (e.g. :Telescope, :Mason, :TSInstall) */
  exCommands?: SchemaExCommand[]
  exCommandTemplates?: SchemaExCommandTemplate[]
  /** Pre-configured function variants with default parameter values */
  functionTemplates?: SchemaFunctionTemplate[] | undefined
  generationRules?: readonly SchemaGenerationRule[] | undefined
  capabilities?: readonly PluginCapability[] | undefined

  /**
   * How to initialize this plugin at startup.
   * If omitted, the Lua generator will skip setup or emit a manual-config comment.
   * See PluginSetupMetadata for field documentation.
   */
  setup?: PluginSetupMetadata | undefined

  // ---- METADATA FIELDS ----
  /** Optional fallback author display name for non-builtin schemas. */
  author?: string | undefined
  /** Optional fallback stars snapshot for non-builtin schemas. */
  stars?: number | undefined
  /** Plugin category for Browse organization */
  category?: PluginCategory | undefined
  /** Search tags for discoverability */
  tags?: string[] | undefined
  /** Short one-line tagline (if description is long) */
  tagline?: string | undefined
  /** URL to plugin icon/logo (optional, for future use) */
  iconUrl?: string | undefined
}

// ============================================
// Plugin Configuration State
// ============================================

/**
 * User's configuration for a specific plugin.
 * Maps schema option keys to their configured values.
 */
export interface PluginConfig {
  /** Schema ID this config belongs to */
  schemaId: string
  /** Whether this plugin is enabled */
  enabled: boolean
  /** User-configured option values (key matches SchemaOption.key) */
  values: Record<string, PluginConfigValue>
}

/**
 * A configured value for a schema option.
 * Can be a primitive, array, or nested object.
 */
export type PluginConfigValue =
  | string
  | number
  | boolean
  | PluginConfigValue[]
  | { [key: string]: PluginConfigValue }

/**
 * Installed plugin entry stored in project.json.
 * Tracks which plugins are in the project and their config.
 */
export interface InstalledPlugin {
  /** Schema ID (matches PluginSchema.id) */
  schemaId: string
  /** Whether plugin is enabled */
  enabled: boolean
  /** User-configured values */
  config: Record<string, PluginConfigValue>
  /**
   * Per-field toggle for lua-type options.
   * - true: include in generated Lua
   * - false: exclude from generated Lua
   *
   * Keys are schema option keys (including dot-keys when applicable).
   * When a key is absent, smart default behavior applies.
   */
  luaFieldOverrides?: Record<string, boolean> | undefined
  /** Optional per-project install target override for vim.pack.add(). */
  installOverride?: PluginInstallOverride | undefined
  /** When the plugin was added to project */
  addedAt: number
}

/**
 * Result of loading installed plugins from disk.
 * Discriminated union to distinguish normal empty from error conditions.
 */
export type PluginLoadResult =
  | {
      readonly status: 'loaded'
      plugins: InstalledPlugin[]
    }
  | {
      readonly status: 'file-not-found'
      /** First run or project without plugins — this is normal */
      plugins: InstalledPlugin[] // Always empty array
    }
  | {
      readonly status: 'corrupted'
      /** The raw error for diagnostics */
      error: string
      /** Empty array as fallback */
      plugins: InstalledPlugin[] // Always empty array
    }
  | {
      readonly status: 'permission-denied'
      error: string
      plugins: InstalledPlugin[] // Always empty array
    }

/**
 * Browse-eligible plugin display info (available to install).
 */
export type AvailablePluginDisplayInfo = Extract<
  PluginDisplayInfo,
  { status: 'available' }
>

/**
 * Type guard for available (not installed) plugins.
 */
export function isAvailablePlugin(
  plugin: PluginDisplayInfo,
): plugin is AvailablePluginDisplayInfo {
  return plugin.status === 'available'
}

/**
 * Extended schema info for UI display.
 * Combines schema metadata with installation state.
 */
export type PluginDisplayInfo =
  | {
      readonly status: 'installed'
      schema: PluginSchema
      source: SchemaSource
      installed: InstalledPlugin
    }
  | {
      readonly status: 'available'
      schema: PluginSchema
      source: SchemaSource
    }
  | {
      readonly status: 'orphaned'
      /** The installed plugin entry (schema is missing) */
      installed: InstalledPlugin
      /** Schema ID for display and recovery actions */
      schemaId: string
    }

/**
 * Source tier of a schema (for display/debugging).
 */
export type SchemaSource = 'builtin' | 'global' | 'project'

export type SchemaImportScope = 'global' | 'project'

/**
 * Schema with its source tier for resolution tracking.
 */
export interface ResolvedSchema {
  schema: PluginSchema
  source: SchemaSource
}

// ============================================
// Type Guards
// ============================================

export function isStringOption(opt: SchemaOption): opt is SchemaStringOption {
  return opt.type === 'string'
}

export function isNumberOption(opt: SchemaOption): opt is SchemaNumberOption {
  return opt.type === 'number'
}

export function isBooleanOption(opt: SchemaOption): opt is SchemaBooleanOption {
  return opt.type === 'boolean'
}

export function isSelectOption(opt: SchemaOption): opt is SchemaSelectOption {
  return opt.type === 'select'
}

export function isArrayOption(opt: SchemaOption): opt is SchemaArrayOption {
  return opt.type === 'array'
}

export function isMappingTableOption(
  opt: SchemaOption,
): opt is SchemaMappingTableOption {
  return opt.type === 'mapping-table'
}

export function isObjectOption(opt: SchemaOption): opt is SchemaObjectOption {
  return opt.type === 'object'
}

export function isColorOption(opt: SchemaOption): opt is SchemaColorOption {
  return opt.type === 'color'
}

export function isKeySequenceOption(
  opt: SchemaOption,
): opt is SchemaKeySequenceOption {
  return opt.type === 'keysequence'
}

export function isLuaOption(opt: SchemaOption): opt is SchemaLuaOption {
  return opt.type === 'lua'
}

export function isPluginKeymapOption(
  opt: SchemaOption,
): opt is SchemaPluginKeymapOption {
  return opt.type === 'plugin-keymap'
}
