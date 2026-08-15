/**
 * LSP Types
 *
 * Type definitions for Language Server Protocol server management.
 */

/**
 * Category for grouping LSP servers in the UI.
 */
export type LspServerCategory =
  | 'web' // JavaScript, TypeScript, HTML, CSS
  | 'systems' // C, C++, Rust, Go, Zig
  | 'scripting' // Python, Ruby, Lua, PHP
  | 'data' // JSON, YAML, TOML, SQL
  | 'devops' // Docker, Terraform, Helm
  | 'game-dev' // GDScript, GLSL
  | 'other' // Misc

/**
 * Display order for categories.
 */
export const LSP_CATEGORY_ORDER: readonly LspServerCategory[] = [
  'web',
  'systems',
  'scripting',
  'data',
  'devops',
  'game-dev',
  'other',
]

/**
 * Display labels for categories.
 */
export const LSP_CATEGORY_LABELS: Record<LspServerCategory, string> = {
  web: 'Web Development',
  systems: 'Systems Programming',
  scripting: 'Scripting Languages',
  data: 'Data & Config Files',
  devops: 'DevOps & Infrastructure',
  'game-dev': 'Game Development',
  other: 'Other',
}

/**
 * A language server in our curated catalog.
 * Read-only definition bundled with the app.
 */
export interface LspServerDefinition {
  /** Server name as used by vim.lsp.enable() — e.g. "lua_ls", "vtsls" */
  readonly name: string
  /** Human-friendly display name — e.g. "Lua Language Server" */
  readonly label: string
  /** Short description of what this server provides */
  readonly description: string
  /** Languages this server supports */
  readonly languages: readonly string[]
  /** Filetypes this server attaches to (for display only) */
  readonly filetypes: readonly string[]
  /** Mason package name for installation (if available via Mason) */
  readonly masonPackage: string | null
  /** Category for grouping in the UI */
  readonly category: LspServerCategory
  /** Whether to show this server prominently */
  readonly isPopular: boolean
  /** Search aliases */
  readonly searchAliases?: readonly string[]
  /** URL to server documentation or repo */
  readonly documentationUrl?: string
  /** Brief note about this server (e.g. "Recommended over ts_ls") */
  readonly note?: string
}

/**
 * Stored in project: lsp-servers.json at project root
 *
 * Normalization on load:
 *   - Deduplicate enabledServers (preserve first occurrence)
 *   - Filter out empty strings
 *   - Sort alphabetically for stable diffs
 */
export interface ProjectLspConfig {
  /** Server names enabled for this project */
  enabledServers: string[]
}

/** Safe default for missing/corrupt file */
export const EMPTY_LSP_CONFIG: ProjectLspConfig = {
  enabledServers: [],
}
