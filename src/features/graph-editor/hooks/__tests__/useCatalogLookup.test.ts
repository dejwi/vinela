import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCatalogLookup } from '../useCatalogLookup'

// Mock useCatalog
vi.mock('../useCatalog', () => ({
  useCatalog: () => [
    {
      key: 'core:write',
      type: 'command',
      label: 'Save File',
      source: { sourceType: 'core' },
      category: 'files',
      isPopular: true,
      aliases: [],
      shortDescription: 'Save current buffer',
      template: ':write',
      params: [],
    },
    {
      key: 'telescope-nvim:find_files',
      type: 'function',
      label: 'Find Files',
      source: {
        sourceType: 'plugin',
        pluginId: 'telescope-nvim',
        pluginName: 'Telescope',
      },
      category: 'search',
      isPopular: true,
      aliases: [],
      shortDescription: 'Fuzzy find files',
      pluginId: 'telescope-nvim',
      functionName: 'find_files',
      params: [],
    },
    {
      key: 'telescope-nvim:cmd:Telescope',
      type: 'command',
      label: 'Telescope',
      source: {
        sourceType: 'plugin',
        pluginId: 'telescope-nvim',
        pluginName: 'Telescope',
      },
      category: 'search',
      isPopular: false,
      aliases: [],
      shortDescription: 'Open Telescope picker',
      template: ':Telescope',
      params: [],
    },
  ],
}))

describe('useCatalogLookup', () => {
  it('finds core entries by key', () => {
    const { result } = renderHook(() => useCatalogLookup())

    const entry = result.current.findByKey('core:write')

    expect(entry).toBeDefined()
    expect(entry?.label).toBe('Save File')
  })

  it('finds plugin function entries by key', () => {
    const { result } = renderHook(() => useCatalogLookup())

    const entry = result.current.findByKey('telescope-nvim:find_files')

    expect(entry).toBeDefined()
    expect(entry?.label).toBe('Find Files')
    expect(entry?.type).toBe('function')
  })

  it('finds plugin command entries by key', () => {
    const { result } = renderHook(() => useCatalogLookup())

    const entry = result.current.findByKey('telescope-nvim:cmd:Telescope')

    expect(entry).toBeDefined()
    expect(entry?.label).toBe('Telescope')
    expect(entry?.type).toBe('command')
  })

  it('returns undefined for unknown keys', () => {
    const { result } = renderHook(() => useCatalogLookup())

    const entry = result.current.findByKey('unknown:key')

    expect(entry).toBeUndefined()
  })

  it('returns catalog array', () => {
    const { result } = renderHook(() => useCatalogLookup())

    expect(result.current.catalog).toHaveLength(3)
    expect(result.current.catalog[0]?.key).toBe('core:write')
  })
})
