import type {
  InstalledPlugin,
  PluginSchema,
  ProjectProfile,
  ResolvedSchema,
} from '@/shared/types'
import { resolveKeymapActivation } from '../profile-inclusion'
import type { ProjectKeymap } from '../types'

/**
 * Validates PROJECT keymaps (manual keymaps from keymaps.json) against
 * plugin/schema state.
 *
 * NOTE: Graph-sourced keymaps (from set-keymap nodes) are NOT validated here.
 * Those are validated at edit-time in the graph editor. Full validation of
 * graph-sourced keymaps (checking plugin references in command strings) is
 * deferred to Step 10 as it requires command parsing and graph tracking.
 */

/**
 * Validation issue found on a keymap.
 */
export interface KeymapValidationIssue {
  /** The keymap that has the issue */
  keymapId: string
  /** Severity of the issue */
  level: 'error' | 'warning'
  /** Human-readable message */
  message: string
  /** Machine-readable code for programmatic handling */
  code: KeymapValidationCode
}

export type KeymapValidationCode =
  | 'plugin-not-installed' // Plugin referenced but not in installed list
  | 'plugin-disabled' // Plugin installed but disabled
  | 'schema-missing' // Plugin's schema not found in loaded schemas
  | 'function-missing' // Function not found in the plugin's schema
  | 'empty-function-key' // selectedFunctionKey is empty
  | 'empty-graph-id' // run-custom-action has empty graphId

/**
 * Validate all project keymaps against current plugin/schema state.
 *
 * Checks each keymap's action for references to plugins/functions
 * that no longer exist or are disabled.
 *
 * @param keymaps - Project keymaps to validate
 * @param installedPlugins - Currently installed plugins
 * @param schemas - Currently loaded schemas (resolved)
 * @returns Array of validation issues (empty = all valid)
 */
export function validateKeymapReferences(
  keymaps: readonly ProjectKeymap[],
  installedPlugins: readonly InstalledPlugin[],
  schemas: readonly ResolvedSchema[],
  profiles: readonly ProjectProfile[],
  activeProfileIds: ReadonlySet<string>,
): KeymapValidationIssue[] {
  const issues: KeymapValidationIssue[] = []

  // Build lookup maps for O(1) access
  const installedMap = new Map(installedPlugins.map((p) => [p.schemaId, p]))
  const schemaMap = new Map(schemas.map((r) => [r.schema.id, r.schema]))

  for (const keymap of keymaps) {
    if (!resolveKeymapActivation(keymap, profiles, activeProfileIds).enabled)
      continue

    const action = keymap.action

    if (action.actionType === 'run-function') {
      validateRunFunctionAction(keymap, action, installedMap, schemaMap, issues)
    } else if (action.actionType === 'run-custom-action') {
      // Validate graph reference exists (basic check)
      if (!action.graphId || action.graphId.trim().length === 0) {
        issues.push({
          keymapId: keymap.id,
          level: 'warning',
          message: `Keymap "${keymap.description || keymap.keySequence}" references a custom action with no graph ID`,
          code: 'empty-graph-id',
        })
      }
    }
  }

  return issues
}

function validateRunFunctionAction(
  keymap: ProjectKeymap,
  action: ProjectKeymap['action'] & { actionType: 'run-function' },
  installedMap: Map<string, InstalledPlugin>,
  schemaMap: Map<string, PluginSchema>,
  issues: KeymapValidationIssue[],
): void {
  const keymapLabel = keymap.description || keymap.keySequence

  // Check for empty function key
  if (
    !action.selectedFunctionKey ||
    action.selectedFunctionKey.trim().length === 0
  ) {
    issues.push({
      keymapId: keymap.id,
      level: 'warning',
      message: `Keymap "${keymapLabel}" has a run-function action with no function selected`,
      code: 'empty-function-key',
    })
    return
  }

  // Only validate plugin-sourced functions (core functions are always available)
  if (action.functionSource.type !== 'plugin') return

  const { pluginId, functionName } = action.functionSource

  // Check if plugin is installed
  const installed = installedMap.get(pluginId)
  if (!installed) {
    issues.push({
      keymapId: keymap.id,
      level: 'error',
      message: `Keymap "${keymapLabel}" references function "${functionName}" from plugin "${pluginId}" which is not installed`,
      code: 'plugin-not-installed',
    })
    return
  }

  // Check if plugin is disabled
  if (!installed.enabled) {
    issues.push({
      keymapId: keymap.id,
      level: 'warning',
      message: `Keymap "${keymapLabel}" references function "${functionName}" from disabled plugin "${pluginId}"`,
      code: 'plugin-disabled',
    })
  }

  // Check if schema exists
  const schema = schemaMap.get(pluginId)
  if (!schema) {
    issues.push({
      keymapId: keymap.id,
      level: 'warning',
      message: `Keymap "${keymapLabel}" references plugin "${pluginId}" whose schema is missing`,
      code: 'schema-missing',
    })
    return
  }

  // Check if function exists in schema
  const fnExists = schema.functions.some((f) => f.name === functionName)
  if (!fnExists) {
    issues.push({
      keymapId: keymap.id,
      level: 'warning',
      message: `Keymap "${keymapLabel}" references function "${functionName}" which no longer exists in plugin "${pluginId}"`,
      code: 'function-missing',
    })
  }
}

/**
 * Get validation issues for a single keymap.
 * Convenience wrapper for UI display.
 */
export function getKeymapIssues(
  keymapId: string,
  allIssues: readonly KeymapValidationIssue[],
): readonly KeymapValidationIssue[] {
  return allIssues.filter((issue) => issue.keymapId === keymapId)
}

/**
 * Check if any keymap has errors (not just warnings).
 */
export function hasKeymapErrors(
  issues: readonly KeymapValidationIssue[],
): boolean {
  return issues.some((issue) => issue.level === 'error')
}
