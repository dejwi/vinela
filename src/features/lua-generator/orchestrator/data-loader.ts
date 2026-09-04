// ============================================
// Orchestrator Data Loader
// Loads all project data in parallel with error handling
// ============================================

import {
  type LoadColorSchemePreferencesResult,
  loadColorSchemePreferences,
} from '@/features/colorschemes/storage'
import { listGraphs } from '@/features/graph-editor/storage'
import { loadKeymaps } from '@/features/keymaps/storage'
import type { ProjectKeymap } from '@/features/keymaps/types'
import { loadProjectLspConfig } from '@/features/lsp/storage'
import {
  loadAllSchemas,
  loadInstalledPlugins,
} from '@/features/plugins/storage'
import {
  loadProjectProfileOverrides,
  loadProjectProfiles,
} from '@/features/profiles/storage'
import { readNeovimOptions } from '@/features/settings/storage/neovim-options'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import { readProjectFile } from '@/shared/lib/storage-api'
import type {
  Graph,
  InstalledPlugin,
  PluginLoadResult,
  PluginSchema,
  Project,
  ProjectLspConfig,
  ProjectNeovimOptionsFile,
  ProjectProfile,
} from '@/shared/types'

// ============================================
// Load Outcome Types (Discriminated Unions)
// ============================================

export type LoadOutcome<T> =
  | { status: 'success'; data: T }
  | { status: 'missing'; data: T }
  | { status: 'error'; error: string; data: T }

export interface ProjectData {
  projectPath: string
  graphs: Graph[]
  plugins: InstalledPlugin[]
  schemas: PluginSchema[]
  options: ProjectNeovimOptionsFile | null
  keymaps: ProjectKeymap[]
  profiles: LoadedProjectProfiles
  lspConfig: ProjectLspConfig
  colorschemePrefs: {
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }
}
export interface LoadedProjectProfiles {
  profiles: ProjectProfile[]
  overrides: Record<string, boolean>
}

export interface DataLoadResult {
  graphs: LoadOutcome<Graph[]>
  plugins: LoadOutcome<InstalledPlugin[]>
  schemas: LoadOutcome<PluginSchema[]>
  options: LoadOutcome<ProjectNeovimOptionsFile | null>
  keymaps: LoadOutcome<ProjectKeymap[]>
  profiles: LoadOutcome<LoadedProjectProfiles>
  lspConfig: LoadOutcome<ProjectLspConfig>
  colorschemePrefs: LoadOutcome<{
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }>
  /** Project metadata (name, id, etc.) — optional source */
  projectMeta: LoadOutcome<Project | null>
}

// ============================================
// Data Loading Functions
// ============================================

/**
 * Load all project data in parallel.
 * Required sources (graphs): failure is fatal
 * Optional sources: failure degrades to defaults + warning
 */
export async function loadProjectData(
  projectPath: string,
  signal?: AbortSignal,
): Promise<DataLoadResult> {
  // Check cancellation before starting
  if (signal?.aborted) {
    return createCancelledResult()
  }

  // Kick off parallel loading for all sources
  const [
    graphsResult,
    pluginsLoadResult,
    schemasResult,
    optionsResult,
    keymapsResult,
    profilesResult,
    lspConfigResult,
    colorschemeResult,
    projectMetaResult,
  ] = await Promise.all([
    loadGraphsSafe(projectPath),
    loadPluginsSafe(projectPath),
    loadSchemasSafe(projectPath),
    loadOptionsSafe(projectPath),
    loadKeymapsSafe(projectPath),
    loadProjectProfilesSafe(projectPath),
    loadLspConfigSafe(projectPath),
    loadColorschemePrefsSafe(projectPath),
    loadProjectMetaSafe(projectPath),
  ])

  // Check cancellation after loading
  if (signal?.aborted) {
    return createCancelledResult()
  }

  return {
    graphs: graphsResult,
    plugins: pluginsResultFromLoad(pluginsLoadResult),
    schemas: schemasResult,
    options: optionsResult,
    keymaps: keymapsResult,
    profiles: profilesResult,
    lspConfig: lspConfigResult,
    colorschemePrefs: colorschemeResult,
    projectMeta: projectMetaResult,
  }
}

async function loadProjectProfilesSafe(
  projectPath: string,
): Promise<LoadOutcome<LoadedProjectProfiles>> {
  try {
    const profiles = await loadProjectProfiles(projectPath)
    try {
      return {
        status: 'success',
        data: {
          profiles,
          overrides: await loadProjectProfileOverrides(projectPath),
        },
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        data: { profiles, overrides: {} },
      }
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: { profiles: [], overrides: {} },
    }
  }
}

/**
 * Convert plugin load result to load outcome
 */
function pluginsResultFromLoad(
  result: PluginLoadResult,
): LoadOutcome<InstalledPlugin[]> {
  switch (result.status) {
    case 'loaded':
      return { status: 'success', data: result.plugins }
    case 'file-not-found':
      return { status: 'missing', data: [] }
    case 'corrupted':
      return {
        status: 'error',
        error: result.error ?? 'Plugin configuration corrupted',
        data: result.plugins,
      }
    case 'permission-denied':
      return {
        status: 'error',
        error: result.error ?? 'Permission denied reading plugins',
        data: result.plugins,
      }
    default:
      return { status: 'missing', data: [] }
  }
}

/**
 * Load graphs - REQUIRED source
 */
async function loadGraphsSafe(
  projectPath: string,
): Promise<LoadOutcome<Graph[]>> {
  try {
    const graphs = await listGraphs(projectPath)
    return { status: 'success', data: graphs }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: [],
    }
  }
}

/**
 * Load plugins with typed result
 */
