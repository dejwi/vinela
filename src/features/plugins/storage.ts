import builtinSchemas from '@/schemas'
import {
  APP_PATHS,
  getGlobalSchemaFilePath,
  getSchemaFilePath,
  PROJECT_PATHS,
} from '@/shared/lib/paths'
import { decodeSchemaId } from '@/shared/lib/schema-id-codec'
import { validateSchema } from '@/shared/lib/schema-validation'
import {
  appFileExists,
  ensureAppDir,
  ensureProjectDir,
  listAppDir,
  listProjectDir,
  projectFileExists,
  readAppFile,
  readProjectFile,
  removeAppFile,
  removeProjectFile,
  writeAppFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type {
  InstalledPlugin,
  PluginConfigValue,
  PluginInstallOverride,
  PluginInstallRefKind,
  PluginInstallVersionOverride,
  PluginLoadResult,
  PluginSchema,
  ResolvedSchema,
} from '@/shared/types'
import {
  migratePluginKeymapConfig,
  PLUGIN_KEYMAP_MIGRATION_VERSION,
} from './migrations/migrate-plugin-keymap'
import {
  inferPluginInstallRefKind,
  isPluginInstallRefKind,
  normalizeInstallOverrideName,
  normalizeInstallVersionValue,
  validatePluginInstallVersionOverride,
} from './utils/install-version'

// ============================================
// Built-in Schema Loading
// ============================================

/**
 * Load built-in schemas bundled with the app.
 * These are imported from src/schemas/ at build time.
 * Returns typed PluginSchema objects.
 */
export function loadBuiltinSchemas(): PluginSchema[] {
  return builtinSchemas
}

// ============================================
// Global Schema CRUD
// ============================================

/**
 * Load all global schemas from the AppData schemas directory.
 */
export async function loadGlobalSchemas(): Promise<PluginSchema[]> {
  await ensureAppDir(APP_PATHS.GLOBAL_SCHEMAS)

  const entries = await listAppDir(APP_PATHS.GLOBAL_SCHEMAS)
  const schemas: PluginSchema[] = []

  for (const entry of entries) {
    if (entry.name.endsWith('.json')) {
      try {
        // Decode the storage key (filename without .json) back to the original schema ID.
        // encodeSchemaId is bijective, so decodeSchemaId is its exact inverse.
        // Existing kebab-case filenames decode to themselves (no-op).
        const storageKey = entry.name.replace(/\.json$/, '')
        const schemaId = decodeSchemaId(storageKey)
        const schemaPath = getGlobalSchemaFilePath(schemaId)
        const raw = await readAppFile<unknown>(schemaPath)

        const result = validateSchema(raw)
        if (!result.valid) {
          console.warn(
            `Skipping invalid global schema "${entry.name}": ${result.errors[0]?.message ?? 'unknown error'}`,
          )
          continue
        }

        const schema = raw as PluginSchema
        if (schema.id !== schemaId) {
          console.warn(
            `Skipping global schema "${entry.name}": schema.id "${schema.id}" does not match filename-derived ID "${schemaId}"`,
          )
          continue
        }
        schemas.push(schema)
      } catch {
        console.warn(`Skipping unreadable global schema file: ${entry.name}`)
      }
    }
  }

  return schemas
}

/**
 * Save a schema to the global schemas directory.
 */
export async function saveGlobalSchema(schema: PluginSchema): Promise<void> {
  const result = validateSchema(schema)
  if (!result.valid) {
    throw new Error(
      `Cannot save invalid schema: ${result.errors[0]?.message ?? 'unknown error'}`,
    )
  }
  await ensureAppDir(APP_PATHS.GLOBAL_SCHEMAS)
  const schemaPath = getGlobalSchemaFilePath(schema.id)
  await writeAppFile(schemaPath, schema)
}

/**
 * Delete a global schema by ID.
 */
export async function deleteGlobalSchema(schemaId: string): Promise<void> {
  const schemaPath = getGlobalSchemaFilePath(schemaId)
  await removeAppFile(schemaPath)
}

/**
 * Check if a global schema exists by ID.
 */
export async function globalSchemaExists(schemaId: string): Promise<boolean> {
  const schemaPath = getGlobalSchemaFilePath(schemaId)
  return appFileExists(schemaPath)
}

// ============================================
// Project Schema CRUD
// ============================================

/**
 * Load all project-local schemas from the project's schemas directory.
 */
export async function loadProjectSchemas(
  projectPath: string,
): Promise<PluginSchema[]> {
  await ensureProjectDir(projectPath, PROJECT_PATHS.SCHEMAS)

  const entries = await listProjectDir(projectPath, PROJECT_PATHS.SCHEMAS)
  const schemas: PluginSchema[] = []

  for (const entry of entries) {
    if (entry.name.endsWith('.json')) {
      try {
        // Decode the storage key (filename without .json) back to the original schema ID.
        // encodeSchemaId is bijective, so decodeSchemaId is its exact inverse.
        // Existing kebab-case filenames decode to themselves (no-op).
        const storageKey = entry.name.replace(/\.json$/, '')
        const schemaId = decodeSchemaId(storageKey)
        const schemaPath = getSchemaFilePath(schemaId)
        const raw = await readProjectFile<unknown>(projectPath, schemaPath)

        const result = validateSchema(raw)
        if (!result.valid) {
          console.warn(
            `Skipping invalid project schema "${entry.name}": ${result.errors[0]?.message ?? 'unknown error'}`,
          )
          continue
        }

        const schema = raw as PluginSchema
        if (schema.id !== schemaId) {
          console.warn(
            `Skipping project schema "${entry.name}": schema.id "${schema.id}" does not match filename-derived ID "${schemaId}"`,
          )
          continue
        }
        schemas.push(schema)
      } catch {
        console.warn(`Skipping unreadable project schema file: ${entry.name}`)
      }
    }
  }

  return schemas
}

/**
 * Save a schema to the project's schemas directory.
 */
export async function saveProjectSchema(
  projectPath: string,
  schema: PluginSchema,
): Promise<void> {
  const result = validateSchema(schema)
  if (!result.valid) {
    throw new Error(
      `Cannot save invalid schema: ${result.errors[0]?.message ?? 'unknown error'}`,
    )
  }
  await ensureProjectDir(projectPath, PROJECT_PATHS.SCHEMAS)
  const schemaPath = getSchemaFilePath(schema.id)
  await writeProjectFile(projectPath, schemaPath, schema)
}

/**
 * Delete a project-local schema by ID.
 */
export async function deleteProjectSchema(
  projectPath: string,
  schemaId: string,
): Promise<void> {
  const schemaPath = getSchemaFilePath(schemaId)
  await removeProjectFile(projectPath, schemaPath)
}

export async function projectSchemaExists(
  projectPath: string,
  schemaId: string,
): Promise<boolean> {
  return projectFileExists(projectPath, getSchemaFilePath(schemaId))
}

// ============================================
// Combined Resolution (Three-Tier Merging)
// ============================================

/**
 * Load all schemas with priority: project-local > global > built-in.
 * Later schemas override earlier ones by ID.
 * Returns resolved schemas with source tracking.
 */
export async function loadAllSchemas(
  projectPath: string,
): Promise<ResolvedSchema[]> {
  const builtin = loadBuiltinSchemas()
  const [global, project] = await Promise.all([
    loadGlobalSchemas(),
    loadProjectSchemas(projectPath),
  ])

  const schemaMap = new Map<string, ResolvedSchema>()

  for (const schema of builtin) {
    schemaMap.set(schema.id, { schema, source: 'builtin' })
  }
  for (const schema of global) {
    schemaMap.set(schema.id, { schema, source: 'global' })
  }
  for (const schema of project) {
    schemaMap.set(schema.id, { schema, source: 'project' })
  }

  return Array.from(schemaMap.values())
}

/**
 * Get the final merged schema list (deduplicated by ID, highest priority wins).
 */
export async function getResolvedSchemas(
  projectPath: string,
): Promise<PluginSchema[]> {
  const resolved = await loadAllSchemas(projectPath)
  return resolved.map((r) => r.schema)
}

// ============================================
// Plugin Config Persistence
// ============================================

const PLUGINS_CONFIG_FILE = 'plugins.json'
// Retained as a file-format marker only. Pre-public plugin-schema refactors do
// not run plugin-specific runtime-compat migrations; manual reset/update is the
// supported path for older private data.
export const CURRENT_PLUGIN_CONFIG_VERSION = 2
const pluginWriteQueues = new Map<string, Promise<void>>()

function getPluginWriteQueueKey(projectPath: string, schemaId: string): string {
  return `${projectPath}::${schemaId}`
}

function enqueuePluginWrite<T>(
  queueKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = pluginWriteQueues.get(queueKey) ?? Promise.resolve()

  const result = previous.catch(() => undefined).then(operation)
  const current = result.then(() => undefined)
  pluginWriteQueues.set(queueKey, current)

  return result.finally(() => {
    if (pluginWriteQueues.get(queueKey) === current) {
      pluginWriteQueues.delete(queueKey)
    }
  })
}

export function _resetPluginWriteQueueTestState(): void {
  pluginWriteQueues.clear()
}

/** @deprecated Use _resetPluginWriteQueueTestState instead. */
export function _resetLuaFieldOverrideQueueTestState(): void {
  _resetPluginWriteQueueTestState()
}

/**
 * Versioned wrapper format for plugins.json (v1+).
 * Before migration: bare array (v0).
 * After migration: { configVersion, plugins } (v1+).
 */
interface PluginsFile {
  configVersion: number
  plugins: unknown[]
}

type NormalizeInstallOverrideResult =
  | {
      readonly success: true
      readonly override: PluginInstallOverride | undefined
    }
  | { readonly success: false; readonly reason: string }

/**
 * Check if an error message indicates a permission/access error.
 * Uses case-insensitive matching for cross-platform compatibility.
 *
 * Matches:
 *   - Generic: 'permission', 'access denied', 'not authorized'
 *   - Unix codes: 'EACCES', 'EPERM'
 *   - Windows: 'requires elevation', 'operation not permitted', 'error 5', 'errno 13'
 */
function isPermissionError(message: string): boolean {
  const normalized = message.toLowerCase()
  const patterns = [
    'permission',
    'eacces',
    'eperm',
    'access denied',
    'operation not permitted',
    'requires elevation',
    'not authorized',
    'error 5',
    'errno 13',
  ]
  return patterns.some((p) => normalized.includes(p))
}

/**
 * Normalize a single InstalledPlugin entry from disk.
 * Returns null if the entry is too malformed to recover.
 */
export function normalizeInstalledPlugin(raw: unknown): InstalledPlugin | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>

  const schemaId = record['schemaId']
  if (typeof schemaId !== 'string' || schemaId.trim().length === 0) return null

  let luaFieldOverrides: Record<string, boolean> | undefined
  let installOverride: PluginInstallOverride | undefined
  const rawOverrides = record['luaFieldOverrides']
  if (
    typeof rawOverrides === 'object' &&
    rawOverrides !== null &&
    !Array.isArray(rawOverrides)
  ) {
    const normalizedOverrides: Record<string, boolean> = {}
    let hasEntries = false

    for (const [key, value] of Object.entries(
      rawOverrides as Record<string, unknown>,
    )) {
      if (typeof value === 'boolean') {
        normalizedOverrides[key] = value
        hasEntries = true
      }
    }

    if (hasEntries) {
      luaFieldOverrides = normalizedOverrides
    }
  }

  const installOverrideResult = normalizePluginInstallOverride(
    record['installOverride'],
  )
  if (installOverrideResult.success) {
    installOverride = installOverrideResult.override
  } else {
    console.warn(
      `Dropping malformed installOverride for plugin "${schemaId}": ${installOverrideResult.reason}`,
    )
  }

  return {
    schemaId,
    enabled: typeof record['enabled'] === 'boolean' ? record['enabled'] : true,
    config:
      typeof record['config'] === 'object' &&
      record['config'] !== null &&
      !Array.isArray(record['config'])
        ? (record['config'] as Record<string, PluginConfigValue>)
        : {},
    addedAt:
      typeof record['addedAt'] === 'number' ? record['addedAt'] : Date.now(),
    ...(luaFieldOverrides !== undefined && { luaFieldOverrides }),
    ...(installOverride !== undefined && { installOverride }),
  }
}

