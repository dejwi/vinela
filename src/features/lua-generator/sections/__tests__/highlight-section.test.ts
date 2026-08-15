import { describe, expect, it } from 'vitest'
import type { HighlightOverride } from '@/shared/types'
import { generateHighlightSection } from '../highlight-section'

describe('generateHighlightSection', () => {
  it('returns empty result when no highlight overrides', () => {
    const result = generateHighlightSection({ highlightOverrides: [] })
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('returns empty result when all overrides are disabled', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Normal',
        foreground: '#ffffff',
        background: '#000000',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: false,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('generates single highlight override', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Normal',
        foreground: '',
        background: 'NONE',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code).toEqual([
      '-- Highlight overrides',
      'do',
      '  local function set_hl_merged(group, overrides)',
      '    local existing = vim.api.nvim_get_hl(0, { name = group, link = false })',
      '    local merged = vim.tbl_extend("force", existing, overrides)',
      '    vim.api.nvim_set_hl(0, group, merged)',
      '  end',
      '',
      '  set_hl_merged("Normal", { bg = "NONE" })',
      'end',
    ])
  })

  it('generates multiple highlight overrides sorted alphabetically', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'NormalFloat',
        foreground: '',
        background: 'NONE',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
      {
        id: '2',
        groupName: 'Normal',
        foreground: '',
        background: 'NONE',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    // Should be sorted: Normal before NormalFloat
    expect(result.code).toContain('  set_hl_merged("Normal", { bg = "NONE" })')
    expect(result.code).toContain(
      '  set_hl_merged("NormalFloat", { bg = "NONE" })',
    )
    const normalIndex = result.code.findIndex((l) => l.includes('"Normal"'))
    const normalFloatIndex = result.code.findIndex((l) =>
      l.includes('"NormalFloat"'),
    )
    expect(normalIndex).toBeLessThan(normalFloatIndex)
  })

  it('generates link override (takes precedence)', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'MyGroup',
        foreground: '#ffffff', // Should be ignored because link is set
        background: '#000000', // Should be ignored because link is set
        bold: true, // Should be ignored because link is set
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: 'Normal',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code).toContain(
      '  set_hl_merged("MyGroup", { link = "Normal" })',
    )
  })

  it('generates full attribute override', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Special',
        foreground: '#ff0000',
        background: '#00ff00',
        bold: true,
        italic: true,
        underline: true,
        strikethrough: true,
        undercurl: true,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    const expectedLine =
      '  set_hl_merged("Special", { fg = "#ff0000", bg = "#00ff00", bold = true, italic = true, underline = true, strikethrough = true, undercurl = true })'
    expect(result.code).toContain(expectedLine)
  })

  it('skips empty group names with warning', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: '',
        foreground: '#ffffff',
        background: '',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code).toEqual([])
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'warning',
      message: 'Highlight override with empty group name — skipping',
    })
  })

  it('skips overrides with no effective changes', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Normal',
        foreground: '',
        background: '',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code).toEqual([])
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'info',
      message:
        "Highlight override for 'Normal' has no effective changes — skipping",
      context: 'Normal',
    })
  })

  it('escapes special characters in group names', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Group"With"Quotes',
        foreground: '',
        background: 'NONE',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code.some((l) => l.includes('Group\\"With\\"Quotes'))).toBe(
      true,
    )
  })

  it('handles hex colors correctly', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Comment',
        foreground: '#7aa2f7',
        background: '',
        bold: false,
        italic: true,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code.some((l) => l.includes('#7aa2f7'))).toBe(true)
  })

  it('handles named colors correctly', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Error',
        foreground: 'red',
        background: '',
        bold: true,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    expect(result.code.some((l) => l.includes('"red"'))).toBe(true)
  })

  it('only includes attributes that are true/non-empty', () => {
    const overrides: HighlightOverride[] = [
      {
        id: '1',
        groupName: 'Custom',
        foreground: '#ffffff',
        background: '',
        bold: true,
        italic: false, // false should not be included
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ]
    const result = generateHighlightSection({ highlightOverrides: overrides })

    // Find the line that CALLS set_hl_merged (not the function definition)
    const callLine = result.code.find(
      (l) => l.includes('set_hl_merged') && l.includes('Custom'),
    )
    expect(callLine).toBeDefined()
    expect(callLine).toContain('fg = "#ffffff"')
    expect(callLine).toContain('bold = true')
    expect(callLine).not.toContain('italic')
    expect(callLine).not.toContain('underline')
  })
})
