import { describe, expect, it } from 'vitest'
import type { LegacyGenerationDiagnostic } from '@/features/lua-generator/types'
import { rawLua } from '@/features/lua-generator/utils/lua-serialize'
import { transformKeymapCommands } from '../keymap-command-transform'

function runTransform(
  table: Record<string, unknown>,
  optionKey = 'keys',
): {
  transformed: Record<string, unknown>
  diagnostics: LegacyGenerationDiagnostic[]
} {
  const diagnostics: LegacyGenerationDiagnostic[] = []
  const transformed = transformKeymapCommands(
    table,
    optionKey,
    'Fixture Plugin',
    diagnostics,
  )
  return { transformed, diagnostics }
}

describe('transformKeymapCommands direct characterization', () => {
  it('preserves exact transformed tables and legacy diagnostics', () => {
    const keysResult = runTransform({
      preset: 'default',
      '<CR>': ['open', { lua: 'vim.cmd("edit")' }],
      '<Esc>': false,
      '<Tab>': [{ lua: '   ' }, 'still-valid'],
      '<Mixed>': ['keep', { lua: 'vim.cmd("keep")' }, {}, 42, true],
      '<AllInvalid>': [{ unexpected: 'value' }, 99, false],
      bad: 42,
      empty: [],
      weird: 'not-array',
    })

    expect(keysResult.transformed).toEqual({
      preset: 'default',
      '<CR>': ['open', rawLua('vim.cmd("edit")')],
      '<Esc>': false,
      '<Tab>': ['still-valid'],
      '<Mixed>': ['keep', rawLua('vim.cmd("keep")')],
    })

    expect(keysResult.diagnostics).toEqual([
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<Tab>" has empty Lua entry — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<Mixed>" has malformed command entry (expected string or { lua: "..." }) — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<Mixed>" has malformed command entry (expected string or { lua: "..." }) — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<Mixed>" has malformed command entry (expected string or { lua: "..." }) — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<AllInvalid>" has malformed command entry (expected string or { lua: "..." }) — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<AllInvalid>" has malformed command entry (expected string or { lua: "..." }) — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<AllInvalid>" has malformed command entry (expected string or { lua: "..." }) — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "<AllInvalid>" has no valid commands after filtering — key omitted from output',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "bad" has unexpected value type "number" — dropped',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "empty" has no valid commands after filtering — key omitted from output',
        context: 'keys',
      },
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "keys" key "weird" has unexpected value type "string" — dropped',
        context: 'keys',
      },
    ])

    const secondOption = runTransform(
      {
        preset: 'custom',
        '<C-x>': ['cmd-a', { lua: 'print(1)' }],
        '<C-y>': [{ lua: ' ' }, { lua: 'valid' }],
      },
      'insert_keys',
    )

    expect(secondOption.transformed).toEqual({
      preset: 'custom',
      '<C-x>': ['cmd-a', rawLua('print(1)')],
      '<C-y>': [rawLua('valid')],
    })

    expect(secondOption.diagnostics).toEqual([
      {
        severity: 'warning',
        message:
          'Plugin \'Fixture Plugin\': keymap "insert_keys" key "<C-y>" has empty Lua entry — dropped',
        context: 'insert_keys',
      },
    ])
  })
})
