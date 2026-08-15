import { describe, expect, it } from 'vitest'
import { decodeSchemaId, encodeSchemaId } from '../schema-id-codec'

describe('encodeSchemaId', () => {
  it('passes through simple kebab-case IDs unchanged', () => {
    expect(encodeSchemaId('telescope-nvim')).toBe('telescope-nvim')
  })

  it('passes through IDs with dots unchanged', () => {
    expect(encodeSchemaId('nvim-treesitter')).toBe('nvim-treesitter')
  })

  it('encodes colons', () => {
    expect(encodeSchemaId('github:foo')).toBe('github%3Afoo')
  })

  it('encodes slashes', () => {
    expect(encodeSchemaId('github:a/b')).toBe('github%3Aa%2Fb')
  })

  it('handles complex GitHub IDs', () => {
    expect(encodeSchemaId('github:folke/flash.nvim')).toBe(
      'github%3Afolke%2Fflash.nvim',
    )
  })

  it('is idempotent for already-safe IDs', () => {
    const id = 'my-safe-plugin'
    expect(encodeSchemaId(id)).toBe(id)
  })

  it('encodes differently for a:b vs a--b (bijectivity proof)', () => {
    expect(encodeSchemaId('a:b')).not.toBe(encodeSchemaId('a--b'))
  })

  it('encodes differently for a/b vs a__b (bijectivity proof)', () => {
    expect(encodeSchemaId('a/b')).not.toBe(encodeSchemaId('a__b'))
  })

  it('encodes spaces', () => {
    expect(encodeSchemaId('my plugin')).toBe('my%20plugin')
  })

  it('encodes at-signs', () => {
    expect(encodeSchemaId('@scope/pkg')).toBe('%40scope%2Fpkg')
  })
})

describe('decodeSchemaId', () => {
  it('passes through simple kebab-case keys unchanged', () => {
    expect(decodeSchemaId('telescope-nvim')).toBe('telescope-nvim')
  })

  it('decodes percent-encoded colons', () => {
    expect(decodeSchemaId('github%3Afoo')).toBe('github:foo')
  })

  it('decodes percent-encoded slashes', () => {
    expect(decodeSchemaId('github%3Aa%2Fb')).toBe('github:a/b')
  })

  it('decodes percent-encoded spaces', () => {
    expect(decodeSchemaId('my%20plugin')).toBe('my plugin')
  })

  it('round-trips with encodeSchemaId', () => {
    const ids = [
      'telescope-nvim',
      'github:folke/flash.nvim',
      'github:nvim-treesitter/nvim-treesitter',
      'a:b',
      'a--b',
      'a/b',
      'a__b',
      'some:complex/id:with/many:slashes',
      '@scope/package-name',
      'plugin with spaces',
    ]
    for (const id of ids) {
      expect(decodeSchemaId(encodeSchemaId(id))).toBe(id)
    }
  })

  it('existing kebab-case IDs encode to themselves (backward compat)', () => {
    const existingIds = ['telescope-nvim', 'mason-nvim', 'nvim-treesitter']
    for (const id of existingIds) {
      expect(encodeSchemaId(id)).toBe(id)
      expect(decodeSchemaId(id)).toBe(id)
    }
  })
})
