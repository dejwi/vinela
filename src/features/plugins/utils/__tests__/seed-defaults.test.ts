import { describe, expect, it } from 'vitest'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import { seedWithLuaDefaults } from '../seed-defaults'

describe('seedOptionValue characterization', () => {
  const objectOption: SchemaOption = {
    key: 'opts',
    label: 'Opts',
    type: 'object',
    properties: [
      {
        key: 'flag',
        label: 'Flag',
        type: 'boolean',
        default: false,
      },
      {
        key: 'luaField',
        label: 'Lua',
        type: 'lua',
        default: 'return 1',
      },
      {
        key: 'explicitLua',
        label: 'Explicit Lua',
        type: 'lua',
        default: 'return 2',
        defaultEmission: 'explicit-only',
      },
      {
        key: 'modes',
        label: 'Modes',
        type: 'select',
        multi: true,
        options: [{ label: 'A', value: 'a' }],
        default: ['a', 1 as unknown as string],
      },
    ],
  }

  const pluginKeymapOption: SchemaOption = {
    key: 'keys',
    label: 'Keys',
    type: 'plugin-keymap',
    defaultPreset: 'default',
    commands: [],
    presets: [{ id: 'default', label: 'Default', mappings: {} }],
  }

  const arrayOption: SchemaOption = {
    key: 'items',
    label: 'Items',
    type: 'array',
    items: { itemType: 'string' },
    default: ['ok', 1, true, { bad: true }],
    defaultEmission: 'emit',
  }

  const explicitArrayOption: SchemaOption = {
    key: 'hidden',
    label: 'Hidden',
    type: 'array',
    items: { itemType: 'string' },
    default: ['x'],
    defaultEmission: 'explicit-only',
  }

  it('preserves exact seeded config shape for mixed option kinds', () => {
    const seeded = seedWithLuaDefaults(
      {
        opts: { flag: true } as PluginConfigValue,
        items: ['user'] as PluginConfigValue,
        stray: 'kept' as PluginConfigValue,
      },
      [objectOption, pluginKeymapOption, arrayOption, explicitArrayOption],
    )

    expect(seeded).toEqual({
      opts: {
        flag: true,
        luaField: 'return 1',
      },
      keys: { preset: 'default' },
      items: ['user'],
      stray: 'kept',
    })
  })

  it('preserves absent object seeding when no child values resolve', () => {
    const emptyObjectOption: SchemaOption = {
      key: 'empty',
      label: 'Empty',
      type: 'object',
      properties: [
        {
          key: 'luaOnly',
          label: 'Lua Only',
          type: 'lua',
          defaultEmission: 'explicit-only',
        },
      ],
    }

    expect(seedWithLuaDefaults({}, [emptyObjectOption])).toEqual({})
  })
})
