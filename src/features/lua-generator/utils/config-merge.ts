import type {
  PluginConfigValue,
  PluginSchema,
  SchemaOption,
} from '@/shared/types'
import { jsonDeepClone } from './json-clone'

/**
 * Merge schema option defaults with user config overrides.
 *
 * InstalledPlugin.config stores only user-modified values. This function
 * produces a complete config by starting with schema defaults and overlaying
 * user overrides.
 *
 * @param schema - The plugin schema defining available options and defaults
 * @param userConfig - User's configured values (only modified keys)
 * @returns Complete config with all options that have values
 */
export function mergePluginConfig(
  schema: PluginSchema,
  userConfig: Record<string, PluginConfigValue>,
): Record<string, PluginConfigValue> {
  const merged: Record<string, PluginConfigValue> = {}

  for (const option of schema.options) {
    // User override takes priority
    const userValue = userConfig[option.key]
    if (userValue !== undefined) {
      merged[option.key] = userValue
      continue
    }

    // Fall back to schema default
    const defaultValue = getOptionDefault(option)
    if (defaultValue !== undefined) {
      // Create a deep copy of arrays and objects to avoid mutation
      if (
        Array.isArray(defaultValue) ||
        (typeof defaultValue === 'object' && defaultValue !== null)
      ) {
        merged[option.key] = jsonDeepClone(defaultValue) as PluginConfigValue
      } else {
        merged[option.key] = defaultValue
      }
    }
    // If no user value and no default, omit the key entirely
  }

  return merged
}

/**
 * Extract the default value from a schema option.
 * Returns undefined if no default is defined.
 */
function getOptionDefault(option: SchemaOption): PluginConfigValue | undefined {
  // All option types have a `default` field (though it's optional)
  // Use discriminated union to access type-specific defaults
  switch (option.type) {
    case 'string':
    case 'color':
    case 'keysequence':
    case 'lua':
      return option.default
    case 'number':
      return option.default
    case 'boolean':
      return option.default
    case 'select':
      return option.default
    case 'array':
      return option.default !== undefined
        ? (option.default as PluginConfigValue[])
        : undefined
    case 'mapping-table':
      return option.default !== undefined
        ? (option.default as PluginConfigValue[])
        : undefined
    case 'object':
      return option.default !== undefined
        ? (option.default as Record<string, PluginConfigValue>)
        : undefined
    case 'plugin-keymap':
      // Default is derived from defaultPreset, not a static value.
      // Return a minimal object with just the default preset so that
      // the transform step can process it.
      return { preset: option.defaultPreset } as PluginConfigValue
    default:
      return undefined
  }
}

/**
 * Unflatten dot-notation keys into nested objects.
 *
 * Schema options use dot-notation keys like "defaults.layout_config.width"
 * which must become nested Lua tables for setup() calls.
 *
 * Input:  { "defaults.layout_config.width": 0.5, "defaults.prompt_prefix": ">" }
 * Output: { defaults: { layout_config: { width: 0.5 }, prompt_prefix: ">" } }
 *
 * @param flatConfig - Flat key-value map with dot-notation keys
 * @returns Nested object structure
 *
 * @throws Error if a key collision is detected (e.g., both "foo" and "foo.bar" exist
 *         and "foo" is not an object)
 */
export function unflattenDotKeys<V>(
  flatConfig: Record<string, V>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Sort keys by depth (fewer dots first) to establish parent objects
  // before children. This ensures "foo" is set before "foo.bar".
  const sortedKeys = Object.keys(flatConfig).sort(
    (a, b) => countDots(a) - countDots(b),
  )

  for (const key of sortedKeys) {
    const value = flatConfig[key]

    // No dots → top-level key
    if (!key.includes('.')) {
      if (
        result[key] !== undefined &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        // Parent already exists as object from a child key — merge rather than overwrite
        // This handles the case where "foo.bar" was processed before "foo"
        // In sorted order this shouldn't happen, but guard anyway
        continue
      }
      result[key] = value
      continue
    }

    // Split into segments and build nested structure
    const segments = key.split('.')
    let current: Record<string, unknown> = result

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      if (segment === undefined) {
        throw new Error(
          `Invariant: segment at index ${i} is undefined in bounded loop`,
        )
      }
      const existing = current[segment]

      if (existing === undefined) {
        // Create intermediate object
        const next: Record<string, unknown> = {}
        current[segment] = next
        current = next
      } else if (
        typeof existing === 'object' &&
        existing !== null &&
        !Array.isArray(existing)
      ) {
        // Traverse into existing object
        current = existing as Record<string, unknown>
      } else {
        // Collision: parent key has a scalar value but child key needs it to be an object
        // Example: both "foo" = "bar" and "foo.baz" = 1 exist
        // In this case, the child key wins (wrap the scalar in an intermediate)
        throw new Error(
          `Config key collision: "${segments.slice(0, i + 1).join('.')}" is a scalar value ` +
            `but "${key}" requires it to be an object. Check schema option keys for conflicts.`,
        )
      }
    }

    const lastSegment = segments[segments.length - 1]
    if (lastSegment === undefined) {
      throw new Error('Invariant: empty segments array after split')
    }
    current[lastSegment] = value
  }

  return result
}

function countDots(s: string): number {
  let count = 0
  for (const ch of s) {
    if (ch === '.') count++
  }
  return count
}

/**
 * Transform a plugin-keymap config value from its stored JSON shape
 * to the flat Lua table shape expected by the plugin.
 *
 * Input (stored JSON):
 *   { preset: "default", overrides: { "<CR>": ["accept", "fallback"], "<C-e>": false } }
 *
 * Output (Lua-ready object):
 *   { preset: "default", "<CR>": ["accept", "fallback"], "<C-e>": false }
 */
export function flattenPluginKeymapValue(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Copy preset
  if (typeof value['preset'] === 'string') {
    result['preset'] = value['preset']
  }

  // Flatten overrides into top-level keys
  const overrides = value['overrides']
  if (
    overrides !== null &&
    overrides !== undefined &&
    typeof overrides === 'object' &&
    !Array.isArray(overrides)
  ) {
    for (const [key, commands] of Object.entries(
      overrides as Record<string, unknown>,
    )) {
      result[key] = commands
    }
  }

  return result
}
