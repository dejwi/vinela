import { describe, expect, it } from 'vitest'
import blinkCmpSchema from '@/schemas/blink-cmp.json'
import masonSchema from '@/schemas/mason.json'
import snacksSchemaJson from '@/schemas/snacks-nvim.json'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '../../types'
import { generatePluginSection, stripLuaCommentLines } from '../plugin-section'
import { expectFieldOmitted, expectRawLuaField } from './lua-output-helpers'

interface ResolvedPluginOverrides {
  plugin?: Partial<ResolvedPluginForGeneration['plugin']>
  schema?: Partial<ResolvedPluginForGeneration['schema']>
}

function createResolvedPlugin(
  overrides?: ResolvedPluginOverrides,
): ResolvedPluginForGeneration {
  const plugin: ResolvedPluginForGeneration['plugin'] = {
    id: 'test-plugin',
    schemaId: 'test-plugin',
    enabled: true,
    config: {},
    ...overrides?.plugin,
  }

  const schema: ResolvedPluginForGeneration['schema'] = {
    id: 'test-plugin',
    pluginName: 'Test Plugin',
    pluginRepo: 'owner/test-plugin',
    version: '1.0.0',
    setup: { requirePath: 'test-plugin' },
    functions: [],
    options: [],
    ...overrides?.schema,
  }

  return { plugin, schema }
}

function generateSinglePlugin(
  plugin: ResolvedPluginForGeneration,
): ReturnType<typeof generatePluginSection> {
  const input: PluginSectionInput = {
    resolvedPlugins: [plugin],
    themePluginIds: new Set(),
  }
  return generatePluginSection(input)
}

function createPluginKeymapOption(
  defaultEmission?: 'emit' | 'explicit-only',
): Extract<SchemaOption, { type: 'plugin-keymap' }> {
  return {
    key: 'keys',
    label: 'Keys',
    type: 'plugin-keymap',
    defaultPreset: 'default',
    commands: [{ name: 'open', label: 'Open' }],
    presets: [
      {
        id: 'default',
        label: 'Default',
        mappings: { '<CR>': ['open'] },
      },
      {
        id: 'none',
        label: 'None',
        mappings: {},
      },
    ],
    ...(defaultEmission !== undefined ? { defaultEmission } : {}),
  }
}

const snacksSchema =
  snacksSchemaJson as unknown as ResolvedPluginForGeneration['schema']

describe('stripLuaCommentLines', () => {
  it('strips comment-only lines and preserves code lines', () => {
    expect(
      stripLuaCommentLines('function()\n  -- comment\n  return true\nend'),
    ).toBe('function()\n  return true\nend')
  })
})

