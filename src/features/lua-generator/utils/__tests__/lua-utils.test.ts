// Tests for Lua utility functions

import { describe, expect, it } from 'vitest'
import {
  buildCallableKeyByGraphId,
  formatAutocmdCallbackId,
  formatCallableId,
  isLuaReservedWord,
  sanitizeLuaIdentifier,
  sanitizeLuaIdentifierList,
  shortIdFromUuid,
  stripLuaLongBracketLiterals,
} from '../../lua-utils'

describe('isLuaReservedWord', () => {
  it('returns true for reserved words', () => {
    expect(isLuaReservedWord('end')).toBe(true)
    expect(isLuaReservedWord('local')).toBe(true)
    expect(isLuaReservedWord('function')).toBe(true)
    expect(isLuaReservedWord('if')).toBe(true)
    expect(isLuaReservedWord('then')).toBe(true)
  })

  it('returns false for non-reserved words', () => {
    expect(isLuaReservedWord('foo')).toBe(false)
    expect(isLuaReservedWord('myVar')).toBe(false)
    expect(isLuaReservedWord('endGame')).toBe(false) // contains 'end' but isn't 'end'
  })

  it('is case-sensitive', () => {
    expect(isLuaReservedWord('END')).toBe(false)
    expect(isLuaReservedWord('End')).toBe(false)
  })
})

describe('sanitizeLuaIdentifier', () => {
  it('replaces invalid characters with underscore', () => {
    expect(sanitizeLuaIdentifier('my-input')).toBe('my_input')
    expect(sanitizeLuaIdentifier('foo@bar')).toBe('foo_bar')
    expect(sanitizeLuaIdentifier('a.b.c')).toBe('a_b_c')
  })

  it('prefixes digit-starting names with underscore', () => {
    expect(sanitizeLuaIdentifier('123abc')).toBe('_123abc')
    expect(sanitizeLuaIdentifier('0start')).toBe('_0start')
  })

  it('returns _unnamed for empty result', () => {
    expect(sanitizeLuaIdentifier('')).toBe('_unnamed')
    // '!!!' becomes '___' which is not empty, so it's returned as-is
    expect(sanitizeLuaIdentifier('!!!')).toBe('___')
  })

  it('prefixes reserved words with underscore', () => {
    expect(sanitizeLuaIdentifier('end')).toBe('_end')
    expect(sanitizeLuaIdentifier('local')).toBe('_local')
    expect(sanitizeLuaIdentifier('function')).toBe('_function')
  })

  it('combines multiple rules', () => {
    // Reserved word that also has invalid chars
    // "end-game" -> "end_game" (invalid char replaced)
    // "end_game" is not a reserved word (only "end" is), so no prefix
    expect(sanitizeLuaIdentifier('end-game')).toBe('end_game')
    // Digit-starting reserved word
    expect(sanitizeLuaIdentifier('1end')).toBe('_1end')
  })

  it('leaves valid identifiers unchanged', () => {
    expect(sanitizeLuaIdentifier('foo')).toBe('foo')
    expect(sanitizeLuaIdentifier('_private')).toBe('_private')
    expect(sanitizeLuaIdentifier('camelCase')).toBe('camelCase')
    expect(sanitizeLuaIdentifier('snake_case')).toBe('snake_case')
    expect(sanitizeLuaIdentifier('ABC123')).toBe('ABC123')
  })
})

describe('sanitizeLuaIdentifierList', () => {
  it('sanitizes single name', () => {
    expect(sanitizeLuaIdentifierList(['my-input'])).toEqual(['my_input'])
  })

  it('resolves collisions', () => {
    // Both 'my-input' and 'my_input' sanitize to 'my_input'
    expect(sanitizeLuaIdentifierList(['my-input', 'my_input'])).toEqual([
      'my_input',
      'my_input_2',
    ])
  })

  it('handles multiple collisions', () => {
    // 'my-input' and 'my_input' both become 'my_input'
    // 'my__input' stays 'my__input' (different from 'my_input')
    expect(
      sanitizeLuaIdentifierList(['my-input', 'my_input', 'my__input']),
    ).toEqual(['my_input', 'my_input_2', 'my__input'])
  })

  it('handles empty and whitespace-only names', () => {
    // Empty, whitespace-only, and reserved word
    expect(sanitizeLuaIdentifierList(['', '   ', 'end'])).toEqual([
      '_unnamed',
      '_unnamed_2',
      '_end',
    ])
  })

  it('trim whitespace before sanitizing', () => {
    expect(sanitizeLuaIdentifierList(['  foo  ', '\tbar\n'])).toEqual([
      'foo',
      'bar',
    ])
  })

  it('preserves unique names', () => {
    expect(sanitizeLuaIdentifierList(['foo', 'bar', 'baz'])).toEqual([
      'foo',
      'bar',
      'baz',
    ])
  })

  it('handles mixed valid and invalid names', () => {
    expect(
      sanitizeLuaIdentifierList(['valid', 'my-input', 'valid', 'other']),
    ).toEqual(['valid', 'my_input', 'valid_2', 'other'])
  })

  it('is deterministic for repeated calls', () => {
    const input = ['a-b', 'a_b', 'a__b']
    const result1 = sanitizeLuaIdentifierList(input)
    const result2 = sanitizeLuaIdentifierList(input)
    expect(result1).toEqual(result2)
  })

  it('handles reserved words collisions', () => {
    // 'end' and '_end' both sanitize to '_end'
    expect(sanitizeLuaIdentifierList(['end', '_end'])).toEqual([
      '_end',
      '_end_2',
    ])
  })

  it('handles empty array', () => {
    expect(sanitizeLuaIdentifierList([])).toEqual([])
  })
})

