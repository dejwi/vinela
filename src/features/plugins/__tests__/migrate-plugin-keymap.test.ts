import { describe, expect, it } from 'vitest'

import type { InstalledPlugin, PluginSchema } from '@/shared/types'
import {
  migratePluginKeymapConfig,
  PLUGIN_KEYMAP_MIGRATION_VERSION,
} from '../migrations/migrate-plugin-keymap'

// ============================================
// Helpers
// ============================================

function makePlugin(overrides?: Partial<InstalledPlugin>): InstalledPlugin {
  return {
    schemaId: 'blink-cmp',
    enabled: true,
    config: {},
    addedAt: 1000,
    ...overrides,
  }
}

/** Minimal schema with a plugin-keymap option keyed 'keymap' */
function makeSchemaWithKeymap(
  schemaOverrides?: Partial<PluginSchema>,
): PluginSchema {
  return {
    id: 'blink-cmp',
    pluginName: 'blink.cmp',
    pluginRepo: 'https://github.com/saghen/blink.cmp',
    version: '1.0.0',
    functions: [],
    options: [
      {
        key: 'keymap',
        label: 'Keymaps',
        type: 'plugin-keymap',
        defaultPreset: 'default',
        allowDisable: true,
        commands: [
          { name: 'accept', label: 'Accept' },
          { name: 'cancel', label: 'Cancel' },
          { name: 'fallback', label: 'Fallback', isTerminal: true },
        ],
        presets: [
          {
            id: 'default',
            label: 'Default',
            mappings: { '<CR>': ['accept', 'fallback'] },
          },
          { id: 'enter', label: 'Enter', mappings: { '<CR>': ['accept'] } },
          { id: 'none', label: 'None', mappings: {} },
        ],
      },
    ],
    ...schemaOverrides,
  }
}

// ============================================
// Constants
// ============================================

describe('PLUGIN_KEYMAP_MIGRATION_VERSION', () => {
  it('is 1', () => {
    expect(PLUGIN_KEYMAP_MIGRATION_VERSION).toBe(1)
  })
})

// ============================================
// Migration logic
// ============================================

describe('migratePluginKeymapConfig', () => {
  it('returns plugins unchanged when no schema is found', () => {
    const plugin = makePlugin({
      schemaId: 'unknown-plugin',
      config: { 'keymap.preset': 'default' },
    })
    const schemas = new Map<string, PluginSchema>()

    const result = migratePluginKeymapConfig([plugin], schemas)
    expect(result).toHaveLength(1)
    expect(result[0]?.config).toEqual({ 'keymap.preset': 'default' })
  })

  it('returns plugins unchanged when schema has no plugin-keymap options', () => {
    const plugin = makePlugin({ config: { theme: 'dark' } })
    const schema: PluginSchema = {
      id: 'blink-cmp',
      pluginName: 'blink.cmp',
      pluginRepo: 'https://github.com/saghen/blink.cmp',
      version: '1.0.0',
      functions: [],
      options: [
        { key: 'theme', label: 'Theme', type: 'string', default: 'dark' },
      ],
    }
    const schemas = new Map([['blink-cmp', schema]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    expect(result[0]?.config).toEqual({ theme: 'dark' })
  })

  it('converts old keymap.preset select key to new plugin-keymap format', () => {
    const plugin = makePlugin({
      config: { 'keymap.preset': 'enter' },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    expect(result[0]?.config['keymap']).toEqual({ preset: 'enter' })
    expect(result[0]?.config['keymap.preset']).toBeUndefined()
  })

  it('preserves valid preset selection', () => {
    const plugin = makePlugin({ config: { 'keymap.preset': 'none' } })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    expect(result[0]?.config['keymap']).toEqual({ preset: 'none' })
  })

  it('falls back to defaults for invalid preset (deletes keymap key)', () => {
    const plugin = makePlugin({
      config: { 'keymap.preset': 'super-tab-not-in-schema' },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    // Invalid preset → key deleted (resolver will use defaultPreset at runtime)
    expect(result[0]?.config['keymap']).toBeUndefined()
    expect(result[0]?.config['keymap.preset']).toBeUndefined()
  })

  it('deletes old raw Lua keymap string values (destructive migration)', () => {
    const plugin = makePlugin({
      config: {
        keymap: 'return { ["<CR>"] = { "accept", "fallback" } }',
      },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    expect(result[0]?.config['keymap']).toBeUndefined()
  })

  it('handles both old preset key and old lua value (preset key takes precedence)', () => {
    const plugin = makePlugin({
      config: {
        'keymap.preset': 'enter',
        keymap: 'return { ["<CR>"] = { "accept" } }',
      },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    // keymap.preset sets keymap, then the raw lua check sees config['keymap'] = { preset: 'enter' }
    // which is NOT a string, so it won't be deleted
    expect(result[0]?.config['keymap']).toEqual({ preset: 'enter' })
    expect(result[0]?.config['keymap.preset']).toBeUndefined()
  })

  it('does not modify plugins that have no old-format keys', () => {
    const plugin = makePlugin({
      config: { keymap: { preset: 'default' } },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    // keymap is already an object (not a string), nothing changed
    expect(result[0]).toBe(plugin) // same reference — no copy made
  })

  it('migrates multiple plugins independently', () => {
    const plugin1 = makePlugin({
      schemaId: 'blink-cmp',
      config: { 'keymap.preset': 'enter' },
    })
    const plugin2 = makePlugin({
      schemaId: 'other-plugin',
      config: { theme: 'dark' },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin1, plugin2], schemas)
    expect(result).toHaveLength(2)
    expect(result[0]?.config['keymap']).toEqual({ preset: 'enter' })
    expect(result[1]?.config).toEqual({ theme: 'dark' }) // unchanged
  })

  it('is idempotent on already-migrated data (new format, no old keys)', () => {
    const plugin = makePlugin({
      config: {
        keymap: { preset: 'default', overrides: { '<CR>': ['accept'] } },
      },
    })
    const schemas = new Map([['blink-cmp', makeSchemaWithKeymap()]])

    const result = migratePluginKeymapConfig([plugin], schemas)
    // No old-format keys found → no changes → returns same reference
    expect(result[0]).toBe(plugin)
  })

  it('handles empty plugin list', () => {
    const result = migratePluginKeymapConfig([], new Map())
    expect(result).toEqual([])
  })
})