function normalizePluginInstallVersionOverride(
  raw: unknown,
): PluginInstallVersionOverride | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined
  }

  const record = raw as Record<string, unknown>
  const rawMode = record['mode']
  if (rawMode !== 'semver-range' && rawMode !== 'ref') {
    return undefined
  }

  const normalizedValue = normalizeInstallVersionValue(record['value'])
  if (normalizedValue === null) {
    return undefined
  }

  if (rawMode === 'semver-range') {
    return {
      mode: 'semver-range',
      value: normalizedValue,
    }
  }

  const rawRefKind = record['refKind']
  const normalizedRefKind: PluginInstallRefKind = isPluginInstallRefKind(
    rawRefKind,
  )
    ? rawRefKind
    : inferPluginInstallRefKind(normalizedValue)

  if (
    normalizedRefKind === 'commit' &&
    !/^[0-9a-fA-F]{7,40}$/.test(normalizedValue)
  ) {
    return undefined
  }

  return {
    mode: 'ref',
    refKind: normalizedRefKind,
    value: normalizedValue,
  }
}

function normalizePluginInstallOverride(
  raw: unknown,
): NormalizeInstallOverrideResult {
  if (raw === undefined || raw === null) {
    return { success: true, override: undefined }
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      success: false,
      reason: 'installOverride must be an object when provided',
    }
  }

  const record = raw as Record<string, unknown>
  const name = normalizeInstallOverrideName(record['name'])
  const version = normalizePluginInstallVersionOverride(record['version'])

  if (
    name === undefined &&
    record['name'] !== undefined &&
    typeof record['name'] !== 'string'
  ) {
    return {
      success: false,
      reason: 'installOverride.name must be a string when provided',
    }
  }

  if (
    version === undefined &&
    record['version'] !== undefined &&
    record['version'] !== null
  ) {
    return {
      success: false,
      reason: 'installOverride.version is invalid',
    }
  }

  if (name === undefined && version === undefined) {
    return { success: true, override: undefined }
  }

  return {
    success: true,
    override: {
      ...(name !== undefined && { name }),
      ...(version !== undefined && { version }),
    },
  }
}

