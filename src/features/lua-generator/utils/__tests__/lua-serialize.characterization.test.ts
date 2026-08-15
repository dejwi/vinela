import { describe, expect, it } from 'vitest'
import { LuaSerializationError, rawLua, serializeValue } from '../lua-serialize'

function expectLuaSerializationError(
  action: () => void,
  expected: { name: 'LuaSerializationError'; message: string },
): void {
  try {
    action()
    throw new Error('Expected LuaSerializationError to be thrown')
  } catch (error: unknown) {
    if (!(error instanceof LuaSerializationError)) {
      throw error
    }
    expect({ name: error.name, message: error.message }).toEqual(expected)
  }
}

describe('serializeValue characterization', () => {
  it('preserves exact success-case lua strings', () => {
    expect(serializeValue(true)).toBe('true')
    expect(serializeValue(42)).toBe('42')
    expect(serializeValue(null)).toBe('nil')
    expect(serializeValue(undefined)).toBe('nil')
    expect(serializeValue('a"b\\c\nd\te')).toBe('"a\\"b\\\\c\\nd\\te"')
    expect(serializeValue([])).toBe('{}')
    expect(serializeValue({})).toBe('{}')
    expect(serializeValue({ a: [1, { b: 2 }] })).toBe(
      '{\n  a = {\n    1,\n    { b = 2 },\n  },\n}',
    )
    expect(serializeValue({ foo: 1, 'foo-bar': 2, '123': 3 })).toBe(
      '{ ["123"] = 3, foo = 1, ["foo-bar"] = 2 }',
    )
    expect(
      serializeValue({ z: 1, a: 2 }, { sortObjectKeys: true, pretty: false }),
    ).toBe('{ a = 2, z = 1 }')
    expect(
      serializeValue({ z: 1, a: 2 }, { sortObjectKeys: false, pretty: false }),
    ).toBe('{ z = 1, a = 2 }')
    expect(
      serializeValue({ a: 1, b: 'x', c: true, d: null }, { pretty: false }),
    ).toBe('{ a = 1, b = "x", c = true, d = nil }')
    expect(serializeValue({ a: 1 }, { pretty: true })).toBe('{ a = 1 }')
    expect(
      serializeValue(
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
      ),
    ).toBe(
      [
        '{',
        '      outer = {',
        '        data = 4,',
        '        inner = 1,',
        '        items = 7,',
        '        more = 3,',
        '        other = 2,',
        '        stuff = 5,',
        '        things = 6,',
        '        values = 8,',
        '      },',
        '    }',
      ].join('\n'),
    )
    expect(
      serializeValue(
        { cb: rawLua('function()\n  return 1\nend') },
        { pretty: true },
      ),
    ).toBe(['{', '  cb = function()', '    return 1', '  end,', '}'].join('\n'))
  })

  it('preserves exact rejection contracts', () => {
    const deep = { a: { b: { c: { d: 1 } } } }
    const circular: { a: number; self?: unknown } = { a: 1 }
    circular.self = circular
    const circularArray: unknown[] = [1]
    circularArray.push(circularArray)
    class ExampleClass {
      readonly value = 1
    }

    expectLuaSerializationError(() => serializeValue(NaN), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize non-finite number: NaN',
    })
    expectLuaSerializationError(() => serializeValue(Infinity), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize non-finite number: Infinity',
    })
    expectLuaSerializationError(() => serializeValue(-Infinity), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize non-finite number: -Infinity',
    })
    expectLuaSerializationError(() => serializeValue((() => {}) as never), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize functions',
    })
    expectLuaSerializationError(() => serializeValue(Symbol('x') as never), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize symbols',
    })
    expectLuaSerializationError(() => serializeValue(BigInt(1) as never), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize bigint',
    })
    expectLuaSerializationError(() => serializeValue(new Date() as never), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize Date objects',
    })
    expectLuaSerializationError(() => serializeValue(new Map() as never), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize Map',
    })
    expectLuaSerializationError(() => serializeValue(new Set() as never), {
      name: 'LuaSerializationError',
      message: 'Cannot serialize Set',
    })
    expectLuaSerializationError(
      () => serializeValue(new ExampleClass() as never),
      {
        name: 'LuaSerializationError',
        message: 'Cannot serialize class instances',
      },
    )
    expectLuaSerializationError(() => serializeValue(circular as never), {
      name: 'LuaSerializationError',
      message: 'Circular reference detected',
    })
    expectLuaSerializationError(() => serializeValue(circularArray as never), {
      name: 'LuaSerializationError',
      message: 'Circular reference detected',
    })
    expectLuaSerializationError(() => serializeValue(deep, { maxDepth: 3 }), {
      name: 'LuaSerializationError',
      message: 'Maximum serialization depth (3) exceeded',
    })
  })
})