describe('generatePluginSection lua include toggle behavior', () => {
  it('excludes lua field by smart default when value matches schema default', () => {
    const options: SchemaOption[] = [
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
        default: 'function() return nil end',
      },
    ]

    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: { options },
      }),
    )

    const output = result.code.join('\n')
    expectFieldOmitted(output, 'handler')
  })

  it('includes lua field by smart default when user value differs from schema default', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler: 'function() return true end' as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'function() return nil end',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expectRawLuaField(output, 'handler', 'return true')
  })

  it('omits persisted lua value equal to schema default without override', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler: 'function() return nil end' as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'function() return nil end',
            },
          ],
        },
      }),
    )

    expectFieldOmitted(result.code.join('\n'), 'handler')
  })

  it('emits explicit-only lua value equal to schema default once stored', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler: 'function() return nil end' as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'function() return nil end',
              defaultEmission: 'explicit-only',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expectRawLuaField(output, 'handler', 'return nil')
    expect(output).not.toMatch(/handler\s*=\s*"/)
  })

  it('omits explicit-only lua default when no value is stored', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          options: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'function() return nil end',
              defaultEmission: 'explicit-only',
            },
          ],
        },
      }),
    )

    expectFieldOmitted(result.code.join('\n'), 'handler')
  })

  it('includes default-equal persisted lua when override is true', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler:
              'function()\n  -- default comment\n  return nil\nend' as PluginConfigValue,
          },
          luaFieldOverrides: { handler: true },
        },
        schema: {
          options: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'function()\n  -- default comment\n  return nil\nend',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expectRawLuaField(output, 'handler', 'return nil')
    expect(output).not.toContain('-- default comment')
  })

  it('emits nil and warning when include is forced without value/default', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          luaFieldOverrides: { handler: true },
        },
        schema: {
          options: [{ key: 'handler', label: 'Handler', type: 'lua' }],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('handler = nil')
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'warning' &&
          d.message.includes('forced included without value/default'),
      ),
    ).toBe(true)
  })

  it('excludes lua field when explicit override is false', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler: 'function() return true end' as PluginConfigValue,
          },
          luaFieldOverrides: { handler: false },
        },
        schema: {
          options: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'function() return nil end',
            },
          ],
        },
      }),
    )

    expectFieldOmitted(result.code.join('\n'), 'handler')
  })

  it('applies nested lua override false using full option path', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            opts: {
              callback: 'function() return 42 end',
            } as PluginConfigValue,
          },
          luaFieldOverrides: { 'opts.callback': false },
        },
        schema: {
          options: [
            {
              key: 'opts',
              label: 'Opts',
              type: 'object',
              properties: [{ key: 'callback', label: 'Callback', type: 'lua' }],
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expectFieldOmitted(output, 'callback')
  })

  it('applies nested lua override true using full option path', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          luaFieldOverrides: { 'opts.callback': true },
        },
        schema: {
          options: [
            {
              key: 'opts',
              label: 'Opts',
              type: 'object',
              properties: [{ key: 'callback', label: 'Callback', type: 'lua' }],
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('callback = nil')
  })

  it('applies nested smart-default behavior for lua object fields', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            opts: {
              callback: 'function() return true end',
            } as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'opts',
              label: 'Opts',
              type: 'object',
              properties: [
                {
                  key: 'callback',
                  label: 'Callback',
                  type: 'lua',
                  default: 'function() return false end',
                },
              ],
            },
          ],
        },
      }),
    )

    expectRawLuaField(result.code.join('\n'), 'callback', 'return true')
  })

  it('strips comment-only lines for included lua fields', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler:
              'function()\n  -- comment only\n  return true\nend' as PluginConfigValue,
          },
        },
        schema: {
          options: [{ key: 'handler', label: 'Handler', type: 'lua' }],
        },
      }),
    )

    const output = result.code.join('\n')
    expectRawLuaField(output, 'handler', 'return true')
    expect(output).not.toContain('-- comment only')
  })
})

describe('generatePluginSection snacks.nvim runtime compatibility', () => {
  it('omits disabled snacks module roots and unsafe lazygit defaults', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          schemaId: 'snacks-nvim',
        },
        schema: snacksSchema,
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('require("snacks").setup()')
    expect(output).not.toContain('bigfile = {')
    expect(output).not.toContain('dashboard = {')
    expect(output).not.toContain('lazygit = {')
    expect(output).not.toContain('theme_path = "~/.cache/lazygit-theme.yml"')
  })

  it('retains an explicitly enabled lazygit root without emitting theme_path defaults', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          schemaId: 'snacks-nvim',
          config: {
            'lazygit.enabled': true,
          },
        },
        schema: snacksSchema,
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('lazygit = {')
    expect(output).toContain('enabled = true')
    expect(output).not.toContain('theme_path =')
  })

  it('expands stored lazygit theme paths without named-plugin cleanup branches', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          schemaId: 'snacks-nvim',
          config: {
            'lazygit.enabled': true,
            'lazygit.theme_path': '~/.cache/lazygit-theme.yml',
          },
        },
        schema: snacksSchema,
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain(
      'theme_path = vim.fn.expand("~/.cache/lazygit-theme.yml")',
    )
  })

  it('expands custom tilde lazygit theme paths with raw Lua', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          schemaId: 'snacks-nvim',
          config: {
            'lazygit.enabled': true,
            'lazygit.theme_path': '~/custom/lazygit-theme.yml',
          },
        },
        schema: snacksSchema,
      }),
    )

    const output = result.code.join('\n')
    expectRawLuaField(
      output,
      'theme_path',
      'vim.fn.expand("~/custom/lazygit-theme.yml")',
    )
  })

  it('warns and omits nested picker config when picker is disabled', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          schemaId: 'snacks-nvim',
          config: {
            'picker.enabled': false,
            'picker.matcher.fuzzy': false,
          },
        },
        schema: snacksSchema,
      }),
    )

    const output = result.code.join('\n')
    expect(output).not.toContain('picker = {')
    expect(
      result.diagnostics.some(
        (entry) =>
          entry.severity === 'warning' &&
          entry.message.includes("omitted disabled Snacks 'picker' config"),
      ),
    ).toBe(true)
  })

  it('keeps only meaningful explicit picker options when enabled', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          schemaId: 'snacks-nvim',
          config: {
            'picker.enabled': true,
            'picker.matcher.fuzzy': false,
          },
        },
        schema: snacksSchema,
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('picker = {')
    expect(output).toContain('enabled = true')
    expect(output).toContain('fuzzy = false')
    expect(output).not.toContain('smartcase = true')
    expect(output).not.toContain('prompt = " "')
    expect(output).not.toContain('layout = {')
  })
})

