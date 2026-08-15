import { describe, expect, it } from 'vitest'
import snacksSchema from '@/schemas/snacks-nvim.json'
import type { PluginSchema, SchemaOption } from '@/shared/types'
import { buildEffectiveKeyMap, effectiveKey } from '../effective-key'

describe('effectiveKey', () => {
  it('returns key when emitKey is absent', () => {
    const option: SchemaOption = {
      key: 'picker.enabled',
      label: 'Enable Picker',
      type: 'boolean',
      default: false,
    }

    expect(effectiveKey(option)).toBe('picker.enabled')
  })

  it('returns emitKey when present', () => {
    const option: SchemaOption = {
      key: 'picker.sourcesRaw',
      emitKey: 'picker.sources',
      label: 'Sources Raw',
      type: 'lua',
      default: '{}',
    }

    expect(effectiveKey(option)).toBe('picker.sources')
  })

  it('buildEffectiveKeyMap includes aliased snacks key', () => {
    const schema = snacksSchema as PluginSchema
    const map = buildEffectiveKeyMap(schema)

    expect(map.get('picker.sourcesRaw')).toBe('picker.sources')
  })
})
