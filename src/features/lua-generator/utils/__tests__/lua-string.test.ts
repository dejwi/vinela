// Tests for Lua string escaping

import { describe, expect, it } from 'vitest'
import { escapeLuaString } from '../lua-string'

describe('escapeLuaString', () => {
  it('escapes backslash', () => {
    expect(escapeLuaString('a\\b')).toBe('a\\\\b')
    expect(escapeLuaString('\\\\')).toBe('\\\\\\\\')
  })

  it('escapes double quote', () => {
    expect(escapeLuaString('say "hello"')).toBe('say \\"hello\\"')
    expect(escapeLuaString('"')).toBe('\\"')
  })

  it('escapes newline', () => {
    expect(escapeLuaString('line1\nline2')).toBe('line1\\nline2')
  })

  it('escapes carriage return', () => {
    expect(escapeLuaString('line1\rline2')).toBe('line1\\rline2')
  })

  it('escapes tab', () => {
    expect(escapeLuaString('col1\tcol2')).toBe('col1\\tcol2')
  })

  it('escapes null', () => {
    expect(escapeLuaString('a\0b')).toBe('a\\0b')
  })

  it('escapes control characters via decimal escapes', () => {
    expect(escapeLuaString('\x01')).toBe('\\001')
    expect(escapeLuaString('\x1f')).toBe('\\031')
    expect(escapeLuaString('\x7f')).toBe('\\127')
  })

  it('leaves printable unicode intact', () => {
    expect(escapeLuaString('Hello 世界 🌍')).toBe('Hello 世界 🌍')
    expect(escapeLuaString('café')).toBe('café')
    expect(escapeLuaString('αβγ')).toBe('αβγ')
  })

  it('handles empty string', () => {
    expect(escapeLuaString('')).toBe('')
  })

  it('handles mixed backslashes and quotes', () => {
    // Input: C:\"path"file"
    // Output: C:\\\"path\"file\"
    const input = 'C:\\"path"file"'
    const result = escapeLuaString(input)
    expect(result).toContain('\\\\') // escaped backslashes
    expect(result).toContain('\\"') // escaped quotes
  })

  it('handles all special chars in one string', () => {
    const input = '\0\n\r\t\\"'
    const expected = '\\0\\n\\r\\t\\\\\\"'
    expect(escapeLuaString(input)).toBe(expected)
  })
})
