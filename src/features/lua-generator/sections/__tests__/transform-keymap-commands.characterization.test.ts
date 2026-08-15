import { describe, expect, it } from 'vitest'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '../../types'
import { generatePluginSection } from '../plugin-section'

function createNormalKeymapOption(): Extract<
  SchemaOption,
  { type: 'plugin-keymap' }
> {
  return {
    key: 'keys',
    label: 'Normal Keys',
    type: 'plugin-keymap',
    defaultPreset: 'default',
    allowDisable: true,
    commands: [
      { name: 'open', label: 'Open', description: 'Open file' },
      { name: 'close', label: 'Close', isTerminal: true },
    ],
    presets: [
      {
        id: 'default',
        label: 'Default',
        mappings: { '<CR>': ['open'], q: ['close'] },
      },
    ],
  }
}

function createInsertKeymapOption(): Extract<
  SchemaOption,
  { type: 'plugin-keymap' }
> {
  return {
    key: 'insert_keys',
    label: 'Insert Keys',
    type: 'plugin-keymap',
    defaultPreset: 'default',
    commands: [{ name: 'save', label: 'Save' }],
    presets: [
      {
        id: 'default',
        label: 'Default',
        mappings: { '<C-s>': ['save'] },
      },
    ],
  }
}

function createResolvedPlugin(
  config: Record<string, PluginConfigValue>,
): ResolvedPluginForGeneration {
  return {
    plugin: {
      id: 'fixture-plugin',
      schemaId: 'fixture-plugin',
      enabled: true,
      config,
    },
    schema: {
      id: 'fixture-plugin',
      pluginName: 'Fixture Plugin',
      pluginRepo: 'owner/fixture-plugin',
      version: '1.0.0',
      setup: { requirePath: 'fixture-plugin' },
      functions: [],
      options: [
        {
          key: 'enabled_flag',
          label: 'Enabled',
          type: 'boolean',
          default: false,
        },
        createNormalKeymapOption(),
        createInsertKeymapOption(),
      ],
    },
  }
}

describe('transformKeymapCommands characterization', () => {
  it('preserves exact setup lua and diagnostics for mixed keymap command entries', () => {
    const input: PluginSectionInput = {
      resolvedPlugins: [
        createResolvedPlugin({
          enabled_flag: true,
          keys: {
            preset: 'default',
            overrides: {
              '<CR>': ['open', { lua: 'vim.cmd("edit")' }],
              '<Esc>': false,
              '<Tab>': [{ lua: '   ' }, 'still-valid'],
              bad: 42 as unknown as string,
            },
          } as PluginConfigValue,
          insert_keys: {
            preset: 'default',
            overrides: {
              '<C-s>': ['save'],
              noop: [],
            },
          } as PluginConfigValue,
        }),
      ],
      themePluginIds: new Set(),
    }

    const result = generatePluginSection(input)

    expect(result.code.join('\n')).toBe(
      [
        '-- Plugins',
        'vim.pack.add({',
        '  { src = "https://github.com/owner/fixture-plugin" },',
        '})',
        '',
        '-- Fixture Plugin',
        'require("fixture-plugin").setup({',
        '  enabled_flag = true,',
        '  insert_keys = {',
        '    ["<C-s>"] = { "save" },',
        '    preset = "default",',
        '  },',
        '  keys = {',
        '    ["<CR>"] = {',
        '      "open",',
        '      vim.cmd("edit"),',
        '    },',
        '    ["<Esc>"] = false,',
        '    ["<Tab>"] = { "still-valid" },',
        '    preset = "default",',
        '  },',
        '})',
      ].join('\n'),
    )

    expect(result.diagnostics).toEqual([
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<Tab>" has empty Lua entry — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "insert_keys" key "noop" has no valid commands after filtering — key omitted from output',
        context: 'insert_keys',
      },
    ])
  })
})
