/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { InstalledPlugin, PluginSchema } from '@/shared/types'
import { usePluginsPage } from '../hooks/usePluginsPage'
import { usePluginStore } from '../store'

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'plugin-a',
    pluginName: 'Plugin A',
    pluginRepo: 'https://github.com/example/plugin-a',
    version: '1.0.0',
    category: 'lsp',
    options: [],
    functions: [],
    ...overrides,
  }
}

function makeInstalled(
  schema: PluginSchema,
  overrides?: Partial<InstalledPlugin>,
): InstalledPlugin {
  return {
    schemaId: schema.id,
    enabled: true,
    config: {},
    addedAt: Date.now(),
    ...overrides,
  }
}

describe('usePluginsPage', () => {
  beforeEach(() => {
    usePluginStore.getState().resetForProjectClose()
  })

  it('derives browse lists from available-only plugins after search', () => {
    const available = makeSchema({ id: 'browse-a', pluginName: 'Browse A' })
    const installed = makeSchema({
      id: 'installed-a',
      pluginName: 'Installed A',
    })
    const orphanedInstalled: InstalledPlugin = {
      schemaId: 'missing-schema',
      enabled: true,
      config: {},
      addedAt: 1,
    }

    usePluginStore.setState({
      schemas: [
        { schema: available, source: 'builtin' },
        { schema: installed, source: 'builtin' },
      ],
      installedPlugins: [makeInstalled(installed), orphanedInstalled],
      initStatus: { status: 'ready', projectPath: '/project' },
      activeTab: 'browse',
    })

    const { result } = renderHook(() => usePluginsPage())

    expect(result.current.filteredBrowsePlugins).toHaveLength(1)
    expect(result.current.filteredBrowsePlugins[0]?.schema.id).toBe('browse-a')
    expect(result.current.browseTotalCount).toBe(1)
    expect(result.current.browseCategoryCounts.lsp).toBe(1)
  })

  it('excludes installed and orphaned plugins from browse counts', () => {
    const available = makeSchema({
      id: 'browse-b',
      pluginName: 'Browse B',
      category: 'git',
    })
    const installed = makeSchema({
      id: 'installed-b',
      pluginName: 'Installed B',
      category: 'git',
    })

    usePluginStore.setState({
      schemas: [
        { schema: available, source: 'builtin' },
        { schema: installed, source: 'builtin' },
      ],
      installedPlugins: [makeInstalled(installed)],
      initStatus: { status: 'ready', projectPath: '/project' },
    })

    const { result } = renderHook(() => usePluginsPage())

    expect(
      result.current.filteredBrowsePlugins.map((p) => p.schema.id),
    ).toEqual(['browse-b'])
    expect(result.current.browseTotalCount).toBe(1)
    expect(result.current.browseCategoryCounts.git).toBe(1)
  })

  it('applies category filtering after browse eligibility and search', () => {
    const lsp = makeSchema({
      id: 'lsp-plugin',
      pluginName: 'LSP Plugin',
      category: 'lsp',
    })
    const git = makeSchema({
      id: 'git-plugin',
      pluginName: 'Git Plugin',
      category: 'git',
    })

    usePluginStore.setState({
      schemas: [
        { schema: lsp, source: 'builtin' },
        { schema: git, source: 'builtin' },
      ],
      installedPlugins: [],
      selectedCategory: 'git',
      initStatus: { status: 'ready', projectPath: '/project' },
    })

    const { result } = renderHook(() => usePluginsPage())

    expect(
      result.current.filteredBrowsePlugins.map((p) => p.schema.id),
    ).toEqual(['git-plugin'])
    expect(result.current.browseCategoryCounts.git).toBe(1)
    expect(result.current.browseCategoryCounts.lsp).toBe(1)
    expect(result.current.browseTotalCount).toBe(2)
  })

  it('keeps installed and orphaned plugins on the Installed tab', () => {
    const installed = makeSchema({
      id: 'installed-c',
      pluginName: 'Installed C',
    })
    const available = makeSchema({ id: 'browse-c', pluginName: 'Browse C' })
    const orphanedInstalled: InstalledPlugin = {
      schemaId: 'orphan-c',
      enabled: false,
      config: {},
      addedAt: 2,
    }

    usePluginStore.setState({
      schemas: [
        { schema: installed, source: 'builtin' },
        { schema: available, source: 'builtin' },
      ],
      installedPlugins: [makeInstalled(installed), orphanedInstalled],
      initStatus: { status: 'ready', projectPath: '/project' },
    })

    const { result } = renderHook(() => usePluginsPage())

    const installedNames = result.current.filteredInstalledPlugins.map((p) =>
      p.status === 'orphaned' ? p.schemaId : p.schema.pluginName,
    )
    expect(installedNames).toEqual(['Installed C', 'orphan-c'])
  })

  it('updates browse search results through the shared eligible base', () => {
    const alpha = makeSchema({ id: 'alpha', pluginName: 'Alpha.nvim' })
    const beta = makeSchema({ id: 'beta', pluginName: 'Beta.nvim' })

    usePluginStore.setState({
      schemas: [
        { schema: alpha, source: 'builtin' },
        { schema: beta, source: 'builtin' },
      ],
      installedPlugins: [],
      initStatus: { status: 'ready', projectPath: '/project' },
    })

    const { result, rerender } = renderHook(() => usePluginsPage())

    act(() => {
      usePluginStore.getState().setSearchQuery('alpha')
    })
    rerender()

    expect(
      result.current.filteredBrowsePlugins.map((p) => p.schema.id),
    ).toEqual(['alpha'])
    expect(result.current.browseTotalCount).toBe(1)
  })
})
