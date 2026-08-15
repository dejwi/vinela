import { describe, expect, expectTypeOf, it } from 'vitest'
import { jsonDeepClone } from '../json-clone'

describe('jsonDeepClone', () => {
  it('returns equal value for primitives', () => {
    expect(jsonDeepClone(42)).toBe(42)
    expect(jsonDeepClone('hello')).toBe('hello')
    expect(jsonDeepClone(true)).toBe(true)
    expect(jsonDeepClone(null)).toBe(null)
  })

  it('produces a structurally-equal but independent array (deep)', () => {
    const input = [1, 2, [3, 4]]
    const output = jsonDeepClone(input)
    expect(output).toEqual(input)
    expect(output).not.toBe(input)
    expect(output[2]).not.toBe(input[2])
  })

  it('produces a structurally-equal but independent object (deep)', () => {
    const input = { a: 1, b: { c: 2 } }
    const output = jsonDeepClone(input)
    expect(output).toEqual(input)
    expect(output).not.toBe(input)
    expect(output.b).not.toBe(input.b)
  })

  it('mutating the clone does not affect the original', () => {
    const input = { a: { b: [1, 2] } }
    const output = jsonDeepClone(input)
    output.a.b.push(3)
    expect(input.a.b).toEqual([1, 2])
  })

  it('preserves the inferred generic type at compile time', () => {
    const arr: number[] = [1, 2, 3]
    const cloned = jsonDeepClone(arr)
    expectTypeOf(cloned).toEqualTypeOf<number[]>()
    expect(cloned).toEqual(arr)
  })
})