describe('generatePluginSection schema notices and default emission', () => {
  it('emits generation warnings for explicit values that match schema notices', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            'picker.truncate': 'center',
          },
        },
        schema: {
          options: [
            {
              key: 'picker.truncate',
              label: 'Truncate',
              type: 'select',
              options: [
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
              ],
              notices: [
                {
                  severity: 'warning',
                  surfaces: ['generation'],
                  when: { kind: 'has-explicit-value' },
                  message: 'Prefer source-local truncate settings.',
                },
              ],
            },
          ],
        },
      }),
    )

    expect(result.code.join('\n')).toContain('truncate = "center"')
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === 'warning' &&
          diagnostic.context === 'picker.truncate' &&
          diagnostic.message.includes('Prefer source-local truncate settings.'),
      ),
    ).toBe(true)
  })

  it('does not emit explicit-only defaults without stored values', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          options: [
            {
              key: 'picker.layout.preset',
              label: 'Layout Preset',
              type: 'select',
              default: 'ivy',
              defaultEmission: 'explicit-only',
              options: [
                { value: 'ivy', label: 'Ivy' },
                { value: 'dropdown', label: 'Dropdown' },
              ],
            },
            {
              key: 'picker.hidden',
              label: 'Hidden',
              type: 'boolean',
              default: true,
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).not.toContain('preset = "ivy"')
    expect(output).toContain('hidden = true')
  })

  it('emits explicit-only defaults once the user stores a value', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            'picker.layout.preset': 'ivy',
          },
        },
        schema: {
          options: [
            {
              key: 'picker.layout.preset',
              label: 'Layout Preset',
              type: 'select',
              default: 'ivy',
              defaultEmission: 'explicit-only',
              options: [
                { value: 'ivy', label: 'Ivy' },
                { value: 'dropdown', label: 'Dropdown' },
              ],
            },
          ],
        },
      }),
    )

    expect(result.code.join('\n')).toContain('preset = "ivy"')
  })

  it('omits absent explicit-only plugin-keymap defaults', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          options: [createPluginKeymapOption('explicit-only')],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).not.toContain('keys =')
    expect(output).not.toContain('preset = "default"')
    expect(output).not.toContain('<CR>')
    expect(result.diagnostics).toEqual([])
  })

  it('still emits ordinary absent plugin-keymap defaults', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          options: [createPluginKeymapOption()],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('keys = {')
    expect(output).toContain('preset = "default"')
  })

  it('emits stored explicit-only plugin-keymap values normally', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            keys: {
              overrides: {
                '<CR>': ['open'],
              },
            } as PluginConfigValue,
          },
        },
        schema: {
          options: [createPluginKeymapOption('explicit-only')],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('keys = {')
    expect(output).toContain('preset = "default"')
    expect(output).toContain('<CR>')
    expect(output).toContain('"open"')
  })
})

describe('regression: type:lua schema option emits raw Lua, not quoted string', () => {
  it('emits multiline lua function as raw Lua, not as escaped string literal', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            custom_session_tag:
              'function(session_namex)\n  return nil\nend' as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'custom_session_tag',
              label: 'Custom Session Tag',
              type: 'lua',
              default: 'function(session_name)\n  return nil\nend',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).not.toMatch(/custom_session_tag\s*=\s*"/)
    expect(output).not.toContain('\\n  return nil\\nend')
    expect(output).toMatch(/custom_session_tag\s*=\s*function\b/)
  })

  it('omits lua field whose value collapses to whitespace after comment stripping', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler:
              '-- only a comment\n   \n-- another comment' as PluginConfigValue,
          },
        },
        schema: {
          options: [{ key: 'handler', label: 'Handler', type: 'lua' }],
        },
      }),
    )

    const output = result.code.join('\n')
    expectFieldOmitted(output, 'handler')
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'warning' &&
          d.message.includes('whitespace-only after stripping comments'),
      ),
    ).toBe(true)
  })

  it('formats multiline raw lua fields with consistent table indentation', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            handler: 'function()\n  return true\nend' as PluginConfigValue,
          },
        },
        schema: {
          options: [{ key: 'handler', label: 'Handler', type: 'lua' }],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('handler = function()\n    return true\n  end')
  })
})

