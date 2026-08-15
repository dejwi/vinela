import type {
  InstalledPlugin,
  PluginConfigValue,
  PluginSchema,
} from '@/shared/types'

/**
 * Migration version this module handles.
 * When configVersion < PLUGIN_KEYMAP_MIGRATION_VERSION, this migration runs.
 */
export const PLUGIN_KEYMAP_MIGRATION_VERSION = 1

/**
 * Migrate old-format keymap configs to the new plugin-keymap format.
 *
 * Old format (two separate options):
 *   config["keymap.preset"] = "default"   (from a 'select' option)
 *   config["keymap"] = "..."              (from a 'lua' option, raw Lua string)
 *
 * New format (single plugin-keymap option):
 *   config["keymap"] = { preset: "default" }
 *
 * This migration is DESTRUCTIVE: raw Lua keymap values are deleted.
 * The user's preset selection is preserved if it matches a valid preset.
 */
export function migratePluginKeymapConfig(
  plugins: InstalledPlugin[],
  schemas: Map<string, PluginSchema>,
): InstalledPlugin[] {
  return plugins.map((plugin) => {
    const schema = schemas.get(plugin.schemaId)
    if (!schema) return plugin

    let configChanged = false
    const config: Record<string, PluginConfigValue> = { ...plugin.config }

    for (const option of schema.options) {
      if (option.type !== 'plugin-keymap') continue

      const presetKey = `${option.key}.preset`

      // Case 1: Old separate preset key exists
      if (config[presetKey] !== undefined) {
        const oldPreset = config[presetKey]
        const validPresetIds = new Set(option.presets.map((p) => p.id))

        if (typeof oldPreset === 'string' && validPresetIds.has(oldPreset)) {
          config[option.key] = { preset: oldPreset } as PluginConfigValue
        } else {
          // Invalid preset — fall back to schema default (omit key, let resolver handle it)
          delete config[option.key]
        }

        delete config[presetKey]
        configChanged = true
      }

      // Case 2: Old value is a raw Lua string (from 'lua' type option)
      if (typeof config[option.key] === 'string') {
        // Destructive: delete the raw Lua, fall back to defaults
        delete config[option.key]
        configChanged = true
      }
    }

    if (configChanged) {
      return { ...plugin, config }
    }
    return plugin
  })
}
