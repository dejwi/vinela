import { describe, expect, it, vi } from 'vitest'
import { expectedCallableRefByKey } from '@/features/lua-generator/__tests__/utils/callable-keys'
import * as actionCatalogModule from '@/shared/data/neovim/action-catalog-entries'
import type { ProjectKeymap, ProjectKeymapsSectionInput } from '../../types'
import {
  generateProjectKeymapsSection,
  normalizeCommandRHS,
} from '../project-keymaps-section'

function makeRunAction(
  actionType: 'command' | 'keys',
  action: string,
): import('@/features/keymaps/types').ManualRunActionConfig {
  return {
    actionType,
    action,
    mode: 'custom-command',
    selectedActionKey: '',
    paramValues: {},
  }
}

function makeCatalogRunAction(
  actionType: 'command' | 'keys',
  action: string,
  selectedActionKey: string,
): import('@/features/keymaps/types').ManualRunActionConfig {
  return {
    actionType,
    action,
    mode: 'catalog',
    selectedActionKey,
    paramValues: {},
  }
}

function createMockKeymap(
  overrides: Partial<ProjectKeymap> = {},
): ProjectKeymap {
  return {
    id: 'test-keymap',
    enabled: true,
    keySequence: '<leader>f',
    modes: ['n'],
    description: 'Test keymap',
    silent: true,
    noremap: true,
    expr: false,
    action: {
      actionType: 'run-action',
      config: makeRunAction('command', ''),
    },
    ...overrides,
  }
}

