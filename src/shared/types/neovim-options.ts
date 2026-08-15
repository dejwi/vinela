/**
 * Neovim Options Types
 *
 * Type definitions for the beginner-friendly Neovim Options Settings Page.
 * These types support the curated catalog of 67 options with rich metadata.
 */

// ============================================
// Constants
// ============================================

/** Default leader key (Space). Applied in the Lua generator when the user has not explicitly set one. */
export const DEFAULT_LEADER_KEY = ' '

// ============================================
// Value Types
// ============================================

export type NeovimOptionValueType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'string-list'
  | 'char-list'

// ============================================
// Stored Value Discriminated Union
// ============================================

export type NeovimOptionStoredValue =
  | { valueType: 'boolean'; value: boolean }
  | { valueType: 'number'; value: number }
  | { valueType: 'string'; value: string }
  | { valueType: 'string-list'; value: string[] }
  | { valueType: 'char-list'; value: string[] }

// ============================================
// Option Definition Types
// ============================================

export type OptionComplexity = 'basic' | 'advanced'

export interface NeovimOptionChoice {
  value: string
  label: string
  description: string
}

export interface OptionDependency {
  optionName: string
  requiredValue?: boolean | number | string
  hint: string
}

export type NeovimOptionCategory =
  | 'keymaps'
  | 'line-numbers'
  | 'visual-appearance'
  | 'text-wrapping'
  | 'indentation'
  | 'search'
  | 'file-handling'
  | 'windows-splits'
  | 'completion'
  | 'clipboard-system'
  | 'performance'

export interface NeovimOptionDefinition {
  /** Technical option name (e.g., 'tabstop') */
  name: string
  /** Beginner-friendly label (no jargon) */
  label: string
  /** Plain explanation of the effect */
  whatItDoes: string
  /** Guidance on when you'd want this */
  whenToUse: string
  /** Optional advanced details (shown in expander) */
  technicalNote?: string
  /** Category for grouping */
  category: NeovimOptionCategory
  /** Value type for UI control selection */
  valueType: NeovimOptionValueType
  /** Default value per Neovim documentation */
  defaultValue: boolean | number | string | readonly string[]
  /** Source of default value (e.g., 'Neovim 0.10+ default') */
  defaultSource: string
  /** Basic or advanced complexity */
  complexity: OptionComplexity
  /** Shown in Popular/Starter view */
  isPopular: boolean
  /** Shows community recommendation badge */
  isCommunityRecommended: boolean
  /** Options this one depends on */
  dependencies?: readonly OptionDependency[]
  /** Predefined choices for string/string-list options */
  choices?: readonly NeovimOptionChoice[]
  /** Whether order matters for list values */
  isOrderSensitive?: boolean
  /** Alternative search terms */
  searchAliases?: readonly string[]
  /** Numeric constraints */
  min?: number
  max?: number
}

// ============================================
// Preset Types
// ============================================

export interface OptionPreset {
  id: string
  name: string
  description: string
  options: Record<string, NeovimOptionStoredValue>
}

// ============================================
// Highlight Override Types
// ============================================

/**
 * Source of a highlight override - tracks provenance for preset management.
 */
export type HighlightOverrideSource =
  | { kind: 'preset'; presetId: string }
  | { kind: 'custom' }

/**
 * A single highlight group override.
 * Generates: vim.api.nvim_set_hl(0, groupName, { fg = ..., bg = ..., ... })
 *
 * IMPORTANT: nvim_set_hl completely REPLACES the highlight definition.
 * Setting { bg = "NONE" } will clear ALL attributes (fg, bold, etc.)
 * unless they are also specified. The generator uses a merge strategy.
 */
export interface HighlightOverride {
  /** Stable identifier for row operations and React keys */
  id: string
  groupName: string
  foreground: string // hex color, named color, "NONE", or "" (unset — omit from generated call)
  background: string // hex color, named color, "NONE", or "" (unset — omit from generated call)
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  undercurl: boolean
  link: string // Link to another highlight group, or "" (unset)
  enabled: boolean
  /** Where this override came from */
  source: HighlightOverrideSource
}

/**
 * A highlight preset - a named collection of overrides.
 */
export interface HighlightPreset {
  id: string
  name: string
  description: string
  overrides: Omit<HighlightOverride, 'id' | 'source'>[]
}

// ============================================
// Storage Types
// ============================================

export interface ProjectNeovimOptionsFile {
  version: 1
  options: Record<string, NeovimOptionStoredValue>
  /** Leader key (vim.g.mapleader) - stored separately from vim.opt options */
  leaderKey?: string
  /** Highlight overrides for customizing colors and transparency */
  highlightOverrides?: HighlightOverride[]
  updatedAt: number
}

// ============================================
// Conflict Types
// ============================================

export type OptionConflictType =
  | 'none'
  | 'also-set-in-graph'
  | 'set-multiple-times-in-graphs'

export interface OptionConflictLocation {
  graphId: string
  graphName: string
  nodeId: string
  nodeLabel: string
}

export interface OptionConflictSummary {
  type: OptionConflictType
  locations: readonly OptionConflictLocation[]
}

// ============================================
// Glossary Types
// ============================================

export type GlossaryTerm =
  | 'buffer'
  | 'mode'
  | 'mapping'
  | 'register'
  | 'window'
  | 'tab'
  | 'split'
  | 'provider'
  | 'autocommand'

export interface GlossaryEntry {
  term: GlossaryTerm
  definition: string
}

// ============================================
// Filter Types
// ============================================

export type FilterType = 'recommended' | 'modified' | 'conflicts'

export type ViewMode = 'popular' | 'all'

export type ComplexityMode = 'basic' | 'advanced'