async function loadPluginsSafe(projectPath: string): Promise<PluginLoadResult> {
  return loadInstalledPlugins(projectPath)
}

/**
 * Load schemas - optional source
 */
async function loadSchemasSafe(
  projectPath: string,
): Promise<LoadOutcome<PluginSchema[]>> {
  try {
    const resolved = await loadAllSchemas(projectPath)
    const schemas = resolved.map((r) => r.schema)
    return { status: 'success', data: schemas }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: [],
    }
  }
}

/**
 * Load Neovim options - optional source
 */
async function loadOptionsSafe(
  projectPath: string,
): Promise<LoadOutcome<ProjectNeovimOptionsFile | null>> {
  try {
    const options = await readNeovimOptions(projectPath)
    if (options === null) {
      return { status: 'missing', data: null }
    }
    return { status: 'success', data: options }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: null,
    }
  }
}

/**
 * Load keymaps - optional source
 */
async function loadKeymapsSafe(
  projectPath: string,
): Promise<LoadOutcome<ProjectKeymap[]>> {
  try {
    const keymaps = await loadKeymaps(projectPath)
    return { status: 'success', data: keymaps }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: [],
    }
  }
}

/**
 * Load LSP config - optional source
 */
async function loadLspConfigSafe(
  projectPath: string,
): Promise<LoadOutcome<ProjectLspConfig>> {
  try {
    const config = await loadProjectLspConfig(projectPath)
    return { status: 'success', data: config }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: { enabledServers: [] },
    }
  }
}

/**
 * Load colorscheme preferences - optional source
 */
async function loadColorschemePrefsSafe(projectPath: string): Promise<
  LoadOutcome<{
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }>
> {
  try {
    const result: LoadColorSchemePreferencesResult =
      await loadColorSchemePreferences(projectPath)

    if (!result.success) {
      return {
        status: 'error',
        error: result.error,
        data: { activeScheme: null, variantPreferences: {} },
      }
    }

    return {
      status: result.source === 'default' ? 'missing' : 'success',
      data: {
        activeScheme: result.data.activeScheme,
        variantPreferences: result.data.variantPreferences,
      },
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: { activeScheme: null, variantPreferences: {} },
    }
  }
}

/**
 * Load project metadata (project.json) — optional source.
 * Failure degrades gracefully; the project name falls back to a default.
 */
async function loadProjectMetaSafe(
  projectPath: string,
): Promise<LoadOutcome<Project | null>> {
  try {
    const project = await readProjectFile<Project>(
      projectPath,
      PROJECT_PATHS.PROJECT_JSON,
    )
    return { status: 'success', data: project }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: null,
    }
  }
}

/**
 * Create a cancelled result for all fields
 */
function createCancelledResult(): DataLoadResult {
  const cancelledOutcome: LoadOutcome<never[]> = {
    status: 'error',
    error: 'Loading cancelled',
    data: [],
  }
  const cancelledNullOutcome: LoadOutcome<null> = {
    status: 'error',
    error: 'Loading cancelled',
    data: null,
  }
  const cancelledLspOutcome: LoadOutcome<ProjectLspConfig> = {
    status: 'error',
    error: 'Loading cancelled',
    data: { enabledServers: [] },
  }
  const cancelledColorschemeOutcome: LoadOutcome<{
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }> = {
    status: 'error',
    error: 'Loading cancelled',
    data: { activeScheme: null, variantPreferences: {} },
  }

  return {
    graphs: cancelledOutcome,
    plugins: cancelledOutcome,
    schemas: cancelledOutcome,
    options: cancelledNullOutcome,
    keymaps: cancelledOutcome,
    profiles: {
      status: 'error',
      error: 'Loading cancelled',
      data: { profiles: [], overrides: {} },
    },
    lspConfig: cancelledLspOutcome,
    colorschemePrefs: cancelledColorschemeOutcome,
    projectMeta: cancelledNullOutcome,
  }
}

// ============================================
// Result Extraction Helpers
// ============================================

/**
 * Extract successful data or return default
 */
export function extractData<T>(outcome: LoadOutcome<T>, defaultValue: T): T {
  if (outcome.status === 'success' || outcome.status === 'missing') {
    return outcome.data
  }
  return defaultValue
}

/**
 * Check if any required source failed
 */
export function hasFatalLoadFailure(result: DataLoadResult): boolean {
  // Graphs are required
  if (result.graphs.status === 'error') {
    return true
  }
  return false
}

/**
 * Collect all load errors as diagnostics
 */
export function collectLoadErrors(
  result: DataLoadResult,
): Array<{ source: string; error: string }> {
  const errors: Array<{ source: string; error: string }> = []

  if (result.graphs.status === 'error') {
    errors.push({ source: 'graphs', error: result.graphs.error })
  }
  if (result.plugins.status === 'error') {
    errors.push({ source: 'plugins', error: result.plugins.error })
  }
  if (result.schemas.status === 'error') {
    errors.push({ source: 'schemas', error: result.schemas.error })
  }
  if (result.options.status === 'error') {
    errors.push({ source: 'options', error: result.options.error })
  }
  if (result.keymaps.status === 'error') {
    errors.push({ source: 'keymaps', error: result.keymaps.error })
  }
  if (result.profiles.status === 'error')
    errors.push({ source: 'profiles', error: result.profiles.error })
  if (result.lspConfig.status === 'error') {
    errors.push({ source: 'lspConfig', error: result.lspConfig.error })
  }
  if (result.colorschemePrefs.status === 'error') {
    errors.push({
      source: 'colorschemePrefs',
      error: result.colorschemePrefs.error,
    })
  }
  if (result.projectMeta.status === 'error') {
    errors.push({
      source: 'projectMeta',
      error: result.projectMeta.error,
    })
  }

  return errors
}
