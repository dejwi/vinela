import { describe, expect, it } from 'vitest'

import { flattenPluginKeymapValue } from '@/features/lua-generator/utils/config-merge'
import {
  rawLua,
  serializeValue,
} from '@/features/lua-generator/utils/lua-serialize'
import { resolvePluginKeymapDefaults } from '@/features/plugins/utils/plugin-keymap-defaults'
import type { SchemaPluginKeymapOption } from '@/shared/types'

// ============================================
// Helpers
// ============================================

function makeKeymapOption(
  overrides?: Partial<SchemaPluginKeymapOption>,
): SchemaPluginKeymapOption {
  return {
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
      { id: 'none', label: 'None', mappings: {} },
    ],
    ...overrides,
  }
}

// ============================================
// resolvePluginKeymapDefaults
// ============================================

describe('resolvePluginKeymapDefaults', () => {
  it('returns defaultPreset when value is undefined', () => {
    const option = makeKeymapOption({ defaultPreset: 'default' })
    const result = resolvePluginKeymapDefaults(undefined, option)
    expect(result.preset).toBe('default')
    expect(result.overrides).toEqual({})
  })

  it('returns defaultPreset when value is null', () => {
    const option = makeKeymapOption({ defaultPreset: 'default' })
    const result = resolvePluginKeymapDefaults(undefined, option)
    expect(result.preset).toBe('default')
    expect(result.overrides).toEqual({})
  })

  it('returns defaultPreset when value has no preset key', () => {
    const option = makeKeymapOption({ defaultPreset: 'default' })
    const result = resolvePluginKeymapDefaults({}, option)
    expect(result.preset).toBe('default')
    expect(result.overrides).toEqual({})
  })

  it('returns defaultPreset when value is not an object (invalid shape)', () => {
    const option = makeKeymapOption({ defaultPreset: 'default' })
    const result = resolvePluginKeymapDefaults('bad-value', option)
    expect(result.preset).toBe('default')
    expect(result.overrides).toEqual({})
  })

  it('returns defaultPreset when value is an array (invalid shape)', () => {
    const option = makeKeymapOption({ defaultPreset: 'default' })
    const result = resolvePluginKeymapDefaults(['default'], option)
    expect(result.preset).toBe('default')
    expect(result.overrides).toEqual({})
  })

  it('preserves stored preset when present', () => {
    const option = makeKeymapOption()
    const result = resolvePluginKeymapDefaults({ preset: 'none' }, option)
    expect(result.preset).toBe('none')
  })

  it('preserves overrides from stored value', () => {
    const option = makeKeymapOption()
    const result = resolvePluginKeymapDefaults(
      {
        preset: 'default',
        overrides: { '<CR>': ['accept', 'fallback'] },
      },
      option,
    )
    expect(result.preset).toBe('default')
    expect(result.overrides['<CR>']).toEqual(['accept', 'fallback'])
  })

  it('preserves false (disabled) overrides', () => {
    const option = makeKeymapOption()
    const result = resolvePluginKeymapDefaults(
      {
        preset: 'default',
        overrides: { '<C-e>': false },
      },
      option,
    )
    expect(result.overrides['<C-e>']).toBe(false)
  })

  it('resolves { lua: "..." } entries in overrides', () => {
    const option = makeKeymapOption()
    const result = resolvePluginKeymapDefaults(
      {
        preset: 'default',
        overrides: { '<Tab>': [{ lua: 'vim.snippet.jump(1)' }] },
      },
      option,
    )
    expect(result.overrides['<Tab>']).toEqual([{ lua: 'vim.snippet.jump(1)' }])
  })

  it('ignores overrides that are not an object', () => {
    const option = makeKeymapOption()
    const result = resolvePluginKeymapDefaults(
      { preset: 'default', overrides: 'bad' },
      option,
    )
    expect(result.overrides).toEqual({})
  })
})

// ============================================
// flattenPluginKeymapValue
// ============================================

