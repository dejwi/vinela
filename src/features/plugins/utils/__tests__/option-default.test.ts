import { describe, expect, it } from 'vitest'
import type {
  PluginConfigValue,
  SchemaArrayOption,
  SchemaLuaOption,
  SchemaMappingTableDefault,
  SchemaMultiSelectOption,
  SchemaObjectOption,
  SchemaOption,
} from '@/shared/types'
import {
  canonicalDeepEqual,
  canResetOption,
  forEachDescendantLuaKey,
  getDefaultResetValue,
  getEffectiveValue,
  hasAnyOverrideUnderPrefix,
  valueMatchesDefault,
} from '../option-default'
import type { OptionIdentity } from '../option-identity'

describe('option-default utilities', () => {
  it('canonicalDeepEqual handles primitives, arrays, objects, and undefined', () => {
    expect(canonicalDeepEqual('x', 'x')).toBe(true)
    expect(canonicalDeepEqual('x', 'y')).toBe(false)
    expect(canonicalDeepEqual([1, 2], [1, 2])).toBe(true)
    expect(canonicalDeepEqual([1, 2], [2, 1])).toBe(false)
    expect(canonicalDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(canonicalDeepEqual({ a: { b: [1] } }, { a: { b: [1] } })).toBe(true)
    expect(canonicalDeepEqual(undefined, {})).toBe(false)
    expect(canonicalDeepEqual(Number.NaN, Number.NaN)).toBe(false)
  })

  it('getEffectiveValue resolves boolean, select-multi, plugin-keymap, and object', () => {
    const booleanOption: SchemaOption = {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      default: false,
    }
    expect(getEffectiveValue(booleanOption, undefined)).toBe(false)

    const multiSelect: SchemaOption = {
      key: 'modes',
      label: 'Modes',
      type: 'select',
      multi: true,
      options: [{ label: 'A', value: 'a' }],
    }
    expect(getEffectiveValue(multiSelect, undefined)).toEqual([])

    const keymapOption: SchemaOption = {
      key: 'keys',
      label: 'Keys',
      type: 'plugin-keymap',
      defaultPreset: 'default',
      commands: [],
      presets: [{ id: 'default', label: 'Default', mappings: {} }],
    }
    expect(
      getEffectiveValue(keymapOption, {
        overrides: {},
        _meta: { rebindLinks: {} },
      }),
    ).toEqual({ preset: 'default' })

    const objectOption: SchemaObjectOption = {
      key: 'opts',
      label: 'Opts',
      type: 'object',
      properties: [
        { key: 'name', label: 'Name', type: 'string' },
        { key: 'flag', label: 'Flag', type: 'boolean', default: false },
      ],
    }
    expect(getEffectiveValue(objectOption, { flag: false })).toEqual({
      flag: false,
    })
  })

  it('getDefaultResetValue covers every option discriminator exhaustively', () => {
    type ResetCase<K extends SchemaOption['type']> = {
      readonly option: Extract<SchemaOption, { type: K }>
      readonly expected: PluginConfigValue | undefined
    }

    const cases: {
      [K in SchemaOption['type']]: ResetCase<K>
    } = {
      string: {
        option: { key: 'name', label: 'Name', type: 'string', default: 'foo' },
        expected: 'foo',
      },
      number: {
        option: { key: 'count', label: 'Count', type: 'number', default: 2 },
        expected: 2,
      },
      boolean: {
        option: {
          key: 'enabled',
          label: 'Enabled',
          type: 'boolean',
          default: false,
        },
        expected: false,
      },
      select: {
        option: {
          key: 'modes',
          label: 'Modes',
          type: 'select',
          multi: true,
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
          default: ['a'],
        },
        expected: ['a'],
      },
      array: {
        option: {
          key: 'items',
          label: 'Items',
          type: 'array',
          items: { itemType: 'string' },
          default: ['x'],
        },
        expected: ['x'],
      },
      'mapping-table': {
        option: {
          key: 'presets',
          label: 'Presets',
          type: 'mapping-table',
          default: [{ filetype: 'lua', preset: 'stylua' }],
          columns: [
            {
              key: 'filetype',
              label: 'Filetype',
              type: 'select',
              options: [{ label: 'Lua', value: 'lua' }],
            },
            {
              key: 'preset',
              label: 'Preset',
              type: 'select',
              options: [{ label: 'stylua', value: 'stylua' }],
            },
          ],
          emit: {
            targetKey: 'filetype',
            keyColumn: 'filetype',
            valueColumn: 'preset',
            valueTemplate: 'preset',
          },
        },
        expected: [{ filetype: 'lua', preset: 'stylua' }],
      },
      object: {
        option: {
          key: 'opts',
          label: 'Opts',
          type: 'object',
          properties: [{ key: 'name', label: 'Name', type: 'string' }],
          default: { name: 'x' },
        },
        expected: { name: 'x' },
      },
      color: {
        option: {
          key: 'color',
          label: 'Color',
          type: 'color',
          default: '#000000',
        },
        expected: '#000000',
      },
      keysequence: {
        option: {
          key: 'key',
          label: 'Key',
          type: 'keysequence',
          default: '<C-a>',
        },
        expected: '<C-a>',
      },
      lua: {
        option: {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'return 1',
        },
        expected: 'return 1',
      },
      'plugin-keymap': {
        option: {
          key: 'keys',
          label: 'Keys',
          type: 'plugin-keymap',
          defaultPreset: 'base',
          commands: [],
          presets: [{ id: 'base', label: 'Base', mappings: {} }],
        },
        expected: { preset: 'base' },
      },
    }

    for (const testCase of Object.values(cases)) {
      expect(getDefaultResetValue(testCase.option)).toEqual(testCase.expected)
    }

    const multiSelectNoDefault: SchemaMultiSelectOption = {
      key: 'modes_empty',
      label: 'Modes',
      type: 'select',
      multi: true,
      options: [{ label: 'A', value: 'a' }],
    }
    expect(getDefaultResetValue(multiSelectNoDefault)).toEqual([])

    const singleSelect: SchemaOption = {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [{ label: 'Default', value: 'default' }],
      default: 'default',
    }
    expect(getDefaultResetValue(singleSelect)).toBe('default')

    const mappingDefault: SchemaMappingTableDefault = [
      { filetype: 'lua', preset: 'stylua' },
    ]
    const mappingClone = getDefaultResetValue(cases['mapping-table'].option)
    expect(mappingClone).toEqual(mappingDefault)
    const mutableClone = mappingClone as Array<{
      filetype: string
      preset: string
    }>
    const firstRow = mutableClone[0]
    expect(firstRow).toBeDefined()
    if (firstRow) firstRow.preset = 'prettierd'
    expect(cases['mapping-table'].option.default).toEqual(mappingDefault)
  })

  it('getDefaultResetValue deep clones arrays/objects and handles plugin-keymap', () => {
    const arrayOption: SchemaArrayOption = {
      key: 'items',
      label: 'Items',
      type: 'array',
      items: { itemType: 'string' },
      default: ['a'],
    }
    const arr = getDefaultResetValue(arrayOption)
    expect(arr).toEqual(['a'])
    ;(arr as PluginConfigValue[])[0] = 'z'
    expect(arrayOption.default).toEqual(['a'])

    const objectOption: SchemaObjectOption = {
      key: 'opts',
      label: 'Opts',
      type: 'object',
      properties: [{ key: 'name', label: 'Name', type: 'string' }],
      default: { name: 'x' },
    }
    const obj = getDefaultResetValue(objectOption)
    expect(obj).toEqual({ name: 'x' })
    ;(obj as Record<string, PluginConfigValue>)['name'] = 'y'
    expect(objectOption.default).toEqual({ name: 'x' })

    const keymapOption: SchemaOption = {
      key: 'keys',
      label: 'Keys',
      type: 'plugin-keymap',
      defaultPreset: 'vim',
      commands: [],
      presets: [{ id: 'vim', label: 'Vim', mappings: {} }],
    }
    expect(getDefaultResetValue(keymapOption)).toEqual({ preset: 'vim' })
  })

  it('valueMatchesDefault handles recursive object and plugin-keymap stripping', () => {
    const objectOption: SchemaOption = {
      key: 'root',
      label: 'Root',
      type: 'object',
      properties: [
        { key: 'flag', label: 'Flag', type: 'boolean', default: false },
        { key: 'script', label: 'Script', type: 'lua', default: '' },
      ],
    }
    expect(valueMatchesDefault(objectOption, { flag: false, script: '' })).toBe(
      true,
    )
    expect(valueMatchesDefault(objectOption, { flag: true, script: '' })).toBe(
      false,
    )

    const keymapOption: SchemaOption = {
      key: 'keys',
      label: 'Keys',
      type: 'plugin-keymap',
      defaultPreset: 'default',
      commands: [],
      presets: [{ id: 'default', label: 'Default', mappings: {} }],
    }
    expect(
      valueMatchesDefault(keymapOption, {
        preset: 'default',
        overrides: {},
        _meta: { rebindLinks: {} },
      }),
    ).toBe(true)
  })

  it('canResetOption depends on default match and lua override', () => {
    const stringOption: SchemaOption = {
      key: 'name',
      label: 'Name',
      type: 'string',
      default: 'foo',
    }
    expect(canResetOption(stringOption, 'foo', false)).toBe(false)
    expect(canResetOption(stringOption, 'bar', false)).toBe(true)

    const luaOption: SchemaOption = {
      key: 'handler',
      label: 'Handler',
      type: 'lua',
      default: 'x',
    }
    expect(canResetOption(luaOption, 'x', false)).toBe(false)
    expect(canResetOption(luaOption, 'x', true)).toBe(true)

    const singleSelectOption: SchemaOption = {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [{ label: 'Default', value: 'default' }],
      default: 'default',
    }
    expect(getEffectiveValue(singleSelectOption, undefined)).toBe('default')
    expect(valueMatchesDefault(singleSelectOption, undefined)).toBe(true)
    expect(canResetOption(singleSelectOption, undefined, false)).toBe(false)
  })

  it('treats explicit-only scalar defaults as stored explicit values', () => {
    const explicitOnlySelect: SchemaOption = {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'ivy',
      defaultEmission: 'explicit-only',
      options: [{ label: 'Ivy', value: 'ivy' }],
    }
    expect(valueMatchesDefault(explicitOnlySelect, undefined)).toBe(true)
    expect(valueMatchesDefault(explicitOnlySelect, 'ivy')).toBe(false)
    expect(canResetOption(explicitOnlySelect, 'ivy', false)).toBe(true)
    expect(getDefaultResetValue(explicitOnlySelect)).toBeUndefined()

    const explicitOnlyLua: SchemaLuaOption = {
      key: 'handler',
      label: 'Handler',
      type: 'lua',
      default: 'function() return nil end',
      defaultEmission: 'explicit-only',
    }
    expect(valueMatchesDefault(explicitOnlyLua, undefined)).toBe(true)
    expect(valueMatchesDefault(explicitOnlyLua, explicitOnlyLua.default)).toBe(
      false,
    )
    expect(
      canResetOption(explicitOnlyLua, explicitOnlyLua.default, false),
    ).toBe(true)
    expect(getDefaultResetValue(explicitOnlyLua)).toBeUndefined()
  })

  it('keeps ordinary default-equal values non-resettable', () => {
    const ordinarySelect: SchemaOption = {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'ivy',
      options: [{ label: 'Ivy', value: 'ivy' }],
    }

    expect(valueMatchesDefault(ordinarySelect, 'ivy')).toBe(true)
    expect(canResetOption(ordinarySelect, 'ivy', false)).toBe(false)
  })

  it('treats normal objects with explicit-only children as changed when child is stored', () => {
    const objectOption: SchemaObjectOption = {
      key: 'opts',
      label: 'Opts',
      type: 'object',
      properties: [
        {
          key: 'callback',
          label: 'Callback',
          type: 'lua',
          default: 'function() return nil end',
          defaultEmission: 'explicit-only',
        },
        {
          key: 'other',
          label: 'Other',
          type: 'string',
        },
      ],
    }

    expect(
      valueMatchesDefault(objectOption, {
        callback: 'function() return nil end',
        other: 'keep-me',
      }),
    ).toBe(false)
    expect(
      canResetOption(
        objectOption,
        {
          callback: 'function() return nil end',
          other: 'keep-me',
        },
        false,
      ),
    ).toBe(true)
  })

  it('treats object-level explicit-only defaults as resettable when stored', () => {
    const explicitOnlyObject: SchemaObjectOption = {
      key: 'opts',
      label: 'Opts',
      type: 'object',
      defaultEmission: 'explicit-only',
      properties: [{ key: 'name', label: 'Name', type: 'string' }],
      default: { name: 'x' },
    }

    expect(valueMatchesDefault(explicitOnlyObject, undefined)).toBe(true)
    expect(valueMatchesDefault(explicitOnlyObject, { name: 'x' })).toBe(false)
    expect(getDefaultResetValue(explicitOnlyObject)).toBeUndefined()
    expect(canResetOption(explicitOnlyObject, { name: 'x' }, false)).toBe(true)
  })

  it('multi-select default semantics: empty default, non-empty default, reset, immutability', () => {
    const noDefault: SchemaMultiSelectOption = {
      key: 'modes',
      label: 'Modes',
      type: 'select',
      multi: true,
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    }

    expect(getEffectiveValue(noDefault, undefined)).toEqual([])
    expect(getEffectiveValue(noDefault, ['a'])).toEqual(['a'])
    expect(getDefaultResetValue(noDefault)).toEqual([])
    expect(valueMatchesDefault(noDefault, undefined)).toBe(true)
    expect(valueMatchesDefault(noDefault, [])).toBe(true)
    expect(valueMatchesDefault(noDefault, ['a'])).toBe(false)
    expect(canResetOption(noDefault, undefined, false)).toBe(false)
    expect(canResetOption(noDefault, [], false)).toBe(false)
    expect(canResetOption(noDefault, ['a'], false)).toBe(true)

    const withDefault: SchemaMultiSelectOption = {
      key: 'modes2',
      label: 'Modes 2',
      type: 'select',
      multi: true,
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ],
      default: ['a', 'b'],
    }

    expect(getEffectiveValue(withDefault, undefined)).toEqual(['a', 'b'])
    expect(getEffectiveValue(withDefault, ['c'])).toEqual(['c'])
    expect(getDefaultResetValue(withDefault)).toEqual(['a', 'b'])
    expect(valueMatchesDefault(withDefault, undefined)).toBe(true)
    expect(valueMatchesDefault(withDefault, ['a', 'b'])).toBe(true)
    expect(valueMatchesDefault(withDefault, ['c'])).toBe(false)
    expect(valueMatchesDefault(withDefault, ['b', 'a'])).toBe(false)
    expect(canResetOption(withDefault, undefined, false)).toBe(false)
    expect(canResetOption(withDefault, ['a', 'b'], false)).toBe(false)
    expect(canResetOption(withDefault, ['c'], false)).toBe(true)

    const reset = getDefaultResetValue(withDefault)
    expect(Array.isArray(reset)).toBe(true)
    ;(reset as string[]).push('z')
    expect(withDefault.default).toEqual(['a', 'b'])

    const effective = getEffectiveValue(withDefault, undefined)
    expect(Array.isArray(effective)).toBe(true)
    ;(effective as string[]).push('z')
    expect(withDefault.default).toEqual(['a', 'b'])
  })

  it('forEachDescendantLuaKey and hasAnyOverrideUnderPrefix use dotted paths', () => {
    const identity: OptionIdentity = {
      option: {
        key: 'opts',
        label: 'Opts',
        type: 'object',
        properties: [
          { key: 'a', label: 'A', type: 'lua' },
          {
            key: 'nested',
            label: 'Nested',
            type: 'object',
            properties: [{ key: 'b', label: 'B', type: 'lua' }],
          },
        ],
      },
      ancestors: [
        { key: 'root', label: 'Root', type: 'object', properties: [] },
      ],
    }
    const keys: string[] = []
    forEachDescendantLuaKey(identity, (key) => keys.push(key))
    expect(keys).toEqual(['root.opts.a', 'root.opts.nested.b'])

    expect(
      hasAnyOverrideUnderPrefix({ 'root.opts.a': true }, 'root.opts'),
    ).toBe(true)
    expect(hasAnyOverrideUnderPrefix({ 'root.opts': true }, 'root.opts')).toBe(
      true,
    )
    expect(hasAnyOverrideUnderPrefix({ 'root.other': true }, 'root.opts')).toBe(
      false,
    )
  })
})