describe('emitKey aliasing in plugin setup emission', () => {
  it('emits value at emitKey path instead of schema key', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            sourceRaw: '{ nested = true }' as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'sourceRaw',
              emitKey: 'source',
              label: 'Source Raw',
              type: 'lua',
              default: '{}',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('source = { nested = true }')
    expect(output).not.toContain('sourceRaw')
  })

  it('preserves nested object leaves whose top-level option has no emitKey', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            opts: { nested: { value: 42 } } as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'opts',
              label: 'Opts',
              type: 'object',
              properties: [
                {
                  key: 'nested',
                  label: 'Nested',
                  type: 'object',
                  properties: [
                    {
                      key: 'value',
                      label: 'Value',
                      type: 'number',
                      default: 0,
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('value = 42')
  })
})

describe('plugin runtime-compat regressions', () => {
  it('emits blink.cmp with stable vim.pack semver pin', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema:
          blinkCmpSchema as unknown as ResolvedPluginForGeneration['schema'],
      }),
    )

    expect(result.code.join('\n')).toContain(
      '{ src = "https://github.com/saghen/blink.cmp", version = vim.version.range("1.*") },',
    )
  })

  it('escapes pack metadata strings before Lua emission', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          pluginRepo: 'owner/pack-test',
          pack: {
            name: 'bad"name\\n',
            version: { mode: 'ref', value: 'main\n--comment' },
          },
        },
      }),
    )

    expect(result.code.join('\n')).toContain(
      '{ src = "https://github.com/owner/pack-test", name = "bad\\"name\\\\n", version = "main\\n--comment" },',
    )
  })

  it('prefers custom semver override over schema pack default', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          pluginRepo: 'owner/pinned-plugin',
          pack: { version: { mode: 'semver-range', value: '1.*' } },
        },
        plugin: {
          installOverride: {
            version: { mode: 'semver-range', value: '2.*' },
          },
        },
      }),
    )

    expect(result.code.join('\n')).toContain(
      '{ src = "https://github.com/owner/pinned-plugin", version = vim.version.range("2.*") },',
    )
    expect(
      result.diagnostics.some(
        (entry) =>
          entry.severity === 'warning' &&
          entry.message.includes(
            "custom install version 'semver range 2.*' overrides schema default 'semver range 1.*'",
          ),
      ),
    ).toBe(true)
  })

  it('preserves schema pack name when only a custom version override is present', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          pluginRepo: 'owner/named-plugin',
          pack: {
            name: 'schema-name',
            version: { mode: 'semver-range', value: '1.*' },
          },
        },
        plugin: {
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v2.0.0' },
          },
        },
      }),
    )

    expect(result.code.join('\n')).toContain(
      '{ src = "https://github.com/owner/named-plugin", name = "schema-name", version = "v2.0.0" },',
    )
  })

  it('preserves schema pack version when only a custom name override is present', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          pluginRepo: 'owner/name-only-plugin',
          pack: { version: { mode: 'semver-range', value: '1.*' } },
        },
        plugin: {
          installOverride: {
            name: 'custom-name',
          },
        },
      }),
    )

    expect(result.code.join('\n')).toContain(
      '{ src = "https://github.com/owner/name-only-plugin", name = "custom-name", version = vim.version.range("1.*") },',
    )
  })

  it('emits Mason defaults with github registry and raw vim.log.levels constant', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: masonSchema as unknown as ResolvedPluginForGeneration['schema'],
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain(
      'registries = { "github:mason-org/mason-registry" }',
    )
    expect(output).not.toContain('mason:mason-org/mason-registry')
    expect(output).toContain('log_level = vim.log.levels.INFO')
    expect(output).not.toContain('log_level = "INFO"')
  })

  it('omits blink.cmp default-equivalent frecency output while keeping focused fuzzy defaults', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema:
          blinkCmpSchema as unknown as ResolvedPluginForGeneration['schema'],
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('implementation = "prefer_rust_with_warning"')
    expect(output).toContain('use_proximity = true')
    expect(output).not.toContain('frecency =')
    expect(output).not.toContain('use_frecency')
  })

  it('emits explicit blink.cmp frecency false without named-plugin warning code', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema:
          blinkCmpSchema as unknown as ResolvedPluginForGeneration['schema'],
        plugin: {
          config: {
            'fuzzy.frecency.enabled': false,
          },
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('frecency = { enabled = false }')
    expect(output).not.toContain('use_frecency')
    expect(result.diagnostics).toEqual([])
  })

  it('treats explicit blink.cmp frecency true as default-equivalent and omits it', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema:
          blinkCmpSchema as unknown as ResolvedPluginForGeneration['schema'],
        plugin: {
          config: {
            'fuzzy.frecency.enabled': true,
          },
        },
      }),
    )

    expect(result.code.join('\n')).not.toContain('frecency =')
  })

  it('coerces numeric string schema config values to bare Lua numbers', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            'picker.formatters.file.min_width': '40',
            'picker.formatters.file.icon_width': '2',
          },
        },
        schema: {
          id: 'snacks',
          pluginName: 'Snacks',
          pluginRepo: 'folke/snacks.nvim',
          options: [
            {
              key: 'picker.formatters.file.min_width',
              label: 'Min Width',
              type: 'number',
              default: 20,
            },
            {
              key: 'picker.formatters.file.icon_width',
              label: 'Icon Width',
              type: 'number',
              default: 1,
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('min_width = 40')
    expect(output).toContain('icon_width = 2')
    expect(output).not.toContain('min_width = "40"')
  })

  it.each([
    '',
    '   ',
  ])('drops blank numeric string schema config value %j and warns', (rawValue) => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            'picker.formatters.file.min_width': rawValue,
          },
        },
        schema: {
          id: 'snacks',
          pluginName: 'Snacks',
          pluginRepo: 'folke/snacks.nvim',
          options: [
            {
              key: 'picker.formatters.file.min_width',
              label: 'Min Width',
              type: 'number',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).not.toContain('min_width = 0')
    expect(output).not.toContain('min_width = "')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('dropped invalid number value'),
      ),
    ).toBe(true)
  })

  it.each([
    'Infinity',
    '-Infinity',
    'NaN',
  ])('drops non-finite numeric string schema config value %j and warns', (rawValue) => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            'picker.formatters.file.min_width': rawValue,
          },
        },
        schema: {
          id: 'snacks',
          pluginName: 'Snacks',
          pluginRepo: 'folke/snacks.nvim',
          options: [
            {
              key: 'picker.formatters.file.min_width',
              label: 'Min Width',
              type: 'number',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n').toLowerCase()
    expect(output).not.toContain('inf')
    expect(output).not.toContain('nan')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('dropped invalid number value'),
      ),
    ).toBe(true)
  })

  it('preserves valid multi-select arrays and filters invalid entries', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            'words.modes': ['n', 'bad', 't'] as PluginConfigValue,
          },
        },
        schema: {
          id: 'snacks',
          pluginName: 'Snacks',
          pluginRepo: 'folke/snacks.nvim',
          options: [
            {
              key: 'words.modes',
              label: 'Modes',
              type: 'select',
              multi: true,
              default: ['n', 'i'],
              options: [
                { value: 'n', label: 'Normal' },
                { value: 'i', label: 'Insert' },
                { value: 't', label: 'Terminal' },
              ],
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('modes = { "n", "t" }')
    expect(output).not.toContain('"bad"')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('filtered invalid multi-select entry'),
      ),
    ).toBe(true)
  })

  it('omits unsafe mapping-table rows from raw Lua emission', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            presets: [
              {
                filetype: 'lua',
                preset: 'stylua',
              },
              {
                filetype: "lua'); os.execute('boom') --",
                preset: 'stylua',
              },
            ] as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'presets',
              label: 'Presets',
              type: 'mapping-table',
              default: [],
              columns: [
                {
                  key: 'filetype',
                  label: 'Filetype',
                  type: 'select',
                  options: [{ value: 'lua', label: 'Lua' }],
                },
                {
                  key: 'preset',
                  label: 'Preset',
                  type: 'select',
                  options: [{ value: 'stylua', label: 'Stylua' }],
                },
              ],
              emit: {
                targetKey: 'filetype',
                keyColumn: 'filetype',
                valueColumn: 'preset',
                valueTemplate:
                  'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
              },
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).toContain('require("formatter.filetypes.lua").stylua')
    expect(output).not.toContain('os.execute')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('dropped mapping-table row: column "filetype"'),
      ),
    ).toBe(true)
  })

  it('omits nested subtree output when the nested controller is false', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            module: {
              enabled: false,
              setting: 'custom',
            } as PluginConfigValue,
          },
        },
        schema: {
          options: [
            {
              key: 'module',
              label: 'Module',
              type: 'object',
              properties: [
                {
                  key: 'enabled',
                  label: 'Enabled',
                  type: 'boolean',
                  default: true,
                },
                {
                  key: 'setting',
                  label: 'Setting',
                  type: 'string',
                },
              ],
            },
          ],
          generationRules: [
            {
              kind: 'subtree-gate',
              scope: 'module',
              when: { key: 'module.enabled', equals: false },
              action: 'omit-subtree',
              warnOnExplicitDescendants: true,
              message: 'Nested module config omitted',
            },
          ],
        },
      }),
    )

    const output = result.code.join('\n')
    expect(output).not.toContain('module = {')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('Nested module config omitted'),
      ),
    ).toBe(true)
  })

  it('reports conflicts for nested object option paths', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        plugin: {
          config: {
            module: {
              enabled: true,
              setting: 'custom',
            } as PluginConfigValue,
            'legacy.mode': 'compat',
          },
        },
        schema: {
          options: [
            {
              key: 'module',
              label: 'Module',
              type: 'object',
              properties: [
                {
                  key: 'enabled',
                  label: 'Enabled',
                  type: 'boolean',
                  default: true,
                },
                {
                  key: 'setting',
                  label: 'Setting',
                  type: 'string',
                },
              ],
            },
            {
              key: 'legacy.mode',
              label: 'Legacy Mode',
              type: 'string',
            },
          ],
          generationRules: [
            {
              kind: 'conflict',
              left: 'module.setting',
              right: 'legacy.mode',
              severity: 'warning',
              message: 'Nested module setting conflicts with legacy mode',
            },
          ],
        },
      }),
    )

    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes(
          'Nested module setting conflicts with legacy mode',
        ),
      ),
    ).toBe(true)
  })
})

