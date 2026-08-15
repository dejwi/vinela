import { describe, expect, it } from 'vitest'
import type { PortDataType } from '@/shared/types'
import {
  effectiveTier,
  getParamGroupName,
  getParamInputPlaceholder,
} from './param-default-helpers'
import type { ParamInputMode } from './types'

describe('getParamInputPlaceholder', () => {
  describe('requires explicit mode', () => {
    it('returns Lua expression placeholder for lua mode', () => {
      const result = getParamInputPlaceholder('string', 'lua')
      expect(result).toBe('Lua expression')
    })

    it('returns text placeholder for text mode', () => {
      const result = getParamInputPlaceholder('string', 'text')
      expect(result).toBe('Text value')
    })

    it('includes example for lua mode when provided', () => {
      const result = getParamInputPlaceholder('string', 'lua', '{ buf = 0 }')
      expect(result).toBe('Lua expression (e.g. { buf = 0 })')
    })

    it('includes example for text mode when provided', () => {
      const result = getParamInputPlaceholder('string', 'text', 'example.txt')
      expect(result).toBe('Text value (e.g. example.txt)')
    })
  })

  describe('type-specific placeholders', () => {
    const testCases: Array<{
      type: PortDataType
      mode: ParamInputMode
      expected: string
    }> = [
      { type: 'string', mode: 'text', expected: 'Text value' },
      { type: 'string', mode: 'lua', expected: 'Lua expression' },
      { type: 'number', mode: 'text', expected: 'Number' },
      { type: 'number', mode: 'lua', expected: 'Lua expression' },
      { type: 'boolean', mode: 'text', expected: 'true or false' },
      { type: 'boolean', mode: 'lua', expected: 'Lua expression' },
      { type: 'any', mode: 'text', expected: 'Text value' },
      { type: 'any', mode: 'lua', expected: 'Lua expression' },
      { type: 'table', mode: 'text', expected: 'Text value' },
      { type: 'table', mode: 'lua', expected: 'Lua expression' },
      { type: 'buffer', mode: 'text', expected: 'Text value' },
      { type: 'buffer', mode: 'lua', expected: 'Lua expression' },
      { type: 'window', mode: 'text', expected: 'Text value' },
      { type: 'window', mode: 'lua', expected: 'Lua expression' },
    ]

    for (const { type, mode, expected } of testCases) {
      it(`returns "${expected}" for ${type} in ${mode} mode`, () => {
        const result = getParamInputPlaceholder(type, mode)
        expect(result).toBe(expected)
      })
    }
  })

  describe('examples are included in all modes', () => {
    it('text mode includes example', () => {
      const result = getParamInputPlaceholder('number', 'text', '42')
      expect(result).toBe('Number (e.g. 42)')
    })

    it('lua mode includes example', () => {
      const result = getParamInputPlaceholder('boolean', 'lua', 'true')
      expect(result).toBe('Lua expression (e.g. true)')
    })
  })
})

describe('effectiveTier', () => {
  it('keeps declared basic params as basic', () => {
    expect(
      effectiveTier(
        { name: 'cwd', type: 'string', optional: true, tier: 'basic' },
        undefined,
        false,
      ),
    ).toBe('basic')
  })

  it('promotes advanced to basic when value is stored or connected', () => {
    expect(
      effectiveTier(
        { name: 'layout', type: 'string', optional: true, tier: 'advanced' },
        { kind: 'scalar', value: 'ivy' },
        false,
      ),
    ).toBe('basic')
    expect(
      effectiveTier(
        { name: 'layout', type: 'string', optional: true, tier: 'advanced' },
        undefined,
        true,
      ),
    ).toBe('basic')
  })
})

describe('getParamGroupName', () => {
  it('returns General fallback when group is absent', () => {
    expect(
      getParamGroupName({ name: 'cwd', type: 'string', optional: true }),
    ).toBe('General')
  })
})