function validatePluginInstallOverrideForWrite(
  raw: PluginInstallOverride,
): NormalizeInstallOverrideResult {
  const name = normalizeInstallOverrideName(raw.name)
  const versionResult =
    raw.version !== undefined
      ? validatePluginInstallVersionOverride(raw.version)
      : undefined

  if (raw.name !== undefined && name === undefined) {
    return {
      success: false,
      reason: 'Install override name must be a non-empty string.',
    }
  }

  if (versionResult !== undefined && !versionResult.success) {
    return { success: false, reason: versionResult.reason }
  }

  const version =
    versionResult?.success === true ? versionResult.version : undefined

  if (name === undefined && version === undefined) {
    return { success: true, override: undefined }
  }

  return {
    success: true,
    override: {
      ...(name !== undefined && { name }),
      ...(version !== undefined && { version }),
    },
  }
}

/**
 * Load installed plugin configurations for a project.
 *
 * Returns a discriminated result to distinguish between:
 * - Normal load (file exists, valid JSON)
 * - First run (file doesn't exist — expected, return empty)
 * - Corruption (file exists but invalid JSON)
 * - Permission error (file exists but can't be read)
 *
 * If the stored format is v0 (bare array), runs the plugin-keymap migration
 * and rewrites the file as v1 so the migration never runs again.
 * Schemas must be passed in to support migration (needed to identify plugin-keymap options).
 */
