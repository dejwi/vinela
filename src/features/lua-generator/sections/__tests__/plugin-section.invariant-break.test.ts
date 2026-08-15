import { describe, expect, it } from 'vitest'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '../../types'
import { generatePluginSection } from '../plugin-section'

describe('generatePluginSection invariant break handling', () => {
  it('returns null setup path with explicit diagnostic in synthetic corruption harness when raw Lua reaches plugin-keymap slot', () => {
    const pluginName = 'P'
    const key = 'K'
    const schemaId = 'schema-p'

    // intentional synthetic corruption harness (test-only)
    const corruptedSlotFixture: ResolvedPluginForGeneration = {
      plugin: {
        id: 'plugin-p',
        schemaId,
        enabled: true,
        config: {},
        luaFieldOverrides: { [key]: true },
      },
      schema: {
        id: schemaId,
        pluginName,
        pluginRepo: 'owner/p',
        version: '1.0.0',
        setup: { requirePath: 'p' },
        functions: [],
        options: [
          {
            key,
            label: 'Keymap',
            type: 'plugin-keymap',
            defaultPreset: 'default',
            commands: [{ name: 'accept', label: 'Accept' }],
            presets: [
              {
                id: 'default',
                label: 'Default',
                mappings: { '<CR>': ['accept'] },
              },
            ],
          },
          {
            key,
            label: 'Lua',
            type: 'lua',
            emitKey: 'K_raw',
            default: 'function() return true end',
          },
        ],
      },
    }

    const input: PluginSectionInput = {
      resolvedPlugins: [corruptedSlotFixture],
      themePluginIds: new Set<string>(),
    }

    const result = generatePluginSection(input)

    expect(result.code.join('\n')).not.toContain('require("p").setup(')
    expect(result.diagnostics).toHaveLength(1)
    const diagnostic = result.diagnostics[0]
    if (!diagnostic) {
      throw new Error('Expected one diagnostic entry')
    }

    expect(diagnostic).toEqual({
      severity: 'error',
      message:
        'Plugin \'P\': internal invariant violated — plugin-keymap option "K" received a raw Lua marker; this is a codegen bug',
      context: schemaId,
    })
  })

  it('surfaces effective key collision before downstream invariant checks', () => {
    const pluginName = 'P'
    const key = 'K'
    const schemaId = 'schema-p'

    const collisionFixture: ResolvedPluginForGeneration = {
      plugin: {
        id: 'plugin-p',
        schemaId,
        enabled: true,
        config: {},
      },
      schema: {
        id: schemaId,
        pluginName,
        pluginRepo: 'owner/p',
        version: '1.0.0',
        setup: { requirePath: 'p' },
        functions: [],
        options: [
          {
            key,
            label: 'Keymap',
            type: 'plugin-keymap',
            defaultPreset: 'default',
            commands: [{ name: 'accept', label: 'Accept' }],
            presets: [
              {
                id: 'default',
                label: 'Default',
                mappings: { '<CR>': ['accept'] },
              },
            ],
          },
          {
            key,
            label: 'Lua',
            type: 'lua',
            default: 'function() return true end',
          },
        ],
      },
    }

    const input: PluginSectionInput = {
      resolvedPlugins: [collisionFixture],
      themePluginIds: new Set<string>(),
    }

    const result = generatePluginSection(input)

    expect(result.code.join('\n')).not.toContain('require("p").setup(')
    expect(result.diagnostics).toHaveLength(1)
    const diagnostic = result.diagnostics[0]
    if (!diagnostic) {
      throw new Error('Expected one diagnostic entry')
    }

    expect(diagnostic.message).toContain('effective key collision')
    expect(diagnostic.context).toBe(schemaId)
    expect(diagnostic.severity).toBe('error')
  })
})