describe('generateProjectKeymapsSection', () => {
  it('returns empty result when no keymaps provided', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('returns empty result when all keymaps are disabled', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({ enabled: false }),
        createMockKeymap({ enabled: false }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code).toEqual([])
  })

  it('generates vim.keymap.set for enabled keymap', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          keySequence: '<C-s>',
          modes: ['n'],
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'w'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[0]).toBe('-- Keymaps')
    expect(result.code[1]).toContain('vim.keymap.set')
    expect(result.code[1]).toContain('"<C-s>"')
    expect(result.code[1]).toContain('<cmd>w<CR>')
  })

  it('handles multiple modes', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          modes: ['n', 'v'],
          action: {
            actionType: 'run-action',
            config: makeRunAction('keys', '"+y'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('{ "n", "v" }')
    expect(result.code[1]).toContain('"\\"+y"')
  })

  it('handles run-action with command mode', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'Telescope find_files'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('<cmd>Telescope find_files<CR>')
  })

  it('handles run-action with keys mode', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('keys', 'ggVG'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('"ggVG"')
  })

  it('handles set-option action', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'set-option',
            optionName: 'wrap',
            scope: 'global',
            valueConfig: {
              valueMode: 'suggested',
              suggestedValue: true,
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('function()')
    expect(result.code[1]).toContain('vim.opt.wrap = true')
  })

  it('handles set-option with local scope', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'set-option',
            optionName: 'spell',
            scope: 'local',
            valueConfig: {
              valueMode: 'suggested',
              suggestedValue: true,
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('vim.opt_local.spell = true')
  })

  it('handles set-variable action', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'set-variable',
            variableName: 'debug_mode',
            scope: 'g',
            valueType: 'boolean',
            value: true,
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('vim.g.debug_mode = true')
  })

  it('handles set-variable with buffer scope', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'set-variable',
            variableName: 'is_test_file',
            scope: 'b',
            valueType: 'boolean',
            value: true,
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('vim.b.is_test_file = true')
  })

  it('handles code-block action', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'code-block',
            code: 'print("Hello")\nvim.cmd("split")',
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('function()')
    expect(result.code[1]).toContain('  print("Hello")')
    expect(result.code[1]).toContain('  vim.cmd("split")')
    expect(result.code[1]).toContain('end')
  })

  it('handles run-custom-action', () => {
    const callableKeyByGraphId = new Map<string, string>([
      ['format-and-save', 'format_and_save_colliding_key_2'],
    ])
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-custom-action',
            graphId: 'format-and-save',
            graphName: 'Format and Save',
          },
        }),
      ],
      resolvedPlugins: [],
      callableKeyByGraphId,
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain(
      `${expectedCallableRefByKey('format_and_save_colliding_key_2')}({})`,
    )
  })

  it('emits error and skips run-custom-action when callable key map is missing', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-custom-action',
            graphId: 'format-and-save',
            graphName: 'Format and Save',
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code).toEqual([])
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'error' &&
          d.message.includes('callable key map unavailable'),
      ),
    ).toBe(true)
  })

  it('emits error and skips run-custom-action when callable key map is partial', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-custom-action',
            graphId: 'format-and-save',
            graphName: 'Format and Save',
          },
        }),
      ],
      resolvedPlugins: [],
      callableKeyByGraphId: new Map<string, string>([
        ['some-other-graph', 'some_other_graph_key'],
      ]),
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code).toEqual([])
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'error' &&
          d.message.includes('unresolved callable key'),
      ),
    ).toBe(true)
  })

  it('includes desc in opts when description is provided', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: 'Save file',
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'w'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('desc = "Save file"')
  })

  it('includes silent=true when silent is true', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          silent: true,
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'w'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('silent = true')
  })

  it('includes remap=true when noremap is false', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          noremap: false,
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'w'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('remap = true')
  })

  it('includes expr=true when expr is true', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          expr: true,
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'w'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('expr = true')
  })

  it('sorts keymaps by key sequence then mode', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          keySequence: 'z',
          modes: ['n'],
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ''),
          },
        }),
        createMockKeymap({
          keySequence: 'a',
          modes: ['n'],
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ''),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    const aIndex = result.code.findIndex((line) => line.includes('"a"'))
    const zIndex = result.code.findIndex((line) => line.includes('"z"'))
    expect(aIndex).toBeLessThan(zIndex)
  })

  it('emits error for empty key sequence', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          keySequence: '',
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ''),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })

  it('emits error for empty modes array', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          modes: [],
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ''),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })

  it('emits warning for empty action', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ''),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.diagnostics.some((d) => d.severity === 'warning')).toBe(true)
  })

  it('emits warning for empty code block', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: { actionType: 'code-block', code: '' },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.diagnostics.some((d) => d.severity === 'warning')).toBe(true)
  })

  it('emits error for run-function without signature', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'vim.lsp.buf.rename',
            functionSource: {
              type: 'core',
              functionName: 'vim.lsp.buf.rename',
            },
            signature: null,
            paramDefaults: {},
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })

  it('handles run-function with signature', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'vim.lsp.buf.rename',
            functionSource: {
              type: 'core',
              functionName: 'vim.lsp.buf.rename',
            },
            signature: {
              luaCall: 'vim.lsp.buf.rename($params)',
              params: [],
              returns: 'void',
            },
            paramDefaults: {},
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('function()')
    expect(result.code[1]).toContain('vim.lsp.buf.rename({})')
  })

  it('handles run-function with params', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'telescope.find_files',
            functionSource: {
              type: 'plugin',
              pluginId: 'telescope',
              functionName: 'find_files',
            },
            signature: {
              luaCall: 'require("telescope.builtin").find_files($params)',
              params: [{ name: 'hidden', type: 'boolean', optional: true }],
              returns: 'void',
            },
            paramDefaults: {
              hidden: { kind: 'scalar', value: true },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('hidden = true')
  })

  it('coerces numeric string defaults for Snacks picker keymaps', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'Snacks.picker.explorer',
            functionSource: {
              type: 'plugin',
              pluginId: 'snacks',
              functionName: 'Snacks.picker.explorer',
            },
            signature: {
              luaCall: 'Snacks.picker.explorer($params)',
              params: [
                { name: 'layout.width', type: 'number', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {
              'layout.width': { kind: 'scalar', value: '40' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain(
      'Snacks.picker.explorer({ layout = { width = 40 } })',
    )
    expect(result.code[1]).not.toContain('"40"')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('run-function-param-coerced'),
      ),
    ).toBe(false)
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('Coerced numeric string default'),
      ),
    ).toBe(true)
  })

  it('renders dotted defaults nested under object-shaped table params for Snacks picker keymaps', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'Snacks.picker.explorer',
            functionSource: {
              type: 'plugin',
              pluginId: 'snacks',
              functionName: 'Snacks.picker.explorer',
            },
            signature: {
              luaCall: 'Snacks.picker.explorer($params)',
              params: [
                {
                  name: 'layout',
                  type: 'table',
                  optional: true,
                  objectShape: [
                    { name: 'width', type: 'number', optional: true },
                  ],
                },
              ],
              returns: 'void',
            },
            paramDefaults: {
              'layout.width': { kind: 'scalar', value: '40' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain(
      'Snacks.picker.explorer({ layout = { width = 40 } })',
    )
    expect(result.code[1]).not.toContain('Snacks.picker.explorer({})')
    expect(result.code[1]).not.toContain('"40"')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('Coerced numeric string default'),
      ),
    ).toBe(true)
  })

  it('drops invalid numeric string defaults for Snacks picker keymaps with diagnostics', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'Snacks.picker.explorer',
            functionSource: {
              type: 'plugin',
              pluginId: 'snacks',
              functionName: 'Snacks.picker.explorer',
            },
            signature: {
              luaCall: 'Snacks.picker.explorer($params)',
              params: [
                { name: 'layout.width', type: 'number', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {
              'layout.width': { kind: 'scalar', value: 'wide' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('Snacks.picker.explorer({})')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('Dropped invalid number default'),
      ),
    ).toBe(true)
  })

  it('drops invalid object-shaped dotted numeric defaults for Snacks picker keymaps with diagnostics', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'Snacks.picker.explorer',
            functionSource: {
              type: 'plugin',
              pluginId: 'snacks',
              functionName: 'Snacks.picker.explorer',
            },
            signature: {
              luaCall: 'Snacks.picker.explorer($params)',
              params: [
                {
                  name: 'layout',
                  type: 'table',
                  optional: true,
                  objectShape: [
                    { name: 'width', type: 'number', optional: true },
                  ],
                },
              ],
              returns: 'void',
            },
            paramDefaults: {
              'layout.width': { kind: 'scalar', value: 'wide' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('Snacks.picker.explorer({})')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('Dropped invalid number default'),
      ),
    ).toBe(true)
  })

  it.each([
    '',
    '   ',
    'Infinity',
    '-Infinity',
    'NaN',
  ])('omits invalid numeric string default %j for Snacks picker keymaps', (rawValue) => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'Snacks.picker.explorer',
            functionSource: {
              type: 'plugin',
              pluginId: 'snacks',
              functionName: 'Snacks.picker.explorer',
            },
            signature: {
              luaCall: 'Snacks.picker.explorer($params)',
              params: [
                { name: 'layout.width', type: 'number', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {
              'layout.width': { kind: 'scalar', value: rawValue },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    const output = result.code[1] ?? ''

    expect(output).toContain('Snacks.picker.explorer({})')
    expect(output).not.toContain(' = 0')
    expect(output.toLowerCase()).not.toContain('inf')
    expect(output.toLowerCase()).not.toContain('nan')
    expect(output).not.toContain('"Infinity"')
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes('Dropped invalid number default'),
      ),
    ).toBe(true)
  })

  it('renders named placeholder with nil when defaults are missing', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'auto-session.restore_session',
            functionSource: {
              type: 'plugin',
              pluginId: 'auto-session',
              functionName: 'restore_session',
            },
            signature: {
              luaCall:
                'require("auto-session").restore_session($params.session_name)',
              params: [
                { name: 'session_name', type: 'string', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {},
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('restore_session(nil)')
    expect(result.code[1]).not.toContain('{}.session_name')
  })

  it('renders named placeholder with scalar default value', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'auto-session.restore_session',
            functionSource: {
              type: 'plugin',
              pluginId: 'auto-session',
              functionName: 'restore_session',
            },
            signature: {
              luaCall:
                'require("auto-session").restore_session($params.session_name)',
              params: [
                { name: 'session_name', type: 'string', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {
              session_name: { kind: 'scalar', value: 'work' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('restore_session("work")')
  })

  it('emits diagnostic and skips keymap for mixed positional and named placeholders', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          keySequence: '<leader>m',
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'mixed.invalid',
            functionSource: {
              type: 'core',
              functionName: 'mixed.invalid',
            },
            signature: {
              luaCall: 'foo($params, $params.session_name)',
              params: [
                { name: 'session_name', type: 'string', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {},
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code).toEqual([])
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'error' &&
          d.message.includes(
            'mixes positional ($params) and named ($params.<name>) placeholders',
          ),
      ),
    ).toBe(true)
  })

  it('continues generation when one keymap has invalid template', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          id: 'invalid-keymap',
          keySequence: '<leader>m',
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'mixed.invalid',
            functionSource: {
              type: 'core',
              functionName: 'mixed.invalid',
            },
            signature: {
              luaCall: 'foo($params, $params.session_name)',
              params: [
                { name: 'session_name', type: 'string', optional: true },
              ],
              returns: 'void',
            },
            paramDefaults: {},
          },
        }),
        createMockKeymap({
          id: 'valid-keymap',
          keySequence: '<leader>w',
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'w'),
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(
      result.diagnostics.some(
        (d) => d.severity === 'error' && d.context === '<leader>m',
      ),
    ).toBe(true)
    expect(result.code.some((line) => line.includes('"<leader>m"'))).toBe(false)
    expect(result.code.some((line) => line.includes('"<leader>w"'))).toBe(true)
  })

  it('emits warning and keeps keymap when params are declared but template has no placeholder', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          keySequence: '<leader>p',
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'no.placeholder',
            functionSource: {
              type: 'core',
              functionName: 'no.placeholder',
            },
            signature: {
              luaCall: 'vim.notify("hello")',
              params: [{ name: 'message', type: 'string', optional: true }],
              returns: 'void',
            },
            paramDefaults: {},
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('vim.keymap.set')
    expect(result.code[1]).toContain('function()')
    expect(result.code[1]).toContain('vim.notify("hello")')
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'warning' &&
          d.message.includes('using raw luaCall for keymap compatibility'),
      ),
    ).toBe(true)
  })

  it('replaces repeated named placeholders', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'repeat.named',
            functionSource: {
              type: 'core',
              functionName: 'repeat.named',
            },
            signature: {
              luaCall: 'foo($params.x) .. bar($params.x)',
              params: [{ name: 'x', type: 'string', optional: false }],
              returns: 'void',
            },
            paramDefaults: {
              x: { kind: 'scalar', value: 'value' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('foo("value") .. bar("value")')
    expect(result.code[1]).not.toContain('$params.x')
  })

  it('renders overlapping named placeholders without prefix corruption', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'overlap.named',
            functionSource: {
              type: 'core',
              functionName: 'overlap.named',
            },
            signature: {
              luaCall: 'f($params.a, $params.ab)',
              params: [
                { name: 'a', type: 'string', optional: false },
                { name: 'ab', type: 'string', optional: false },
              ],
              returns: 'void',
            },
            paramDefaults: {
              a: { kind: 'scalar', value: 'x' },
              ab: { kind: 'scalar', value: 'y' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('function()')
    expect(result.code[1]).toContain('f("x", "y")')
    expect(result.code[1]).not.toContain('$params.a')
    expect(result.code[1]).not.toContain('$params.ab')
    expect(result.code[1]).not.toContain('"x"b')
  })

  it('keeps positional template table-style behavior after named fix', () => {
    const withoutDefaultsInput: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'vim.notify',
            functionSource: {
              type: 'core',
              functionName: 'vim.notify',
            },
            signature: {
              luaCall: 'vim.notify($params)',
              params: [],
              returns: 'void',
            },
            paramDefaults: {},
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const withoutDefaultsResult =
      generateProjectKeymapsSection(withoutDefaultsInput)
    expect(withoutDefaultsResult.code[1]).toContain('vim.notify({})')

    const withDefaultsInput: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'vim.notify',
            functionSource: {
              type: 'core',
              functionName: 'vim.notify',
            },
            signature: {
              luaCall: 'vim.notify($params)',
              params: [],
              returns: 'void',
            },
            paramDefaults: {
              title: { kind: 'scalar', value: 'hello' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const withDefaultsResult = generateProjectKeymapsSection(withDefaultsInput)
    expect(withDefaultsResult.code[1]).toContain(
      'vim.notify({ title = "hello" })',
    )
  })

  it('replaces repeated positional placeholders globally', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-function',
            selectedFunctionKey: 'repeat.positional',
            functionSource: {
              type: 'core',
              functionName: 'repeat.positional',
            },
            signature: {
              luaCall: 'foo($params) .. bar($params)',
              params: [],
              returns: 'void',
            },
            paramDefaults: {
              x: { kind: 'scalar', value: 'value' },
            },
          },
        }),
      ],
      resolvedPlugins: [],
    }

    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain(
      'foo({ x = "value" }) .. bar({ x = "value" })',
    )
    expect(result.code[1]).not.toContain('$params')
  })

  it('generates callable table lookup for custom action', () => {
    const callableKeyByGraphId = new Map<string, string>([
      ['my-graph-123', 'my_graph_123_canonical'],
    ])
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-custom-action',
            graphId: 'my-graph-123',
            graphName: 'My Graph',
          },
        }),
      ],
      resolvedPlugins: [],
      callableKeyByGraphId,
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain(
      `${expectedCallableRefByKey('my_graph_123_canonical')}({})`,
    )
  })
})