describe('shortIdFromUuid', () => {
  it('uses first 6 hex chars from uuid', () => {
    expect(shortIdFromUuid('410c1f2c-a41b-4f70-b465-21382c4e3240')).toBe(
      '410c1f',
    )
  })

  it('falls back for non-uuid ids', () => {
    expect(shortIdFromUuid('graph-1')).toBe('graph_')
  })
})

describe('formatCallableId', () => {
  it('combines sanitized name and short id', () => {
    expect(
      formatCallableId(
        'Format on Save',
        '410c1f2c-a41b-4f70-b465-21382c4e3240',
      ),
    ).toBe('Format_on_Save_410c1f')
  })

  it('falls back to graph name when empty', () => {
    expect(
      formatCallableId('   ', 'a1b2c3d4-0000-0000-0000-000000000000'),
    ).toBe('graph_a1b2c3')
  })

  it('produces sanitizedName_<6hex> for real UUIDs', () => {
    expect(
      formatCallableId(
        'Format and Save',
        '5820a708-7704-4dcf-8778-ac2b9cce70c9',
      ),
    ).toBe('Format_and_Save_5820a7')
  })

  it('falls back to first 6 sanitized chars for synthetic ids', () => {
    expect(formatCallableId('callable-only-graph', 'callable-only-graph')).toBe(
      'callable_only_graph_callab',
    )
  })

  it('uses graph base when name is empty', () => {
    expect(formatCallableId('', '5820a708-7704-4dcf-8778-ac2b9cce70c9')).toBe(
      'graph_5820a7',
    )
  })
})

describe('formatAutocmdCallbackId', () => {
  it('uses autocmd_callback_ prefix with callable id policy', () => {
    expect(
      formatAutocmdCallbackId(
        'Format and Save',
        '5820a708-7704-4dcf-8778-ac2b9cce70c9',
      ),
    ).toBe('autocmd_callback_Format_and_Save_5820a7')
  })
})

describe('buildCallableKeyByGraphId', () => {
  it('builds keys for graph ids using graph names', () => {
    const keys = buildCallableKeyByGraphId([
      { graphId: 'graph-a', graphName: 'My Graph' },
      { graphId: 'graph-b', graphName: 'Other Graph' },
    ])

    expect(keys.get('graph-a')).toBe(formatCallableId('My Graph', 'graph-a'))
    expect(keys.get('graph-b')).toBe(formatCallableId('Other Graph', 'graph-b'))
  })

  it('adds deterministic suffixes for key collisions', () => {
    const keys = buildCallableKeyByGraphId([
      { graphId: 'a-b', graphName: 'Same Name' },
      { graphId: 'a_b', graphName: 'Same Name' },
    ])

    expect(keys.get('a-b')).toBe(formatCallableId('Same Name', 'a-b'))
    expect(keys.get('a_b')).toBe(`${formatCallableId('Same Name', 'a_b')}_2`)
  })
})

describe('stripLuaLongBracketLiterals', () => {
  it.each([
    ['[[function if end]]', ' '],
    ['[=[for while end]=]', ' '],
    ['[==[repeat until]==]', ' '],
  ])('strips complete long-bracket literals', (input, expected) => {
    expect(stripLuaLongBracketLiterals(input)).toBe(expected)
  })

  it('matches long-bracket closers at the opening delimiter level', () => {
    expect(
      stripLuaLongBracketLiterals(
        'local before = true\n[=[ function ]] if end ]=]\nlocal after = true',
      ),
    ).toBe('local before = true\n \nlocal after = true')
  })

  it.each([
    'local marker = "[["\nif ready\n]]',
    "local marker = '[[ '\nif ready\n]]",
    '-- [[ marker\nif ready\n]]',
  ])('preserves opener-shaped text outside long-bracket tokens', (input) => {
    expect(stripLuaLongBracketLiterals(input)).toBe(input)
  })

  it('removes a long comment including its prefix', () => {
    expect(stripLuaLongBracketLiterals('--[=[x]=] if ready')).toBe('  if ready')
  })

  it('preserves executable Lua without long-bracket literals', () => {
    expect(stripLuaLongBracketLiterals('if ready then\nend')).toBe(
      'if ready then\nend',
    )
  })
})
