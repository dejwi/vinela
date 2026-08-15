import { parseRepositoryRef } from '@/shared/lib/repository-ref'

/**
 * Color scheme types for vinela
 */

const BUILTIN_THEME_REPO_TO_SCHEMA_ID_ENTRIES = [
  ['https://github.com/folke/tokyonight.nvim', 'tokyonight'],
  ['https://github.com/catppuccin/nvim', 'catppuccin'],
  ['https://github.com/rebelot/kanagawa.nvim', 'kanagawa'],
  ['https://github.com/EdenEast/nightfox.nvim', 'nightfox'],
  ['https://github.com/rose-pine/neovim', 'rose-pine'],
  ['https://github.com/AlexvZyl/nordic.nvim', 'nordic'],
  ['https://github.com/Mofiqul/vscode.nvim', 'vscode-nvim'],
  ['https://github.com/sainnhe/sonokai', 'sonokai'],
  ['https://github.com/nyoom-engineering/oxocarbon.nvim', 'oxocarbon'],
  ['https://github.com/vague-theme/vague.nvim', 'vague'],
] as const satisfies readonly (readonly [string, string])[]

function buildBuiltinThemeSchemaIdMap(): ReadonlyMap<string, string> {
  const entries = BUILTIN_THEME_REPO_TO_SCHEMA_ID_ENTRIES.flatMap(
    ([pluginRepo, schemaId]) => {
      const parsed = parseRepositoryRef(pluginRepo)
      return parsed.success
        ? ([[parsed.repoSlug, schemaId]] as const)
        : ([] as const)
    },
  )

  return new Map<string, string>(entries)
}

const BUILTIN_THEME_SCHEMA_IDS = buildBuiltinThemeSchemaIdMap()

const BUILTIN_THEME_SCHEMA_ID_SET = new Set<string>(
  BUILTIN_THEME_SCHEMA_IDS.values(),
)

// ============================================
// Color Scheme Activation (catalog metadata)
// ============================================

/**
 * Primitive global assignment emitted before `vim.cmd.colorscheme`.
 * Restricted to string, number, and boolean values only.
 */
export interface ColorSchemeGlobalAssignment {
  name: string
  value: string | number | boolean
}

/**
 * Generic activation metadata for catalog entries that share a colorscheme
 * command but require background or global configuration first.
 */
export interface ColorSchemeActivation {
  background?: 'dark' | 'light'
  globals?: ColorSchemeGlobalAssignment[]
}

// ============================================
// Color Scheme Catalog Entry
// ============================================

/**
 * A color scheme entry in the bundled catalog.
 * Contains metadata and color definitions for preview rendering.
 */
export interface ColorSchemeCatalogEntry {
  /** Unique identifier (e.g., 'kanagawa', 'tokyonight-storm') */
  id: string

  /** Display name (e.g., 'Kanagawa', 'Tokyo Night Storm') */
  name: string

  /** GitHub repository URL */
  repoUrl: string

  /** Short description */
  description: string

  /** Theme variant: dark, light, or both */
  variant: 'dark' | 'light' | 'both'

  /** Plugin name for vim.cmd.colorscheme (e.g., 'kanagawa', 'tokyonight-storm') */
  vimColorscheme: string

  /**
   * Optional activation statements emitted before the colorscheme command.
   * Use for shared commands that need `vim.o.background` or primitive globals.
   */
  activation?: ColorSchemeActivation

  /** Full GitHub repository URL used by plugin schemas (e.g. https://github.com/folke/tokyonight.nvim) */
  pluginRepo: string

  /** Optional: specific branch or tag */
  pluginRef?: string

  /** Color palette for preview rendering */
  colors: ColorSchemeColors

  /** Optional tags for filtering (e.g., 'minimal', 'vibrant', 'retro') */
  tags?: string[]
}

/**
 * Color definitions extracted from the theme.
 * Maps to Shiki theme tokens for accurate preview rendering.
 */
export interface ColorSchemeColors {
  /** Editor background */
  background: string

  /** Default foreground text */
  foreground: string