// ============================================================
// normalizeCommandRHS unit tests
// ============================================================

describe('normalizeCommandRHS', () => {
  it('wraps a bare command in <cmd>...<CR>', () => {
    expect(normalizeCommandRHS('write')).toBe('<cmd>write<CR>')
  })

  it('strips a leading colon from a bare command', () => {
    expect(normalizeCommandRHS(':write')).toBe('<cmd>write<CR>')
  })

  it('appends <CR> when input has <cmd> prefix but no trailing <CR>', () => {
    expect(normalizeCommandRHS('<cmd>write')).toBe('<cmd>write<CR>')
  })

  it('appends <CR> when input has mixed-case <Cmd> prefix but no trailing <CR>', () => {
    expect(normalizeCommandRHS('<Cmd>write')).toBe('<Cmd>write<CR>')
  })

  it('preserves an already-canonical <cmd>...<CR> form', () => {
    expect(normalizeCommandRHS('<cmd>write<CR>')).toBe('<cmd>write<CR>')
  })

  it('strips a redundant colon after <cmd>', () => {
    expect(normalizeCommandRHS('<cmd>:write<CR>')).toBe('<cmd>write<CR>')
  })

  it('does not append a duplicate <CR> when a hybrid tail is present', () => {
    // :cprev<CR>zz already contains <CR> so no extra one should be added
    expect(normalizeCommandRHS(':cprev<CR>zz')).toBe('<cmd>cprev<CR>zz')
  })

  it('is case-insensitive for existing <cmd> prefix detection', () => {
    expect(normalizeCommandRHS('<Cmd>write<CR>')).toBe('<Cmd>write<CR>')
  })

  it('strips a redundant colon after <Cmd> (mixed case)', () => {
    expect(normalizeCommandRHS('<Cmd>:write<CR>')).toBe('<Cmd>write<CR>')
  })

  it('does not append <CR> when <cr> (lowercase) is already present', () => {
    expect(normalizeCommandRHS(':cnext<cr>zz')).toBe('<cmd>cnext<cr>zz')
  })

  it('handles a command with pipe (compound command) without duplicating <CR>', () => {
    expect(normalizeCommandRHS(':cnext | normal! zz')).toBe(
      '<cmd>cnext | normal! zz<CR>',
    )
  })

  it('trims whitespace before normalizing', () => {
    expect(normalizeCommandRHS('  write  ')).toBe('<cmd>write<CR>')
  })
})