export async function loadInstalledPlugins(
  projectPath: string,
  schemas?: PluginSchema[],
): Promise<PluginLoadResult> {
  // Check if file exists first
  const exists = await projectFileExists(projectPath, PLUGINS_CONFIG_FILE)
  if (!exists) {
    return { status: 'file-not-found', plugins: [] }
  }

  // File exists — any error here is a real problem
  try {
    const data = await readProjectFile<unknown>(
      projectPath,
      PLUGINS_CONFIG_FILE,
    )

    // Determine config version and raw plugin array
    let configVersion: number
    let rawPlugins: unknown[]

    if (Array.isArray(data)) {
      // Legacy format: bare array, no version
      configVersion = 0
      rawPlugins = data
    } else if (
      typeof data === 'object' &&
      data !== null &&
      'plugins' in data &&
      Array.isArray((data as { plugins?: unknown }).plugins)
    ) {
      const versioned = data as { configVersion?: unknown; plugins: unknown[] }
      configVersion =
        typeof versioned.configVersion === 'number'
          ? versioned.configVersion
          : 0
      rawPlugins = versioned.plugins
    } else {
      return {
        status: 'corrupted',
        error: `Expected array or { configVersion, plugins }, got ${typeof data}`,
        plugins: [],
      }
    }

    // Normalize each entry (filter out malformed entries)
    const plugins: InstalledPlugin[] = []
    for (const entry of rawPlugins) {
      const normalized = normalizeInstalledPlugin(entry)
      if (normalized !== null) {
        plugins.push(normalized)
      }
    }

    // Run pending migrations in version order, then persist once.
    let migratedPlugins = plugins

    if (configVersion < PLUGIN_KEYMAP_MIGRATION_VERSION) {
      const schemaMap = new Map((schemas ?? []).map((s) => [s.id, s]))
      migratedPlugins = migratePluginKeymapConfig(migratedPlugins, schemaMap)
    }

    if (configVersion < CURRENT_PLUGIN_CONFIG_VERSION) {
      const latestFile: PluginsFile = {
        configVersion: CURRENT_PLUGIN_CONFIG_VERSION,
        plugins: migratedPlugins,
      }
      await writeProjectFile(projectPath, PLUGINS_CONFIG_FILE, latestFile)

      return { status: 'loaded', plugins: migratedPlugins }
    }

    return { status: 'loaded', plugins: migratedPlugins }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Try to distinguish permission errors from parse errors
    if (isPermissionError(message)) {
      return { status: 'permission-denied', error: message, plugins: [] }
    }

    return { status: 'corrupted', error: message, plugins: [] }
  }
}

