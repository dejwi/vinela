/**
 * Neovim Options Catalog Tests
 *
 * Tests for the comprehensive 67-option catalog.
 * Validates structure, uniqueness, and completeness.
 */

import { describe, expect, it } from 'vitest'
import {
  CATEGORY_ORDER,
  getAdvancedOptions,
  getBasicOptions,
  getDefaultStoredValue,
  getOptionDefinition,
  getOptionsByCategory,
  getPopularOptions,
  NEOVIM_OPTIONS_CATALOG,
  searchOptions,
} from '@/shared/lib/neovim-options/catalog'

describe('NEOVIM_OPTIONS_CATALOG', () => {
  it('should have exactly 67 options', () => {
    expect(NEOVIM_OPTIONS_CATALOG).toHaveLength(67)
  })

  it('should have unique option names', () => {
    const names = NEOVIM_OPTIONS_CATALOG.map((o) => o.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })

  it('should have all required fields', () => {
    for (const option of NEOVIM_OPTIONS_CATALOG) {
      expect(option.name).toBeDefined()
      expect(option.name.length).toBeGreaterThan(0)
      expect(option.label).toBeDefined()
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.whatItDoes).toBeDefined()
      expect(option.whatItDoes.length).toBeGreaterThan(0)
      expect(option.whenToUse).toBeDefined()
      expect(option.whenToUse.length).toBeGreaterThan(0)
      expect(option.category).toBeDefined()
      expect(option.valueType).toBeDefined()
      expect(option.defaultValue).toBeDefined()
      expect(option.defaultSource).toBeDefined()
      expect(option.complexity).toBeDefined()
      expect(option.isPopular).toBeDefined()
      expect(option.isCommunityRecommended).toBeDefined()
    }
  })

  it('should have valid categories', () => {
    const validCategories = new Set(CATEGORY_ORDER)
    for (const option of NEOVIM_OPTIONS_CATALOG) {
      expect(validCategories.has(option.category)).toBe(true)
    }
  })

  it('should have valid value types', () => {
    const validValueTypes = new Set([
      'boolean',
      'number',
      'string',
      'string-list',
      'char-list',
    ])
    for (const option of NEOVIM_OPTIONS_CATALOG) {
      expect(validValueTypes.has(option.valueType)).toBe(true)
    }
  })

  it('should have valid complexity values', () => {
    for (const option of NEOVIM_OPTIONS_CATALOG) {
      expect(['basic', 'advanced']).toContain(option.complexity)
    }
  })

  it('should have exactly 17 popular options', () => {
    const popularOptions = getPopularOptions()
    expect(popularOptions).toHaveLength(17)
  })

  it('should have exactly 28 basic options', () => {
    const basicOptions = getBasicOptions()
    expect(basicOptions).toHaveLength(28)
  })

  it('should have exactly 39 advanced options', () => {
    const advancedOptions = getAdvancedOptions()
    expect(advancedOptions).toHaveLength(39)
  })

  it('should have basic + advanced = total', () => {
    const basic = getBasicOptions().length
    const advanced = getAdvancedOptions().length
    expect(basic + advanced).toBe(67)
  })

  it('should categorize options correctly', () => {
    const expectedCounts: Record<string, number> = {
      keymaps: 1,
      'line-numbers': 2,
      'visual-appearance': 18,
      'text-wrapping': 5,
      indentation: 12,
      search: 8,
      'file-handling': 8,
      'windows-splits': 4,
      completion: 5,
      'clipboard-system': 2,
      performance: 2,
    }

    for (const [category, expected] of Object.entries(expectedCounts)) {
      const options = getOptionsByCategory(
        category as (typeof CATEGORY_ORDER)[number],
      )
      expect(options).toHaveLength(expected)
    }
  })
})

describe('getOptionDefinition', () => {
  it('should find options by name (case insensitive)', () => {
    expect(getOptionDefinition('tabstop')).toBeDefined()
    expect(getOptionDefinition('TABSTOP')).toBeDefined()
    expect(getOptionDefinition('TabStop')).toBeDefined()
  })

  it('should return null for unknown options', () => {
    expect(getOptionDefinition('nonexistent')).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(getOptionDefinition('')).toBeNull()
  })
})