// ============================================================
// Command RHS normalization — integration through section generator
// ============================================================

describe('generateProjectKeymapsSection — command RHS normalization', () => {
  it('normalizes a bare command to <cmd>...<CR>', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('<cmd>write<CR>')
    expect(result.code[1]).not.toMatch(/<cmd>:/)
  })

  it('normalizes a leading-colon command by stripping the colon', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ':write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('<cmd>write<CR>')
    expect(result.code[1]).not.toMatch(/<cmd>:/)
  })

  it('preserves an already-canonical <cmd>...<CR> without duplicating <CR>', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', '<cmd>write<CR>'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    // Should appear exactly once — no extra <CR> appended
    const line = result.code[1] ?? ''
    const occurrences = (line.match(/<CR>/gi) ?? []).length
    expect(occurrences).toBe(1)
    expect(line).toContain('<cmd>write<CR>')
  })

  it('strips a redundant colon after <cmd> prefix', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', '<cmd>:write<CR>'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('<cmd>write<CR>')
    expect(result.code[1]).not.toMatch(/<cmd>:/)
  })

  it('handles hybrid :cprev<CR>zz without adding a duplicate trailing <CR>', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', ':cprev<CR>zz'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    const line = result.code[1] ?? ''
    expect(line).toContain('<cmd>cprev<CR>zz')
    // Exactly one <CR> — not two
    const occurrences = (line.match(/<CR>/gi) ?? []).length
    expect(occurrences).toBe(1)
  })

  it('does not normalize keys-mode actions (no <cmd> wrapping)', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          action: {
            actionType: 'run-action',
            config: makeRunAction('keys', ':cprev<CR>zz'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    const line = result.code[1] ?? ''
    // Keys mode: output should be the raw sequence, NOT wrapped in <cmd>
    expect(line).not.toContain('<cmd>')
    expect(line).toContain(':cprev')
  })
})

