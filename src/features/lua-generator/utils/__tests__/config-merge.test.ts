import { describe, expect, it } from 'vitest'
import type { PluginSchema, SchemaOption } from '@/shared/types'
import { mergePluginConfig, unflattenDotKeys } from '../config-merge'

// Minimal schema factory for testing
function createSchema(options: SchemaOption[]): PluginSchema {
  return {
    id: 'test-plugin',
    pluginName: 'test.nvim',
    pluginRepo: 'https://github.com/test/test.nvim',
    version: '1.0.0',
    options,
    functions: [],
  }
}

describe('mergePluginConfig', () => {
  it('returns empty object for schema with no options', () => {
    const schema = createSchema([])
    expect(mergePluginConfig(schema, { 'not.in.schema': 'value' })).toEqual({})
  })

  it('returns defaults when user config is empty', () => {
    const schema = createSchema([
      { key: 'str', type: 'string', label: 'Str', default: 'hello' },
      { key: 'num', type: 'number', label: 'Num', default: 42 },
      { key: 'bool', type: 'boolean', label: 'Bool', default: true },
    ])
    expect(mergePluginConfig(schema, {})).toEqual({
      str: 'hello',
      num: 42,
      bool: true,
    })
  })

  it('user overrides take priority over defaults', () => {
    const schema = createSchema([
      { key: 'str', type: 'string', label: 'Str', default: 'hello' },
      { key: 'num', type: 'number', label: 'Num', default: 42 },
    ])
    expect(
      mergePluginConfig(schema, {
        str: 'world',
        num: 100,
      }),
    ).toEqual({
      str: 'world',
      num: 100,
    })
  })

  it('omits options with no default and no user value', () => {
    const schema = createSchema([
      { key: 'opt1', type: 'string', label: 'Opt 1', default: 'default1' },
      { key: 'opt2', type: 'string', label: 'Opt 2' }, // no default
      { key: 'opt3', type: 'string', label: 'Opt 3' }, // no default
    ])
    expect(
      mergePluginConfig(schema, {
        opt2: 'user2',
      }),
    ).toEqual({
      opt1: 'default1',
      opt2: 'user2',
    })
  })

  it('handles all option types (string, number, boolean, select, array, object)', () => {
    const schema = createSchema([
      { key: 'opt.str', type: 'string', label: 'S', default: 'a' },
      { key: 'opt.num', type: 'number', label: 'N', default: 1 },
      { key: 'opt.bool', type: 'boolean', label: 'B', default: false },
      {
        key: 'opt.sel',
        type: 'select',
        label: 'Sel',
        options: [{ value: 'x', label: 'X' }],
        default: 'x',
      },
      {
        key: 'opt.arr',
        type: 'array',
        label: 'Arr',
        items: { itemType: 'string' },
        default: ['x'],
      },
      {
        key: 'opt.obj',
        type: 'object',
        label: 'Obj',
        properties: [],
        default: { k: 'v' },
      },
      { key: 'opt.col', type: 'color', label: 'Col', default: '#fff' },
      { key: 'opt.key', type: 'keysequence', label: 'Key', default: '<CR>' },
      {
        key: 'opt.lua',
        type: 'lua',
        label: 'Lua',
        default: 'vim.fn.stdpath("data")',
      },
    ])
    expect(mergePluginConfig(schema, {})).toEqual({
      'opt.str': 'a',
      'opt.num': 1,
      'opt.bool': false,
      'opt.sel': 'x',
      'opt.arr': ['x'],
      'opt.obj': { k: 'v' },
      'opt.col': '#fff',
      'opt.key': '<CR>',
      'opt.lua': 'vim.fn.stdpath("data")',
    })
  })

  it('handles mix of overridden and default values', () => {
    const schema = createSchema([
      { key: 'opt1', type: 'string', label: '1', default: 'd1' },
      { key: 'opt2', type: 'string', label: '2', default: 'd2' },
      { key: 'opt3', type: 'string', label: '3', default: 'd3' },
    ])
    expect(
      mergePluginConfig(schema, {
        opt2: 'u2',
        opt3: 'u3',
      }),
    ).toEqual({
      opt1: 'd1',
      opt2: 'u2',
      opt3: 'u3',
    })
  })

  it('ignores user config keys not in schema', () => {
    const schema = createSchema([
      { key: 'opt1', type: 'string', label: '1', default: 'd1' },
    ])
    expect(
      mergePluginConfig(schema, {
        opt1: 'u1',
        not_in_schema: 'u2',
      }),
    ).toEqual({
      opt1: 'u1',
    })
  })

  it('handles required options without defaults (omits them for diagnostics to catch)', () => {
    const schema = createSchema([
      { key: 'req_no_def', type: 'string', label: '1', required: true },
      { key: 'opt', type: 'string', label: '2', default: 'd2' },
    ])
    expect(mergePluginConfig(schema, {})).toEqual({
      opt: 'd2',
    })
  })

  it('deep copies array and object defaults to prevent mutation', () => {
    const schema = createSchema([
      {
        key: 'arr',
        type: 'array',
        label: 'A',
        items: { itemType: 'string' },
        default: ['a'],
      },
      {
        key: 'obj',
        type: 'object',
        label: 'O',
        properties: [],
        default: { k: 'v' },
      },
    ])
    const config1 = mergePluginConfig(schema, {})
    const config2 = mergePluginConfig(schema, {})

    // Modify config1
    ;(config1['arr'] as string[]).push('b')
    ;(config1['obj'] as Record<string, string>)['k2'] = 'v2'

    // config2 should be unaffected
    expect(config2['arr']).toEqual(['a'])
    expect(config2['obj']).toEqual({ k: 'v' })
  })
})

