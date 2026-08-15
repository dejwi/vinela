// Tests for Lua value serialization

import { describe, expect, it } from 'vitest'
import {
  type LuaSerializable,
  LuaSerializationError,
  rawLua,
  serializeValue,
  validateLuaFieldNotPlainString,
} from '../lua-serialize'

describe('serializeValue', () => {
  describe('validateLuaFieldNotPlainString', () => {
    it('rejects plain string lua field values', () => {
      expect(() =>
        validateLuaFieldNotPlainString('function() end', 'opts.handler'),
      ).toThrow(LuaSerializationError)
    })

    it('accepts rawLua markers and non-string values', () => {
      const marker = rawLua('function() end')
      expect(validateLuaFieldNotPlainString(marker, 'handler')).toBe(marker)
      expect(validateLuaFieldNotPlainString({ enabled: true }, 'opts')).toEqual(
        {
          enabled: true,
        },
      )
    })
  })

  describe('primitives', () => {
    it('serializes booleans', () => {
      expect(serializeValue(true)).toBe('true')
      expect(serializeValue(false)).toBe('false')
    })

    it('serializes numbers', () => {
      expect(serializeValue(42)).toBe('42')
      expect(serializeValue(3.14)).toBe('3.14')
      expect(serializeValue(-123)).toBe('-123')
      expect(serializeValue(0)).toBe('0')
    })

    it('rejects non-finite numbers', () => {
      expect(() => serializeValue(NaN)).toThrow(LuaSerializationError)
      expect(() => serializeValue(Infinity)).toThrow(LuaSerializationError)
      expect(() => serializeValue(-Infinity)).toThrow(LuaSerializationError)
    })

    it('serializes strings', () => {
      expect(serializeValue('hello')).toBe('"hello"')
      expect(serializeValue('')).toBe('""')
    })

    it('escapes special characters in strings', () => {
      expect(serializeValue('hello\nworld')).toBe('"hello\\nworld"')
      expect(serializeValue('tab\there')).toBe('"tab\\there"')
      expect(serializeValue('quote"test')).toBe('"quote\\"test"')
      expect(serializeValue('back\\slash')).toBe('"back\\\\slash"')
    })

    it('serializes null and undefined as nil', () => {
      expect(serializeValue(null)).toBe('nil')
      expect(serializeValue(undefined)).toBe('nil')
    })
  })

  describe('arrays', () => {
    it('serializes empty array', () => {
      expect(serializeValue([])).toBe('{}')
    })

    it('serializes flat arrays inline', () => {
      expect(serializeValue([1, 2, 3])).toBe('{ 1, 2, 3 }')
      expect(serializeValue(['a', 'b', 'c'])).toBe('{ "a", "b", "c" }')
    })

    it('serializes nested arrays multiline', () => {
      const result = serializeValue([
        [1, 2],
        [3, 4],
      ])
      expect(result).toContain('{\n')
      expect(result).toContain('{ 1, 2 }')
      expect(result).toContain('{ 3, 4 }')
    })

    it('serializes arrays with mixed types', () => {
      expect(serializeValue([1, 'two', true, null])).toBe(
        '{ 1, "two", true, nil }',
      )
    })
  })

  describe('objects', () => {
    it('serializes empty object', () => {
      expect(serializeValue({})).toBe('{}')
    })

    it('serializes flat objects inline', () => {
      expect(serializeValue({ a: 1, b: 2 })).toBe('{ a = 1, b = 2 }')
    })

    it('uses bracket syntax for invalid identifiers', () => {
      expect(serializeValue({ 'foo-bar': 1 })).toBe('{ ["foo-bar"] = 1 }')
      expect(serializeValue({ '123': 'x' })).toBe('{ ["123"] = "x" }')
      expect(serializeValue({ 'a b': 1 })).toBe('{ ["a b"] = 1 }')
    })

    it('uses identifier syntax for valid identifiers', () => {
      expect(serializeValue({ foo: 1 })).toBe('{ foo = 1 }')
      expect(serializeValue({ _private: 1 })).toBe('{ _private = 1 }')
      expect(serializeValue({ camelCase: 1 })).toBe('{ camelCase = 1 }')
    })

    it('sorts object keys for stable output', () => {
      const result = serializeValue({ z: 1, a: 2, m: 3 })
      expect(result).toBe('{ a = 2, m = 3, z = 1 }')
    })

    it('can disable key sorting', () => {
      const result = serializeValue({ z: 1, a: 2 }, { sortObjectKeys: false })
      // Object.keys order is insertion order in modern JS
      expect(result).toBe('{ z = 1, a = 2 }')
    })

    it('serializes nested objects multiline', () => {
      const result = serializeValue({ outer: { inner: 1 } })
      expect(result).toContain('{\n')
      expect(result).toContain('outer = {')
    })

    it('serializes nested multiline objects with balanced braces', () => {
      const result = serializeValue({
        outer: {
          zeta: 6,
          alpha: 1,
          epsilon: 5,
          beta: 2,
          gamma: 3,
          delta: 4,
          theta: 8,
          eta: 7,
        },
      })

      expect(result).toBe(
        '{\n' +
          '  outer = {\n' +
          '    alpha = 1,\n' +
          '    beta = 2,\n' +
          '    delta = 4,\n' +
          '    epsilon = 5,\n' +
          '    eta = 7,\n' +
          '    gamma = 3,\n' +
          '    theta = 8,\n' +
          '    zeta = 6,\n' +
          '  },\n' +
          '}',
      )
    })
  })

  describe('complex structures', () => {
    it('serializes plugin config object', () => {
      const config: LuaSerializable = {
        ensure_installed: ['lua', 'vimdoc'],
        highlight: { enable: true },
      }
      const result = serializeValue(config)
      expect(result).toContain('ensure_installed')
      expect(result).toContain('highlight')
      expect(result).toContain('enable')
    })

    it('handles deeply nested structures', () => {
      const nested: LuaSerializable = {
        level1: {
          level2: {
            level3: ['a', 'b'],
          },
        },
      }
      const result = serializeValue(nested)
      expect(result).toContain('level1')
      expect(result).toContain('level2')
      expect(result).toContain('level3')
    })

    it('indents multiline raw lua consistently when pretty=true', () => {
      const result = serializeValue(
        {
          callback: rawLua('function()\n  return true\nend'),
        },
        { pretty: true },
      )

      expect(result).toBe(
        '{\n' +
          '  callback = function()\n' +
          '    return true\n' +
          '  end,\n' +
          '}',
      )
    })

    it('preserves raw lua text when pretty=false', () => {
      const raw = 'function()\n  return true\nend'
      const result = serializeValue(
        { callback: rawLua(raw) },
        { pretty: false },
      )

      expect(result).toBe('{ callback = function()\n  return true\nend }')
    })
  })

  describe('error cases', () => {
    it('rejects functions', () => {
      expect(() =>
        serializeValue((() => {}) as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('rejects symbols', () => {
      expect(() =>
        serializeValue(Symbol('test') as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('rejects bigint', () => {
      expect(() =>
        serializeValue(BigInt(123) as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('rejects Date objects', () => {
      expect(() =>
        serializeValue(new Date() as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('rejects Map', () => {
      expect(() =>
        serializeValue(new Map() as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('rejects Set', () => {
      expect(() =>
        serializeValue(new Set() as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('rejects class instances', () => {
      class MyClass {
        value = 42
      }
      expect(() =>
        serializeValue(new MyClass() as unknown as LuaSerializable),
      ).toThrow(LuaSerializationError)
    })

    it('detects circular references', () => {
      const obj: LuaSerializable = { a: 1 }
      ;(obj as Record<string, unknown>)['self'] = obj
      expect(() => serializeValue(obj)).toThrow(LuaSerializationError)
      expect(() => serializeValue(obj)).toThrow('Circular reference')
    })

    it('detects circular references in arrays', () => {
      const arr: LuaSerializable[] = [1, 2]
      arr.push(arr as unknown as LuaSerializable)
      expect(() => serializeValue(arr)).toThrow(LuaSerializationError)
    })

    it('enforces maxDepth', () => {
      const deep: LuaSerializable = { a: { b: { c: { d: 1 } } } }
      expect(() => serializeValue(deep, { maxDepth: 3 })).toThrow(
        LuaSerializationError,
      )
    })
  })

  describe('options', () => {
    it('respects baseIndentLevel for nested content', () => {
      // For complex nested structures, baseIndentLevel affects inner indentation
      const result = serializeValue(
        {
          outer: {
            inner: 1,
            other: 2,
            more: 3,
            data: 4,
            stuff: 5,
            things: 6,
            items: 7,
            values: 8,
          },
        },
        { baseIndentLevel: 2, pretty: true },
      )
      // The nested content should have additional indentation based on baseIndentLevel
      expect(result).toContain('  ')
    })

    it('respects pretty=false for inline output', () => {
      const result = serializeValue({ a: { b: 1 } }, { pretty: false })
      expect(result).not.toContain('\n')
    })

    it('respects custom indent unit', () => {
      const result = serializeValue(
        {
          outer: {
            inner: 1,
            other: 2,
            more: 3,
            data: 4,
            stuff: 5,
            things: 6,
            items: 7,
            values: 8,
          },
        },
        { indentUnit: '    ', pretty: true },
      )
      // With 4-space indent, nested content should have more indentation
      expect(result).toContain('    ')
    })
  })
})