// ============================================================
// desc fallback from catalog action
// ============================================================

describe('generateProjectKeymapsSection — desc fallback', () => {
  it('uses explicit description when present (highest priority)', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: 'My custom description',
          action: {
            actionType: 'run-action',
            config: makeCatalogRunAction('command', 'write', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('desc = "My custom description"')
    // Should not include catalog text when user entered a description
    expect(result.code[1]).not.toContain('Write the current buffer to disk')
  })

  it('falls back to catalog shortDescription when description is blank', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: '',
          action: {
            actionType: 'run-action',
            config: makeCatalogRunAction('command', 'write', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    // 'write' catalog entry has shortDescription = 'Write the current buffer to disk'
    expect(result.code[1]).toContain(
      'desc = "Write the current buffer to disk"',
    )
  })

  it('falls back to catalog shortDescription when description is whitespace-only', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: '   ',
          action: {
            actionType: 'run-action',
            config: makeCatalogRunAction('command', 'write', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain(
      'desc = "Write the current buffer to disk"',
    )
  })

  it('omits desc when description is blank and action is custom-command mode', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: '',
          silent: false,
          noremap: true,
          expr: false,
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).not.toContain('desc =')
  })

  it('omits desc when description is blank and selectedActionKey is unknown', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: '',
          silent: false,
          noremap: true,
          expr: false,
          action: {
            actionType: 'run-action',
            config: makeCatalogRunAction(
              'command',
              'some-cmd',
              'nonexistent-catalog-key',
            ),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).not.toContain('desc =')
  })

  it('omits desc when description is blank and selectedActionKey is empty string', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: '',
          silent: false,
          noremap: true,
          expr: false,
          action: {
            actionType: 'run-action',
            // catalog mode but no key selected
            config: makeCatalogRunAction('command', 'write', ''),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).not.toContain('desc =')
  })

  it('falls back to catalog label when shortDescription is empty string', () => {
    // Simulate a catalog entry whose shortDescription is empty — the `||`
    // operator should fall through to the `label` field.
    vi.spyOn(actionCatalogModule, 'findActionByKey').mockReturnValueOnce({
      key: 'custom-key',
      type: 'command',
      label: 'My Action Label',
      shortDescription: '',
      category: 'file',
      whatItDoes: 'Does something',
      template: 'write',
      example: ':write',
      sourceDoc: ':h write',
    })

    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          description: '',
          silent: false,
          noremap: true,
          expr: false,
          action: {
            actionType: 'run-action',
            config: makeCatalogRunAction('command', 'write', 'custom-key'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('desc = "My Action Label"')

    vi.restoreAllMocks()
  })
})

// ============================================================
// noremap / remap option semantics (documentation regression guard)
// ============================================================

describe('generateProjectKeymapsSection — noremap/remap semantics', () => {
  it('does NOT emit remap=true when noremap is true (default)', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          noremap: true,
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).not.toContain('remap = true')
  })

  it('emits remap=true when noremap is false', () => {
    const input: ProjectKeymapsSectionInput = {
      keymaps: [
        createMockKeymap({
          noremap: false,
          action: {
            actionType: 'run-action',
            config: makeRunAction('command', 'write'),
          },
        }),
      ],
      resolvedPlugins: [],
    }
    const result = generateProjectKeymapsSection(input)
    expect(result.code[1]).toContain('remap = true')
  })
})
