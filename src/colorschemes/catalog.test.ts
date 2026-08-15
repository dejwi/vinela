import { describe, expect, it } from 'vitest'
import { catalog } from '@/colorschemes'
import builtinSchemas from '@/schemas'
import { parseRepositoryRef } from '@/shared/lib/repository-ref'
import type { ColorSchemeCatalogEntry } from '@/shared/types'
import { getThemePluginSchemaId } from '@/shared/types/colorscheme'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function normalizeRepo(repo: string): string {
  const parsed = parseRepositoryRef(repo)
  return parsed.success ? parsed.repoSlug : repo
}

function getEntry(id: string): ColorSchemeCatalogEntry {
  const entry = catalog.find((item) => item.id === id)
  expect(entry, `missing catalog entry: ${id}`).toBeDefined()
  return entry as ColorSchemeCatalogEntry
}

const REQUIRED_VARIANT_MATRIX: Array<{
  id: string
  vimColorscheme: string
  activation?: ColorSchemeCatalogEntry['activation']
}> = [
  { id: 'nordic', vimColorscheme: 'nordic' },
  { id: 'vague', vimColorscheme: 'vague' },
  {
    id: 'oxocarbon-dark',
    vimColorscheme: 'oxocarbon',
    activation: { background: 'dark' },
  },
  {
    id: 'oxocarbon-light',
    vimColorscheme: 'oxocarbon',
    activation: { background: 'light' },
  },
  { id: 'nightfox', vimColorscheme: 'nightfox' },
  { id: 'dayfox', vimColorscheme: 'dayfox' },
  { id: 'dawnfox', vimColorscheme: 'dawnfox' },
  { id: 'duskfox', vimColorscheme: 'duskfox' },
  { id: 'nordfox', vimColorscheme: 'nordfox' },
  { id: 'terafox', vimColorscheme: 'terafox' },
  { id: 'carbonfox', vimColorscheme: 'carbonfox' },
  { id: 'tokyonight-night', vimColorscheme: 'tokyonight-night' },
  { id: 'tokyonight-storm', vimColorscheme: 'tokyonight-storm' },
  { id: 'tokyonight-moon', vimColorscheme: 'tokyonight-moon' },
  { id: 'tokyonight-day', vimColorscheme: 'tokyonight-day' },
  { id: 'kanagawa', vimColorscheme: 'kanagawa-wave' },
  { id: 'kanagawa-dragon', vimColorscheme: 'kanagawa-dragon' },
  { id: 'kanagawa-lotus', vimColorscheme: 'kanagawa-lotus' },
  {
    id: 'vscode-dark',
    vimColorscheme: 'vscode',
    activation: { background: 'dark' },
  },
  {
    id: 'vscode-light',
    vimColorscheme: 'vscode',
    activation: { background: 'light' },
  },
  { id: 'sonokai', vimColorscheme: 'sonokai' },
  {
    id: 'sonokai-atlantis',
    vimColorscheme: 'sonokai',
    activation: { globals: [{ name: 'sonokai_style', value: 'atlantis' }] },
  },
  {
    id: 'sonokai-andromeda',
    vimColorscheme: 'sonokai',
    activation: { globals: [{ name: 'sonokai_style', value: 'andromeda' }] },
  },
  {
    id: 'sonokai-maia',
    vimColorscheme: 'sonokai',
    activation: { globals: [{ name: 'sonokai_style', value: 'maia' }] },
  },
  {
    id: 'sonokai-espresso',
    vimColorscheme: 'sonokai',
    activation: { globals: [{ name: 'sonokai_style', value: 'espresso' }] },
  },
  {
    id: 'sonokai-shusia',
    vimColorscheme: 'sonokai',
    activation: { globals: [{ name: 'sonokai_style', value: 'shusia' }] },
  },
  { id: 'catppuccin-latte', vimColorscheme: 'catppuccin-latte' },
  { id: 'catppuccin-frappe', vimColorscheme: 'catppuccin-frappe' },
  { id: 'catppuccin-macchiato', vimColorscheme: 'catppuccin-macchiato' },
  { id: 'catppuccin-mocha', vimColorscheme: 'catppuccin-mocha' },
  { id: 'rose-pine', vimColorscheme: 'rose-pine' },
  { id: 'rose-pine-moon', vimColorscheme: 'rose-pine-moon' },
  { id: 'rose-pine-dawn', vimColorscheme: 'rose-pine-dawn' },
]

describe('colorscheme catalog invariants', () => {
  it('has unique catalog IDs', () => {
    const ids = catalog.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses valid six-digit hex colors for required fields', () => {
    for (const entry of catalog) {
      expect(entry.colors.background).toMatch(HEX_COLOR)
      expect(entry.colors.foreground).toMatch(HEX_COLOR)
      expect(entry.colors.lineNumber).toMatch(HEX_COLOR)
      expect(entry.colors.lineHighlight).toMatch(HEX_COLOR)
      expect(entry.colors.selection).toMatch(HEX_COLOR)
      expect(entry.colors.cursor).toMatch(HEX_COLOR)

      for (const tokenColor of Object.values(entry.colors.tokens)) {
        expect(tokenColor).toMatch(HEX_COLOR)
      }

      for (const uiColor of Object.values(entry.colors.ui)) {
        expect(uiColor).toMatch(HEX_COLOR)
      }
    }
  })

  it('covers every built-in colorscheme schema repository', () => {
    const colorschemeSchemas = builtinSchemas.filter((schema) =>
      schema.tags?.includes('colorscheme'),
    )

    for (const schema of colorschemeSchemas) {
      const schemaRepo = normalizeRepo(schema.pluginRepo)
      const hasMatch = catalog.some(
        (entry) => normalizeRepo(entry.pluginRepo) === schemaRepo,
      )
      expect(hasMatch, schema.pluginRepo).toBe(true)
    }
  })

  it('includes the required original-config variant matrix', () => {
    for (const expected of REQUIRED_VARIANT_MATRIX) {
      const entry = getEntry(expected.id)
      expect(entry.vimColorscheme).toBe(expected.vimColorscheme)
      expect(entry.activation).toEqual(expected.activation)
    }
  })

  it('preserves stable catalog aliases and avoids duplicate replacement IDs', () => {
    expect(getEntry('sonokai').id).toBe('sonokai')
    expect(getEntry('kanagawa').id).toBe('kanagawa')
    expect(getEntry('rose-pine').id).toBe('rose-pine')

    const ids = new Set(catalog.map((entry) => entry.id))
    expect(ids.has('sonokai-default')).toBe(false)
    expect(ids.has('kanagawa-wave')).toBe(false)
    expect(ids.has('rose-pine-main')).toBe(false)
  })

  it('groups variants from one repository under one plugin schema ID', () => {
    const repoToSchemaIds = new Map<string, Set<string>>()

    for (const entry of catalog) {
      const repo = normalizeRepo(entry.pluginRepo)
      const schemaId = getThemePluginSchemaId(entry.pluginRepo)
      const existing = repoToSchemaIds.get(repo) ?? new Set<string>()
      existing.add(schemaId)
      repoToSchemaIds.set(repo, existing)
    }

    for (const [repo, schemaIds] of repoToSchemaIds) {
      expect(schemaIds.size, repo).toBe(1)
    }
  })
})