describe('unflattenDotKeys', () => {
  it('returns empty object for empty input', () => {
    expect(unflattenDotKeys({})).toEqual({})
  })

  it('passes through keys without dots', () => {
    expect(unflattenDotKeys({ foo: 'bar', num: 42 })).toEqual({
      foo: 'bar',
      num: 42,
    })
  })

  it('unflattens single dot key', () => {
    expect(unflattenDotKeys({ 'a.b': 1 })).toEqual({
      a: { b: 1 },
    })
  })

  it('unflattens deep nesting', () => {
    expect(unflattenDotKeys({ 'a.b.c.d': 'deep' })).toEqual({
      a: { b: { c: { d: 'deep' } } },
    })
  })

  it('merges siblings at same level', () => {
    expect(
      unflattenDotKeys({
        'defaults.width': 0.5,
        'defaults.height': 0.8,
      }),
    ).toEqual({
      defaults: { width: 0.5, height: 0.8 },
    })
  })

  it('handles telescope-style config', () => {
    expect(
      unflattenDotKeys({
        'defaults.layout_config.width': 0.5,
        'defaults.layout_config.horizontal.preview_width': 0.55,
        'defaults.prompt_prefix': '>',
        'pickers.find_files.theme': 'dropdown',
      }),
    ).toEqual({
      defaults: {
        layout_config: {
          width: 0.5,
          horizontal: { preview_width: 0.55 },
        },
        prompt_prefix: '>',
      },
      pickers: {
        find_files: { theme: 'dropdown' },
      },
    })
  })

  it('handles mixed dotted and non-dotted keys', () => {
    expect(
      unflattenDotKeys({
        simple: true,
        'nested.key': 'value',
      }),
    ).toEqual({
      simple: true,
      nested: { key: 'value' },
    })
  })

  it('throws on scalar/object key collision', () => {
    // "foo" is a scalar but "foo.bar" needs it to be an object
    expect(() =>
      unflattenDotKeys({
        foo: 'scalar',
        'foo.bar': 'child',
      }),
    ).toThrow(/collision/i)
  })

  it('handles array values', () => {
    expect(unflattenDotKeys({ 'a.list': ['x', 'y', 'z'] })).toEqual({
      a: { list: ['x', 'y', 'z'] },
    })
  })

  it('handles boolean and number values', () => {
    expect(
      unflattenDotKeys({
        'highlight.enable': true,
        'indent.enable': false,
        max_depth: 5,
      }),
    ).toEqual({
      highlight: { enable: true },
      indent: { enable: false },
      max_depth: 5,
    })
  })

  it('handles empty string segments', () => {
    expect(unflattenDotKeys({ 'foo..bar': 'value' })).toEqual({
      foo: { '': { bar: 'value' } },
    })
  })

  it('handles keys with special characters', () => {
    expect(unflattenDotKeys({ 'foo.bar-baz': 1 })).toEqual({
      foo: { 'bar-baz': 1 },
    })
  })
})