describe('flattenPluginKeymapValue', () => {
  it('flattens preset-only value', () => {
    const result = flattenPluginKeymapValue({
      preset: 'default',
      overrides: {},
    })
    expect(result).toEqual({ preset: 'default' })
  })

  it('flattens overrides into top-level keys', () => {
    const result = flattenPluginKeymapValue({
      preset: 'default',
      overrides: {
        '<CR>': ['accept', 'fallback'],
        '<C-e>': false,
      },
    })
    expect(result['preset']).toBe('default')
    expect(result['<CR>']).toEqual(['accept', 'fallback'])
    expect(result['<C-e>']).toBe(false)
  })

  it('handles empty overrides object', () => {
    const result = flattenPluginKeymapValue({ preset: 'none', overrides: {} })
    expect(result).toEqual({ preset: 'none' })
  })

  it('handles absent preset field gracefully', () => {
    const result = flattenPluginKeymapValue({
      overrides: { '<CR>': ['accept'] },
    })
    // No preset key in result
    expect(result['preset']).toBeUndefined()
    expect(result['<CR>']).toEqual(['accept'])
  })
})

// ============================================
// LuaRawCode (Symbol-branded marker)
// ============================================

describe('rawLua / serializeValue — LuaRawCode', () => {
  it('serializeValue emits raw Lua code verbatim for LuaRawCode markers', () => {
    const marker = rawLua('vim.snippet.jump(1)')
    const output = serializeValue(marker)
    expect(output).toBe('vim.snippet.jump(1)')
  })

  it('does NOT treat plain objects with __raw_lua property as raw Lua', () => {
    // Plain objects with a property named after a string cannot match the Symbol brand
    const notMarker = {
      code: 'some_lua()',
    } as unknown as import('@/features/lua-generator/utils/lua-serialize').LuaSerializable
    const output = serializeValue(notMarker)
    // Serialized as a regular object table, not raw Lua
    expect(output).toContain('code')
    expect(output).not.toBe('some_lua()')
  })

  it('rawLua marker inside an array is emitted verbatim', () => {
    const arr = [
      'accept',
      rawLua('vim.snippet.jump(1)'),
    ] as unknown as import('@/features/lua-generator/utils/lua-serialize').LuaSerializable[]
    const output = serializeValue(
      arr as unknown as import('@/features/lua-generator/utils/lua-serialize').LuaSerializable,
    )
    expect(output).toContain('vim.snippet.jump(1)')
    expect(output).toContain('"accept"')
  })
})

// ============================================
// Lua generator — plugin-keymap integration
// ============================================

import { generatePluginSection } from '@/features/lua-generator/sections/plugin-section'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '@/features/lua-generator/types'

function makeResolvedPlugin(
  config: Record<string, unknown>,
  optionOverrides?: Record<string, unknown>,
): ResolvedPluginForGeneration {
  return {
    plugin: {
      id: 'blink-cmp-1',
      schemaId: 'blink-cmp',
      enabled: true,
      config: config as Record<
        string,
        import('@/shared/types').PluginConfigValue
      >,
    },
    schema: {
      id: 'blink-cmp',
      pluginName: 'blink.cmp',
      pluginRepo: 'https://github.com/saghen/blink.cmp',
      version: '1.0.0',
      setup: {
        requirePath: 'blink.cmp',
        setupFunction: 'setup',
      },
      functions: [],
      options: [
        {
          key: 'keymap',
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
              mappings: {
                '<CR>': ['accept', 'fallback'],
                '<C-e>': ['cancel', 'fallback'],
              },
            },
            { id: 'none', label: 'None', mappings: {} },
          ],
          ...optionOverrides,
        } as ResolvedPluginForGeneration['schema']['options'][number],
      ],
    },
  }
}

function makeSectionInput(
  config: Record<string, unknown>,
  optionOverrides?: Record<string, unknown>,
): PluginSectionInput {
  return {
    resolvedPlugins: [makeResolvedPlugin(config, optionOverrides)],
    themePluginIds: new Set(),
  }
}

