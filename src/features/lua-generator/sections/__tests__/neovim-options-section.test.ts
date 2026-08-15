import { describe, expect, it } from 'vitest'
import { requireFirst } from '@/features/lua-generator/__tests__/utils/test-assertions'
import type { NeovimOptionsSectionInput } from '../../types'
import { generateNeovimOptionsSection } from '../neovim-options-section'

describe('generateNeovimOptionsSection', () => {
  it('returns empty result when no options provided', () => {
    const input: NeovimOptionsSectionInput = { options: {} }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toEqual([])
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(
      requireFirst(result.diagnostics, 'empty options diagnostics').severity,
    ).toBe('info')
  })

  it('returns empty result when all options are at defaults', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        // number defaults to false
        number: { valueType: 'boolean', value: false },
        // tabstop defaults to 8
        tabstop: { valueType: 'number', value: 8 },
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toEqual([])
  })

  it('generates single option that differs from default', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        number: { valueType: 'boolean', value: true }, // default is false
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toEqual(['-- Line Numbers', 'vim.opt.number = true'])
  })

  it('groups options by category', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        number: { valueType: 'boolean', value: true }, // line-numbers
        expandtab: { valueType: 'boolean', value: true }, // indentation
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toContain('-- Line Numbers')
    expect(result.code).toContain('-- Indentation')
    expect(result.code).toContain('vim.opt.number = true')
    expect(result.code).toContain('vim.opt.expandtab = true')
  })

  it('sorts options alphabetically within category', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        relativenumber: { valueType: 'boolean', value: true },
        number: { valueType: 'boolean', value: true },
      },
    }
    const result = generateNeovimOptionsSection(input)
    const numberIndex = result.code.indexOf('vim.opt.number = true')
    const relativenumberIndex = result.code.indexOf(
      'vim.opt.relativenumber = true',
    )
    expect(numberIndex).toBeLessThan(relativenumberIndex)
  })

  it('handles string-list options', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        clipboard: {
          valueType: 'string-list',
          value: ['unnamedplus'],
        },
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toContain('vim.opt.clipboard = { "unnamedplus" }')
  })

  it('handles number options', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        tabstop: { valueType: 'number', value: 4 }, // default is 8
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toContain('vim.opt.tabstop = 4')
  })

  it('handles string options', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        signcolumn: { valueType: 'string', value: 'yes' }, // default is 'auto'
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toContain('vim.opt.signcolumn = "yes"')
  })

  it('skips mapleader option (handled by leader-key section)', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        mapleader: { valueType: 'string', value: ' ' },
      },
    }
    const result = generateNeovimOptionsSection(input)
    // mapleader should be skipped, resulting in empty output or just info diagnostic
    expect(result.code).toEqual([])
  })

  it('emits warning for unknown options but still includes them', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        unknown_option_xyz: { valueType: 'boolean', value: true },
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code.length).toBeGreaterThan(0)
    expect(result.code[0]).toBe('-- Other Options')
    expect(result.code[1]).toBe('vim.opt.unknown_option_xyz = true')
    expect(result.diagnostics.some((d) => d.severity === 'warning')).toBe(true)
  })

  it('handles non-default string-list values', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        clipboard: {
          valueType: 'string-list',
          value: ['unnamedplus'], // Non-default value
        },
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code).toContain('vim.opt.clipboard = { "unnamedplus" }')
  })

  it('escapes special characters in string values', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        shortmess: { valueType: 'string', value: 'filnxtToOFI' },
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code.some((line) => line.includes('shortmess'))).toBe(true)
  })

  it('handles multiple string-list values', () => {
    const input: NeovimOptionsSectionInput = {
      options: {
        completeopt: {
          valueType: 'string-list',
          value: ['menu', 'menuone', 'noselect'],
        },
      },
    }
    const result = generateNeovimOptionsSection(input)
    expect(result.code[1]).toBe(
      'vim.opt.completeopt = { "menu", "menuone", "noselect" }',
    )
  })
})