describe('searchOptions', () => {
  it('should return all options for empty query', () => {
    expect(searchOptions('')).toHaveLength(67)
  })

  it('should include newly added visual option keys', () => {
    const allNames = new Set(
      NEOVIM_OPTIONS_CATALOG.map((option) => option.name),
    )

    expect(allNames.has('winblend')).toBe(true)
    expect(allNames.has('pumblend')).toBe(true)
    expect(allNames.has('conceallevel')).toBe(true)
    expect(allNames.has('title')).toBe(true)
    expect(allNames.has('shortmess')).toBe(true)
    expect(allNames.has('fillchars')).toBe(true)
  })

  it('should search by option name', () => {
    const results = searchOptions('tabstop')
    expect(results.some((o) => o.name === 'tabstop')).toBe(true)
  })

  it('should search by label', () => {
    const results = searchOptions('line numbers')
    expect(results.some((o) => o.name === 'number')).toBe(true)
  })

  it('should search by aliases', () => {
    const results = searchOptions('tabs')
    expect(results.some((o) => o.name === 'tabstop')).toBe(true)
  })

  it('should search by whatItDoes', () => {
    const results = searchOptions('clipboard')
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('getDefaultStoredValue', () => {
  it('should return correct value type for booleans', () => {
    const option = getOptionDefinition('number')
    expect(option).not.toBeNull()
    if (option) {
      const stored = getDefaultStoredValue(option)
      expect(stored.valueType).toBe('boolean')
      expect(typeof stored.value).toBe('boolean')
    }
  })

  it('should return correct value type for numbers', () => {
    const option = getOptionDefinition('tabstop')
    expect(option).not.toBeNull()
    if (option) {
      const stored = getDefaultStoredValue(option)
      expect(stored.valueType).toBe('number')
      expect(typeof stored.value).toBe('number')
    }
  })

  it('should return correct value type for strings', () => {
    const option = getOptionDefinition('signcolumn')
    expect(option).not.toBeNull()
    if (option) {
      const stored = getDefaultStoredValue(option)
      expect(stored.valueType).toBe('string')
      expect(typeof stored.value).toBe('string')
    }
  })

  it('should return array for list types', () => {
    const option = getOptionDefinition('clipboard')
    expect(option).not.toBeNull()
    if (option) {
      const stored = getDefaultStoredValue(option)
      expect(['string-list', 'char-list']).toContain(stored.valueType)
      expect(Array.isArray(stored.value)).toBe(true)
    }
  })
})

describe('Popular options', () => {
  it('should include the 17 expected popular options', () => {
    const popularNames = new Set(getPopularOptions().map((o) => o.name))
    const expectedPopular = [
      'mapleader',
      'number',
      'relativenumber',
      'cursorline',
      'signcolumn',
      'termguicolors',
      'expandtab',
      'tabstop',
      'shiftwidth',
      'ignorecase',
      'smartcase',
      'inccommand',
      'scrolloff',
      'undofile',
      'splitright',
      'splitbelow',
      'clipboard',
    ]

    for (const name of expectedPopular) {
      expect(popularNames.has(name)).toBe(true)
    }
    expect(popularNames.size).toBe(17)
  })
})

describe('Leader Key in Keymaps Category', () => {
  it('includes leader key in NEOVIM_OPTIONS_CATALOG', () => {
    const leaderOption = NEOVIM_OPTIONS_CATALOG.find(
      (o) => o.name === 'mapleader',
    )
    expect(leaderOption).toBeDefined()
    expect(leaderOption?.category).toBe('keymaps')
  })

  it('includes keymaps in CATEGORY_ORDER', () => {
    expect(CATEGORY_ORDER).toContain('keymaps')
    expect(CATEGORY_ORDER[0]).toBe('keymaps') // First category
  })

  it('finds leader key by search aliases', () => {
    const results = searchOptions('leader')
    expect(results.some((o) => o.name === 'mapleader')).toBe(true)
  })

  it('finds leader key by "mapleader" search', () => {
    const results = searchOptions('mapleader')
    expect(results.some((o) => o.name === 'mapleader')).toBe(true)
  })

  it('finds leader key by "prefix key" search', () => {
    const results = searchOptions('prefix key')
    expect(results.some((o) => o.name === 'mapleader')).toBe(true)
  })
})