/**
 * Load installed plugins for CRUD operations.
 * Returns empty array on any error (CRUD should not fail on load errors).
 */
async function loadPluginsForCrud(
  projectPath: string,
): Promise<InstalledPlugin[]> {
  const result = await loadInstalledPlugins(projectPath)
  return result.plugins
}

/**
 * Save installed plugin configurations in versioned format (v1).
 */
export async function saveInstalledPlugins(
  projectPath: string,
  plugins: InstalledPlugin[],
): Promise<void> {
  const v1File: PluginsFile = {
    configVersion: CURRENT_PLUGIN_CONFIG_VERSION,
    plugins,
  }
  await writeProjectFile(projectPath, PLUGINS_CONFIG_FILE, v1File)
}

/**
 * Add or update a plugin's installation and config.
 */
export async function installPlugin(
  projectPath: string,
  schemaId: string,
  config?: Record<string, PluginConfigValue>,
): Promise<InstalledPlugin> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)
  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const existing = plugins.find((p) => p.schemaId === schemaId)

    if (existing) {
      existing.config = config ?? existing.config
      existing.enabled = true
      await saveInstalledPlugins(projectPath, plugins)
      return existing
    }

    const newPlugin: InstalledPlugin = {
      schemaId,
      enabled: true,
      config: config ?? {},
      addedAt: Date.now(),
    }
    plugins.push(newPlugin)
    await saveInstalledPlugins(projectPath, plugins)
    return newPlugin
  })
}

/**
 * Remove a plugin from the project.
 */
export async function uninstallPlugin(
  projectPath: string,
  schemaId: string,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)
  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const filtered = plugins.filter(
      (p: InstalledPlugin) => p.schemaId !== schemaId,
    )
    await saveInstalledPlugins(projectPath, filtered)
  })
}

/**
 * Update a plugin's config values.
 */
export async function updatePluginConfig(
  projectPath: string,
  schemaId: string,
  config: Record<string, PluginConfigValue>,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)

  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin) {
      plugin.config = config
      await saveInstalledPlugins(projectPath, plugins)
    }
  })
}

/**
 * Update explicit include/exclude override for a lua option field.
 */
