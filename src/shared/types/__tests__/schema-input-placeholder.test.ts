import { describe, expect, it } from 'vitest'
import type { SchemaLuaOption } from '@/shared/types'

describe('SchemaLuaOption inputPlaceholder typing', () => {
  it('accepts inputPlaceholder alongside default', () => {
    const option: SchemaLuaOption = {
      key: 'handler',
      label: 'Handler',
      type: 'lua',
      default: 'function() return nil end',
      inputPlaceholder: '-- example',
    }

    expect(option.inputPlaceholder).toBe('-- example')
    expect(option.default).toBe('function() return nil end')
  })
})
