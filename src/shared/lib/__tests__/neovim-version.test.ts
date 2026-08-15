import { describe, expect, it } from 'vitest'
import {
  compareParsedNeovimVersions,
  isNeovimVersionAtLeast,
  MIN_SUPPORTED_NEOVIM_VERSION,
  parseNeovimVersionNumeric,
} from '../neovim-version'

describe('parseNeovimVersionNumeric', () => {
  it('parses stable and prerelease versions', () => {
    expect(parseNeovimVersionNumeric('0.11.4')?.normalized).toBe('0.11.4')
    expect(parseNeovimVersionNumeric('0.12.0')?.normalized).toBe('0.12.0')
    expect(parseNeovimVersionNumeric('0.12.4')?.normalized).toBe('0.12.4')
    expect(parseNeovimVersionNumeric('0.12.0-dev+abc')?.normalized).toBe(
      '0.12.0',
    )
    expect(parseNeovimVersionNumeric('1.0.0')?.normalized).toBe('1.0.0')
  })

  it('returns null for malformed text', () => {
    expect(parseNeovimVersionNumeric('')).toBeNull()
    expect(parseNeovimVersionNumeric('not-a-version')).toBeNull()
    expect(parseNeovimVersionNumeric('0.12')).toBeNull()
  })
})

describe('isNeovimVersionAtLeast', () => {
  it('compares against the Vinela baseline', () => {
    expect(isNeovimVersionAtLeast('0.11.4', MIN_SUPPORTED_NEOVIM_VERSION)).toBe(
      false,
    )
    expect(isNeovimVersionAtLeast('0.12.0', MIN_SUPPORTED_NEOVIM_VERSION)).toBe(
      true,
    )
    expect(isNeovimVersionAtLeast('0.12.4', MIN_SUPPORTED_NEOVIM_VERSION)).toBe(
      true,
    )
    expect(
      isNeovimVersionAtLeast('0.12.0-dev', MIN_SUPPORTED_NEOVIM_VERSION),
    ).toBe(true)
    expect(isNeovimVersionAtLeast('1.0.0', MIN_SUPPORTED_NEOVIM_VERSION)).toBe(
      true,
    )
    expect(
      isNeovimVersionAtLeast('garbage', MIN_SUPPORTED_NEOVIM_VERSION),
    ).toBe(false)
  })
})

describe('compareParsedNeovimVersions', () => {
  it('orders major, minor, and patch', () => {
    const a = parseNeovimVersionNumeric('0.11.4')
    const b = parseNeovimVersionNumeric('0.12.0')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    if (a === null || b === null) {
      throw new Error('expected parsed versions')
    }
    expect(compareParsedNeovimVersions(a, b)).toBeLessThan(0)
    expect(compareParsedNeovimVersions(b, a)).toBeGreaterThan(0)
  })
})
