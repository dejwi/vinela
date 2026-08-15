import { describe, expect, it } from 'vitest'
import { isRunFunctionDefaultValue } from '@/shared/types'

describe('isRunFunctionDefaultValue', () => {
  it('accepts scalar and lua variants', () => {
    expect(isRunFunctionDefaultValue({ kind: 'scalar', value: 'x' })).toBe(true)
    expect(
      isRunFunctionDefaultValue({ kind: 'lua', lua: 'vim.fn.getcwd()' }),
    ).toBe(true)
  })

  it('accepts multiselect and object variants', () => {
    expect(
      isRunFunctionDefaultValue({ kind: 'multiselect', values: ['a', 'b'] }),
    ).toBe(true)
    expect(
      isRunFunctionDefaultValue({
        kind: 'object',
        entries: {
          foo: { kind: 'scalar', value: true },
          bar: { kind: 'multiselect', values: ['x'] },
        },
      }),
    ).toBe(true)
  })

  it('rejects invalid nested object shapes', () => {
    expect(
      isRunFunctionDefaultValue({
        kind: 'object',
        entries: { x: { kind: 'bogus' } },
      }),
    ).toBe(false)
  })
})