  /** Line number color */
  lineNumber: string

  /** Current line highlight background */
  lineHighlight: string

  /** Selection background */
  selection: string

  /** Cursor color */
  cursor: string

  /** Syntax token colors */
  tokens: {
    comment: string
    keyword: string
    string: string
    number: string
    function: string
    variable: string
    type: string
    constant: string
    operator: string
    punctuation: string
    /** Additional semantic tokens */
    [key: string]: string
  }

  /** UI chrome colors (for Neovim window preview) */
  ui: {
    statusLine: string
    statusLineText: string
    tabLine: string
    tabLineText: string
    tabLineSel: string
    tabLineSelText: string
    border: string
  }
}

// ============================================
// Project Color Schemes File (Revised)
// ============================================

/**
 * Simplified project color scheme configuration file structure.
 * Stores ONLY preferences, not installation state.
 * Installation state is derived from plugins.json.
 */
export interface ProjectColorSchemesFile {
  /** Currently active color scheme ID (null = use Neovim default) */
  activeScheme: string | null

  /** Per-plugin variant preferences (pluginSchemaId → catalogEntryId) */
  variantPreferences: Record<string, string>
}

// ============================================
// Display Info
// ============================================

/**
 * Combined catalog + installation state for UI rendering.
 * Discriminated union pattern with plugin-derived state.
 */
export type ColorSchemeDisplayInfo =
  | {
      readonly status: 'installed'
      catalog: ColorSchemeCatalogEntry
      /** The underlying plugin schema ID */
      pluginSchemaId: string
      /** Derived from ProjectColorSchemesFile.activeScheme AND plugin enabled state */
      isActive: boolean
      /** Whether the underlying plugin is enabled */
      isPluginEnabled: boolean
    }
  | {
      readonly status: 'available'
      catalog: ColorSchemeCatalogEntry
      /** The underlying plugin schema ID */
      pluginSchemaId: string
    }

// ============================================
// Type Guards
// ============================================

/**
 * Type guard for installed color schemes.
 */
export function isInstalledColorScheme(
  info: ColorSchemeDisplayInfo,
): info is Extract<ColorSchemeDisplayInfo, { status: 'installed' }> {
  return info.status === 'installed'
}

// ============================================
// Utility Functions
// ============================================

/**
 * Derive owner/repo slug from full GitHub URL when needed for UI/search.
 */
export function getRepoSlug(pluginRepo: string): string {
  const parsed = parseRepositoryRef(pluginRepo)
  return parsed.success ? parsed.repoSlug : pluginRepo
}

/**
 * Convert plugin repo URL to filesystem-safe schema ID.
 * Example: 'https://github.com/folke/tokyonight.nvim' → 'theme--tokyonight.nvim'
 */
export function getThemePluginSchemaId(pluginRepo: string): string {
  const parsed = parseRepositoryRef(pluginRepo)
  if (parsed.success) {
    const builtinSchemaId = BUILTIN_THEME_SCHEMA_IDS.get(parsed.repoSlug)
    if (builtinSchemaId !== undefined) {
      return builtinSchemaId
    }
  }

  const repoName = parsed.success
    ? parsed.name
    : pluginRepo.replace(/[^a-zA-Z0-9.-]/g, '-')
  return `theme--${repoName}`
}

/**
 * Check if a schema ID is a theme plugin.
 */
export function isThemeSchemaId(schemaId: string): boolean {
  return (
    schemaId.startsWith('theme--') || BUILTIN_THEME_SCHEMA_ID_SET.has(schemaId)
  )
}

/**
 * Group catalog entries by their underlying plugin.
 */
export function groupCatalogByPlugin(
  catalog: ColorSchemeCatalogEntry[],
): Map<string, ColorSchemeCatalogEntry[]> {
  const groups = new Map<string, ColorSchemeCatalogEntry[]>()
  for (const entry of catalog) {
    const pluginId = getThemePluginSchemaId(entry.pluginRepo)
    const existing = groups.get(pluginId) ?? []
    existing.push(entry)
    groups.set(pluginId, existing)
  }
  return groups
}
