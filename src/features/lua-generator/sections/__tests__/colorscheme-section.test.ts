import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findCatalogEntry } from '@/features/colorschemes/utils'
import type { ColorSchemeCatalogEntry } from '@/shared/types'
import { generateColorschemeSection } from '../colorscheme-section'

vi.mock('@/features/colorschemes/utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/colorschemes/utils')>()
  return {
    ...actual,
    findCatalogEntry: vi.fn(actual.findCatalogEntry),
  }
})

const ESCAPABLE_FRAGMENT = '"\n\r\\'

function makeMinimalCatalogEntry(
  overrides: Partial<ColorSchemeCatalogEntry>,
): ColorSchemeCatalogEntry {
  return {
    id: 'synthetic-test',
    name: 'Synthetic Test',
    repoUrl: 'https://github.com/test/synthetic',
    description: 'Synthetic catalog entry for generator tests',
    variant: 'dark',
    vimColorscheme: `theme${ESCAPABLE_FRAGMENT}`,
    pluginRepo: 'https://github.com/test/synthetic.nvim',
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      lineNumber: '#666666',
      lineHighlight: '#111111',
      selection: '#222222',
      cursor: '#ffffff',
      tokens: {
        comment: '#888888',
        keyword: '#ff0000',
        string: '#00ff00',
        number: '#0000ff',
        function: '#ffff00',
        variable: '#ffffff',
        type: '#00ffff',
        constant: '#ff00ff',
        operator: '#cccccc',
        punctuation: '#aaaaaa',
      },
      ui: {
        statusLine: '#333333',
        statusLineText: '#ffffff',
        tabLine: '#222222',
        tabLineText: '#cccccc',
        tabLineSel: '#444444',
        tabLineSelText: '#ffffff',
        border: '#555555',
      },
    },
    ...overrides,
  }
}

describe('generateColorschemeSection', () => {
  beforeEach(() => {
    vi.mocked(findCatalogEntry).mockRestore()
  })

  afterEach(() => {
    vi.mocked(findCatalogEntry).mockRestore()
  })

  it('returns empty result when activeScheme is null', () => {
    const result = generateColorschemeSection({ activeScheme: null })
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('reports a diagnostic for an unknown catalog ID', () => {
    const result = generateColorschemeSection({
      activeScheme: 'nonexistent-catalog-id',
    })

    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.message).toContain(
      "Colorscheme 'nonexistent-catalog-id' not found in catalog",
    )
    expect(result.code).toEqual([])
  })

  it('generates pcall-wrapped colorscheme command for entry without activation', () => {
    const result = generateColorschemeSection({
      activeScheme: 'tokyonight-storm',
    })

    expect(result.diagnostics).toEqual([])
    expect(result.code).toEqual([
      '-- Colorscheme',
      'local ok, err = pcall(vim.cmd.colorscheme, "tokyonight-storm")',
      'if not ok then',
      '  vim.notify("[vinela] Colorscheme \'tokyonight-storm\' not found: " .. err, vim.log.levels.WARN)',
      'end',
    ])
  })

  it('serializes background, escaped string/number/boolean globals, and colorscheme command in catalog order', () => {
    const syntheticEntry = makeMinimalCatalogEntry({
      id: 'synthetic-activation',
      activation: {
        background: 'dark',
        globals: [
          {
            name: `key${ESCAPABLE_FRAGMENT}`,
            value: `val${ESCAPABLE_FRAGMENT}`,
          },
          { name: 'count', value: 42 },
          { name: 'flag_true', value: true },
          { name: 'flag_false', value: false },
        ],
      },
    })

    vi.mocked(findCatalogEntry).mockReturnValue(syntheticEntry)

    const result = generateColorschemeSection({
      activeScheme: 'synthetic-activation',
    })

    expect(result.diagnostics).toEqual([])
    expect(result.code).toEqual([
      '-- Colorscheme',
      'vim.o.background = "dark"',
      'vim.g["key\\"\\n\\r\\\\"] = "val\\"\\n\\r\\\\"',
      'vim.g["count"] = 42',
      'vim.g["flag_true"] = true',
      'vim.g["flag_false"] = false',
      'local ok, err = pcall(vim.cmd.colorscheme, "theme\\"\\n\\r\\\\")',
      'if not ok then',
      '  vim.notify("[vinela] Colorscheme \'theme\\"\\n\\r\\\\\' not found: " .. err, vim.log.levels.WARN)',
      'end',
    ])

    const pcallIndex = result.code.indexOf(
      'local ok, err = pcall(vim.cmd.colorscheme, "theme\\"\\n\\r\\\\")',
    )
    expect(pcallIndex).toBeGreaterThan(0)
    expect(result.code.indexOf('vim.o.background = "dark"')).toBeLessThan(
      pcallIndex,
    )
    expect(
      result.code.indexOf('vim.g["key\\"\\n\\r\\\\"] = "val\\"\\n\\r\\\\"'),
    ).toBeLessThan(pcallIndex)
    expect(result.code.indexOf('vim.g["count"] = 42')).toBeLessThan(pcallIndex)
    expect(result.code.indexOf('vim.g["flag_true"] = true')).toBeLessThan(
      pcallIndex,
    )
    expect(result.code.indexOf('vim.g["flag_false"] = false')).toBeLessThan(
      pcallIndex,
    )
  })
})
