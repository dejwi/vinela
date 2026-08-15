import { describe, expect, it } from 'vitest'
import { generateLeaderKeySection } from '../leader-key-section'

describe('generateLeaderKeySection', () => {
  it('returns empty result when leaderKey is undefined', () => {
    const result = generateLeaderKeySection({ leaderKey: undefined })
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('returns empty result when leaderKey is empty string', () => {
    const result = generateLeaderKeySection({ leaderKey: '' })
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('returns empty result when leaderKey is backslash (default)', () => {
    const result = generateLeaderKeySection({ leaderKey: '\\' })
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('generates leader key section for space', () => {
    const result = generateLeaderKeySection({ leaderKey: ' ' })
    expect(result.code).toEqual([
      '-- Leader key (must be set before any keymaps)',
      'vim.g.mapleader = " "',
      'vim.g.maplocalleader = " "',
    ])
    expect(result.diagnostics).toEqual([])
  })

  it('generates leader key section for comma', () => {
    const result = generateLeaderKeySection({ leaderKey: ',' })
    expect(result.code).toEqual([
      '-- Leader key (must be set before any keymaps)',
      'vim.g.mapleader = ","',
      'vim.g.maplocalleader = ","',
    ])
  })

  it('generates leader key section for semicolon', () => {
    const result = generateLeaderKeySection({ leaderKey: ';' })
    expect(result.code).toEqual([
      '-- Leader key (must be set before any keymaps)',
      'vim.g.mapleader = ";"',
      'vim.g.maplocalleader = ";"',
    ])
  })

  it('escapes special characters in leader key', () => {
    const result = generateLeaderKeySection({ leaderKey: '"quoted"' })
    expect(result.code[1]).toBe('vim.g.mapleader = "\\"quoted\\""')
  })

  it('escapes backslash in leader key', () => {
    const result = generateLeaderKeySection({ leaderKey: '\\' })
    // Single backslash is the default, so nothing should be emitted
    expect(result.code).toEqual([])
  })

  it('generates for custom leader key', () => {
    const result = generateLeaderKeySection({ leaderKey: 'm' })
    expect(result.code).toEqual([
      '-- Leader key (must be set before any keymaps)',
      'vim.g.mapleader = "m"',
      'vim.g.maplocalleader = "m"',
    ])
  })
})
