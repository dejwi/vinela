import { describe, expect, it } from 'vitest'
import snacksSchema from '@/schemas/snacks-nvim.json'
import type { PluginSchema } from '@/shared/types'
import { assertSchemaShape } from '../schema-shape-invariants'

function createSchema(options: PluginSchema['options']): PluginSchema {
  return {
    id: 'test-schema',
    pluginName: 'Test',
    pluginRepo: 'owner/test',
    version: '1.0.0',
    options,
    functions: [],
  }
}

describe('assertSchemaShape', () => {
  it('allows lua key with typed descendant (structural coexistence)', () => {
    const schema = createSchema([
      { key: 'foo', label: 'Foo', type: 'lua', default: '{}' },
      { key: 'foo.bar', label: 'Bar', type: 'boolean', default: false },
    ])

    expect(() => assertSchemaShape(schema)).not.toThrow()
  })

  it('allows aliased lua parent with typed descendants (snacks pattern)', () => {
    const schema = createSchema([
      {
        key: 'fooRaw',
        emitKey: 'foo',
        label: 'Foo Raw',
        type: 'lua',
        default: '{}',
      },
      { key: 'foo.bar', label: 'Bar', type: 'boolean', default: false },
    ])

    expect(() => assertSchemaShape(schema)).not.toThrow()
  })

  it('throws when effective keys collide', () => {
    const schema = createSchema([
      {
        key: 'alphaRaw',
        emitKey: 'alpha',
        label: 'Alpha',
        type: 'lua',
        default: '{}',
      },
      { key: 'alpha', label: 'Alpha Bool', type: 'boolean', default: false },
    ])

    expect(() => assertSchemaShape(schema)).toThrow('effective key collision')
  })

  it('does not throw for unrelated keys', () => {
    const schema = createSchema([
      { key: 'a', label: 'A', type: 'lua', default: '{}' },
      { key: 'b.c', label: 'B', type: 'boolean', default: false },
    ])

    expect(() => assertSchemaShape(schema)).not.toThrow()
  })

  it('passes real snacks schema', () => {
    const schema = snacksSchema as PluginSchema
    expect(() => assertSchemaShape(schema)).not.toThrow()
  })
})