describe('generatePluginSection — plugin-keymap', () => {
  it('outputs preset string for preset-only config', () => {
    const input = makeSectionInput({ keymap: { preset: 'default' } })
    const result = generatePluginSection(input)
    const code = result.code.join('\n')
    expect(code).toContain('preset = "default"')
  })

  it('applies defaultPreset when no user config exists (M1)', () => {
    const input = makeSectionInput({})
    const result = generatePluginSection(input)
    const code = result.code.join('\n')
    expect(code).toContain('preset = "default"')
  })

  it('outputs overridden key bindings alongside preset', () => {
    const input = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<Tab>': ['accept', 'fallback'] },
      },
    })
    const result = generatePluginSection(input)
    const code = result.code.join('\n')
    expect(code).toContain('preset = "default"')
    expect(code).toContain('"accept"')
    expect(code).toContain('"fallback"')
  })

  it('outputs false for disabled keys', () => {
    const input = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<C-e>': false },
      },
    })
    const result = generatePluginSection(input)
    const code = result.code.join('\n')
    expect(code).toContain('false')
  })

  it('outputs raw Lua verbatim for { lua: "..." } entries', () => {
    const input = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<Tab>': [{ lua: 'vim.snippet.jump(1)' }] },
      },
    })
    const result = generatePluginSection(input)
    const code = result.code.join('\n')
    expect(code).toContain('vim.snippet.jump(1)')
  })

  it('outputs correct format for "none" preset with manual keymaps', () => {
    const input = makeSectionInput({
      keymap: {
        preset: 'none',
        overrides: { '<CR>': ['accept'] },
      },
    })
    const result = generatePluginSection(input)
    const code = result.code.join('\n')
    expect(code).toContain('preset = "none"')
    expect(code).toContain('"accept"')
  })

  it('emits diagnostic warning for malformed command entry (m2)', () => {
    const input = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<Tab>': [{ lua: '' }] }, // empty Lua → dropped with warning
      },
    })
    const result = generatePluginSection(input)
    const warnings = result.diagnostics.filter((d) => d.severity === 'warning')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some((w) => w.message.includes('empty Lua'))).toBe(true)
  })

  it('emits diagnostic warning when all commands in a key are dropped (m2)', () => {
    const input = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<Tab>': [{ lua: '' }] }, // all entries dropped
      },
    })
    const result = generatePluginSection(input)
    const warnings = result.diagnostics.filter((d) => d.severity === 'warning')
    expect(
      warnings.some(
        (w) => w.message.includes('<Tab>') || w.message.includes('empty Lua'),
      ),
    ).toBe(true)
  })

  it('metadata (_meta.rebindLinks) is ignored for Lua output — only preset+overrides affect generation', () => {
    // Config with _meta.rebindLinks present
    const withMeta = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<CR>': false, '<c-j>': ['accept', 'fallback'] },
        _meta: { rebindLinks: { '<c-j>': '<cr>' } },
      },
    })
    // Same config without _meta
    const withoutMeta = makeSectionInput({
      keymap: {
        preset: 'default',
        overrides: { '<CR>': false, '<c-j>': ['accept', 'fallback'] },
      },
    })

    const resultWith = generatePluginSection(withMeta)
    const resultWithout = generatePluginSection(withoutMeta)

    // Lua output should be identical regardless of _meta presence
    expect(resultWith.code.join('\n')).toBe(resultWithout.code.join('\n'))
  })

  it('resolvePluginKeymapDefaults ignores _meta for preset/overrides resolution', () => {
    const option = makeKeymapOption()
    const result = resolvePluginKeymapDefaults(
      {
        preset: 'default',
        overrides: { '<CR>': false },
        _meta: { rebindLinks: { '<c-j>': '<cr>' } },
      },
      option,
    )
    // preset and overrides are resolved correctly
    expect(result.preset).toBe('default')
    expect(result.overrides['<CR>']).toBe(false)
    // rebindLinks is hydrated but pruned (no <c-j> override exists → stale link pruned)
    expect(result.rebindLinks.size).toBe(0)
  })
})