describe('generatePluginSection setup.render lua-template', () => {
  it('renders a generic template for an arbitrary schema id', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          id: 'arbitrary-plugin-xyz',
          pluginName: 'Arbitrary Plugin',
          pluginRepo: 'owner/arbitrary-plugin',
          setup: {
            requirePath: 'arbitrary-plugin',
            preSetup: '-- before template',
            postSetup: '-- after template',
            render: {
              kind: 'lua-template',
              template:
                'local config = {{config}}\nlocal plugin = require({{requirePath}})\nplugin.bootstrap(config)',
            },
          },
          options: [
            {
              key: 'mode',
              label: 'Mode',
              type: 'string',
              default: 'fast',
            },
          ],
        },
        plugin: {
          config: { mode: 'safe' },
        },
      }),
    )

    const lua = result.code.join('\n')
    expect(lua).toContain('-- before template')
    expect(lua).toContain('local config = {')
    expect(lua).toContain('mode = "safe"')
    expect(lua).toContain('require("arbitrary-plugin")')
    expect(lua).toContain('plugin.bootstrap(config)')
    expect(lua).toContain('-- after template')
    expect(lua).not.toContain('require("arbitrary-plugin").setup(')
  })

  it('escapes requirePath and serializes config before template substitution', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          setup: {
            requirePath: 'plugin"name',
            render: {
              kind: 'lua-template',
              template:
                'local config = {{config}}\nlocal plugin = require({{requirePath}})',
            },
          },
          options: [
            {
              key: 'label',
              label: 'Label',
              type: 'string',
              default: 'ok',
            },
          ],
        },
        plugin: {
          config: { label: 'quote " test' },
        },
      }),
    )

    const lua = result.code.join('\n')
    expect(lua).toContain('label = "quote \\" test"')
    expect(lua).toContain('require("plugin\\"name")')
  })

  it('preserves legacy setup output when render is absent', () => {
    const result = generateSinglePlugin(
      createResolvedPlugin({
        schema: {
          setup: { requirePath: 'legacy-plugin' },
          options: [
            {
              key: 'enabled',
              label: 'Enabled',
              type: 'boolean',
              default: true,
            },
          ],
        },
      }),
    )

    expect(result.code.join('\n')).toContain('require("legacy-plugin").setup({')
  })
})
