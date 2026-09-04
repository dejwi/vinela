/**
 * Centralized Path Definitions
 *
 * This module defines path constants and helpers for:
 * 1. App-level paths (in AppData) - settings, global schemas, backups
 * 2. Project-level paths (relative within project folder) - project.json, graphs, schemas
 */

import { encodeSchemaId } from './schema-id-codec'

// ============================================
// App-Level Paths (in AppData)
// ============================================

/**
 * Paths relative to the app data directory.
 * These are used with readAppFile/writeAppFile functions.
 */
export const APP_PATHS = {
  /** App settings file */
  SETTINGS: 'app-settings.json',

  /** Global user schemas directory (downloaded/user-created, shared across projects) */
  GLOBAL_SCHEMAS: 'schemas',
} as const

// ============================================
// Project-Level Paths (relative to project folder)
// ============================================

/**
 * Paths relative to a project folder.
 * These are used with readProjectFile/writeProjectFile functions.
 */
export const PROJECT_PATHS = {
  /** Project metadata file */
  PROJECT_JSON: 'project.json',

  /** Graphs directory */
  GRAPHS: 'graphs',

  /** Project-local schemas */
  SCHEMAS: 'schemas',

  /** Neovim options settings file */
  NEOVIM_OPTIONS: 'neovim-options.json',

  /** Manual keymaps file */
  KEYMAPS: 'keymaps.json',
  GITIGNORE: '.gitignore',
  PROFILES: 'profiles.json',
  PROFILES_LOCAL: 'profiles.local.json',
  /** LSP server configuration file */
  LSP_SERVERS: 'lsp-servers.json',
} as const

// ============================================
// Project Path Helpers
// ============================================

/**
 * Get the path to a graph file within a project.
 * @param graphId - The graph's UUID
 * @returns Relative path like "graphs/{graphId}.json"
 */
export function getGraphFilePath(graphId: string): string {
  return `${PROJECT_PATHS.GRAPHS}/${graphId}.json`
}

/**
 * Get the path to a project-local schema file.
 * Schema IDs are encoded with encodeSchemaId() to produce filesystem-safe
 * storage keys. Existing kebab-case IDs (e.g. "telescope-nvim") encode to
 * themselves, so no migration is needed.
 * @param schemaId - The schema's ID (may contain any characters)
 * @returns Relative path like "schemas/{encodedId}.json"
 */
export function getSchemaFilePath(schemaId: string): string {
  const key = encodeSchemaId(schemaId)
  return `${PROJECT_PATHS.SCHEMAS}/${key}.json`
}

// ============================================
// Global Schema Path Helpers
// ============================================

/**
 * Get the path to a global schema file (in AppData).
 * Schema IDs are encoded with encodeSchemaId() to produce filesystem-safe
 * storage keys. Existing kebab-case IDs (e.g. "telescope-nvim") encode to
 * themselves, so no migration is needed.
 * @param schemaId - The schema's ID (may contain any characters)
 * @returns Relative path like "schemas/{encodedId}.json"
 */
export function getGlobalSchemaFilePath(schemaId: string): string {
  const key = encodeSchemaId(schemaId)
  return `${APP_PATHS.GLOBAL_SCHEMAS}/${key}.json`
}