export async function updateLuaFieldOverride(
  projectPath: string,
  schemaId: string,
  optionKey: string,
  include: boolean,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)

  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin === undefined) {
      return
    }

    if (plugin.luaFieldOverrides === undefined) {
      plugin.luaFieldOverrides = {}
    }
    plugin.luaFieldOverrides[optionKey] = include
    await saveInstalledPlugins(projectPath, plugins)
  })
}

export async function updatePluginInstallOverride(
  projectPath: string,
  schemaId: string,
  override: PluginInstallOverride,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)

  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin === undefined) {
      return
    }

    const validationResult = validatePluginInstallOverrideForWrite(override)
    if (!validationResult.success) {
      throw new Error(validationResult.reason)
    }

    if (validationResult.override === undefined) {
      delete plugin.installOverride
    } else {
      plugin.installOverride = validationResult.override
    }

    await saveInstalledPlugins(projectPath, plugins)
  })
}

export async function clearPluginInstallOverride(
  projectPath: string,
  schemaId: string,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)

  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin === undefined) {
      return
    }

    delete plugin.installOverride
    await saveInstalledPlugins(projectPath, plugins)
  })
}

/**
 * Clear explicit include/exclude override for a lua option field.
 */
export async function clearLuaFieldOverride(
  projectPath: string,
  schemaId: string,
  optionKey: string,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)

  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin === undefined || plugin.luaFieldOverrides === undefined) {
      return
    }

    delete plugin.luaFieldOverrides[optionKey]
    if (Object.keys(plugin.luaFieldOverrides).length === 0) {
      delete plugin.luaFieldOverrides
    }

    await saveInstalledPlugins(projectPath, plugins)
  })
}

/**
 * Toggle a plugin's enabled state.
 */
export async function togglePlugin(
  projectPath: string,
  schemaId: string,
  enabled: boolean,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)
  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin) {
      plugin.enabled = enabled
      await saveInstalledPlugins(projectPath, plugins)
    }
  })
}

export async function resetPluginToDefaults(
  projectPath: string,
  schemaId: string,
  defaults: Record<string, PluginConfigValue>,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)
  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin === undefined) {
      return
    }

    plugin.config = defaults
    delete plugin.luaFieldOverrides
    await saveInstalledPlugins(projectPath, plugins)
  })
}

export async function resetPluginOption(
  projectPath: string,
  schemaId: string,
  optionPath: string,
  nextConfig: Record<string, PluginConfigValue>,
): Promise<void> {
  const queueKey = getPluginWriteQueueKey(projectPath, schemaId)
  return enqueuePluginWrite(queueKey, async () => {
    const plugins = await loadPluginsForCrud(projectPath)
    const plugin = plugins.find((p: InstalledPlugin) => p.schemaId === schemaId)
    if (plugin === undefined) {
      return
    }

    plugin.config = nextConfig
    if (plugin.luaFieldOverrides !== undefined) {
      delete plugin.luaFieldOverrides[optionPath]
      if (Object.keys(plugin.luaFieldOverrides).length === 0) {
        delete plugin.luaFieldOverrides
      }
    }

    await saveInstalledPlugins(projectPath, plugins)
  })
}

// ============================================
// Export Standalone
// ============================================

export type ExportStandaloneResult =
  | { success: true; copied: string[]; alreadyLocal: string[] }
  | { success: false; error: string }

/**
 * Export project as standalone by copying used global schemas to project-local.
 * Built-in schemas don't need copying (always available).
 */
export async function exportStandalone(
  projectPath: string,
  usedSchemaIds: string[],
): Promise<ExportStandaloneResult> {
  try {
    const globalSchemas = await loadGlobalSchemas()
    const projectSchemas = await loadProjectSchemas(projectPath)
    const projectSchemaIds = new Set(projectSchemas.map((s) => s.id))
    const copied: string[] = []
    const alreadyLocal: string[] = []

    for (const schemaId of usedSchemaIds) {
      if (projectSchemaIds.has(schemaId)) {
        alreadyLocal.push(schemaId)
        continue
      }
      const globalSchema = globalSchemas.find((s) => s.id === schemaId)
      if (globalSchema) {
        await saveProjectSchema(projectPath, globalSchema)
        copied.push(schemaId)
      }
      // Built-in schemas don't need copying (always available)
    }

    return { success: true, copied, alreadyLocal }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
