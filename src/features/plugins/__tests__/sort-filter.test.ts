import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  AvailablePluginDisplayInfo,
  InstalledPlugin,
  PluginDisplayInfo,
  PluginSchema,
} from '@/shared/types'
import {
  computeCategoryCounts,
  filterBrowseEligible,
  filterByCategory,
  matchesSearch,
  sortBrowse,
  sortInstalled,
  sortInstalledWithGrouping,
} from '../sort-filter'

// ============================================
// Test Helpers
// ============================================

function getPluginName(p: PluginDisplayInfo): string {
  return p.status === 'orphaned' ? p.schemaId : p.schema.pluginName
}

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'test-plugin',
    pluginName: 'test.nvim',
    pluginRepo: 'https://github.com/testorg/test.nvim',
    version: '1.0.0',
    options: [],
    functions: [],
    ...overrides,
  }
}

function makeInstalled(overrides?: Partial<InstalledPlugin>): InstalledPlugin {
  return {
    schemaId: 'test-plugin',
    enabled: true,
    config: {},
    addedAt: Date.now(),
    ...overrides,
  }
}

type InstalledPluginDisplayInfo = Extract<
  PluginDisplayInfo,
  { status: 'installed' }
>

function makeInstalledPlugin(
  schemaOverrides?: Partial<PluginSchema>,
  installedOverrides?: Partial<InstalledPlugin>,
  source: 'builtin' | 'global' | 'project' = 'builtin',
): InstalledPluginDisplayInfo {
  const schema = makeSchema(schemaOverrides)
  const installed = makeInstalled({
    schemaId: schema.id,
    ...installedOverrides,
  })
  return { status: 'installed', schema, source, installed }
}

function makeAvailablePlugin(
  schemaOverrides?: Partial<PluginSchema>,
  source: 'builtin' | 'global' | 'project' = 'builtin',
): AvailablePluginDisplayInfo {
  return {
    status: 'available',
    schema: makeSchema(schemaOverrides),
    source,
  }
}

// ============================================
// matchesSearch
// ============================================

describe('matchesSearch', () => {
  it('returns true for empty query (all plugins match)', () => {
    const plugin = makeAvailablePlugin({ pluginName: 'telescope.nvim' })
    expect(matchesSearch(plugin, '')).toBe(true)
  })

  it('matches plugin name (case-insensitive)', () => {
    const plugin = makeAvailablePlugin({ pluginName: 'Telescope.nvim' })
    expect(matchesSearch(plugin, 'telescope')).toBe(true)
    expect(matchesSearch(plugin, 'TELESCOPE')).toBe(true)
    expect(matchesSearch(plugin, 'Tele')).toBe(true)
  })

  it('does not match unrelated query', () => {
    const plugin = makeAvailablePlugin({ pluginName: 'telescope.nvim' })
    expect(matchesSearch(plugin, 'mason')).toBe(false)
  })

  it('matches description (case-insensitive)', () => {
    const plugin = makeAvailablePlugin({
      pluginName: 'some.nvim',
      description: 'Fuzzy finder for files',
    })
    expect(matchesSearch(plugin, 'fuzzy')).toBe(true)
    expect(matchesSearch(plugin, 'FUZZY')).toBe(true)
  })

  it('matches tagline (case-insensitive)', () => {
    const plugin = makeAvailablePlugin({
      pluginName: 'some.nvim',
      tagline: 'Highly extensible fuzzy finder',
    })
    expect(matchesSearch(plugin, 'extensible')).toBe(true)
  })

  it('matches tags (case-insensitive)', () => {
    const plugin = makeAvailablePlugin({
      pluginName: 'some.nvim',
      tags: ['fuzzy', 'finder', 'search'],
    })
    expect(matchesSearch(plugin, 'finder')).toBe(true)
    expect(matchesSearch(plugin, 'SEARCH')).toBe(true)
  })

  it('matches partial tag', () => {
    const plugin = makeAvailablePlugin({
      pluginName: 'some.nvim',
      tags: ['treesitter'],
    })
    expect(matchesSearch(plugin, 'tree')).toBe(true)
  })

  it('returns false when no field matches', () => {
    const plugin = makeAvailablePlugin({
      pluginName: 'telescope.nvim',
      description: 'Fuzzy finder',
      tagline: 'Find anything',
      tags: ['search', 'files'],
    })
    expect(matchesSearch(plugin, 'debugger')).toBe(false)
  })

  it('works for installed plugins too', () => {
    const plugin = makeInstalledPlugin({ pluginName: 'mason.nvim' })
    expect(matchesSearch(plugin, 'mason')).toBe(true)
    expect(matchesSearch(plugin, 'telescope')).toBe(false)
  })

  it('returns true when description is absent but name matches', () => {
    const plugin = makeAvailablePlugin({ pluginName: 'flash.nvim' })
    expect(matchesSearch(plugin, 'flash')).toBe(true)
  })
})

// ============================================
// sortInstalled
// ============================================

describe('sortInstalled', () => {
  it('returns empty array for empty input', () => {
    expect(sortInstalled([], 'name-asc')).toEqual([])
    expect(sortInstalled([], 'recently-added')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const plugins = [
      makeInstalledPlugin({ id: 'b', pluginName: 'b.nvim' }),
      makeInstalledPlugin({ id: 'a', pluginName: 'a.nvim' }),
    ]
    const original = [...plugins]
    sortInstalled(plugins, 'name-asc')
    expect(plugins[0]).toBe(original[0])
    expect(plugins[1]).toBe(original[1])
  })

  it('sorts by name ascending (case-insensitive)', () => {
    const plugins = [
      makeInstalledPlugin({ id: 'c', pluginName: 'Zebra.nvim' }),
      makeInstalledPlugin({ id: 'a', pluginName: 'alpha.nvim' }),
      makeInstalledPlugin({ id: 'b', pluginName: 'Mason.nvim' }),
    ]
    const result = sortInstalled(plugins, 'name-asc')
    expect(result.map(getPluginName)).toEqual([
      'alpha.nvim',
      'Mason.nvim',
      'Zebra.nvim',
    ])
  })

  it('sorts by recently added (newest first)', () => {
    const now = 1000000
    const plugins = [
      makeInstalledPlugin(
        { id: 'old', pluginName: 'old.nvim' },
        { schemaId: 'old', addedAt: now - 2000 },
      ),
      makeInstalledPlugin(
        { id: 'new', pluginName: 'new.nvim' },
        { schemaId: 'new', addedAt: now },
      ),
      makeInstalledPlugin(
        { id: 'mid', pluginName: 'mid.nvim' },
        { schemaId: 'mid', addedAt: now - 1000 },
      ),
    ]
    const result = sortInstalled(plugins, 'recently-added')
    expect(result.map(getPluginName)).toEqual([
      'new.nvim',
      'mid.nvim',
      'old.nvim',
    ])
  })

  it('uses name as tie-breaker for same addedAt', () => {
    const sameTime = 1000000
    const plugins = [
      makeInstalledPlugin(
        { id: 'z', pluginName: 'zebra.nvim' },
        { schemaId: 'z', addedAt: sameTime },
      ),
      makeInstalledPlugin(
        { id: 'a', pluginName: 'alpha.nvim' },
        { schemaId: 'a', addedAt: sameTime },
      ),
      makeInstalledPlugin(
        { id: 'm', pluginName: 'mason.nvim' },
        { schemaId: 'm', addedAt: sameTime },
      ),
    ]
    const result = sortInstalled(plugins, 'recently-added')
    expect(result.map(getPluginName)).toEqual([
      'alpha.nvim',
      'mason.nvim',
      'zebra.nvim',
    ])
  })

  it('handles single plugin', () => {
    const plugins = [makeInstalledPlugin({ pluginName: 'solo.nvim' })]
    expect(sortInstalled(plugins, 'name-asc')).toHaveLength(1)
    expect(sortInstalled(plugins, 'recently-added')).toHaveLength(1)
  })
})

// ============================================
// sortInstalledWithGrouping
// ============================================

function makeOrphanedPlugin(
  schemaId: string,
  installedOverrides?: Partial<InstalledPlugin>,
): PluginDisplayInfo {
  return {
    status: 'orphaned',
    schemaId,
    installed: makeInstalled({
      schemaId,
      ...installedOverrides,
    }),
  }
}

describe('sortInstalledWithGrouping', () => {
  it('returns empty array for empty input', () => {
    expect(sortInstalledWithGrouping([], 'name-asc')).toEqual([])
    expect(sortInstalledWithGrouping([], 'recently-added')).toEqual([])
  })

  it('groups orphaned plugins at the bottom by name', () => {
    const plugins = [
      makeOrphanedPlugin('z-orphan', { addedAt: 1000 }),
      makeInstalledPlugin({ id: 'b', pluginName: 'beta.nvim' }),
      makeOrphanedPlugin('a-orphan', { addedAt: 2000 }),
      makeInstalledPlugin({ id: 'a', pluginName: 'alpha.nvim' }),
    ]

    const result = sortInstalledWithGrouping(plugins, 'name-asc')
    const names = result.map((p) =>
      p.status === 'orphaned' ? p.schemaId : p.schema.pluginName,
    )

    // Healthy first (sorted by name), then orphaned (sorted by name)
    expect(names).toEqual(['alpha.nvim', 'beta.nvim', 'a-orphan', 'z-orphan'])
  })

  it('groups orphaned plugins at the bottom by date', () => {
    const now = 1000000
    const plugins = [
      makeInstalledPlugin(
        { id: 'old', pluginName: 'old.nvim' },
        { addedAt: now - 2000 },
      ),
      makeOrphanedPlugin('new-orphan', { addedAt: now }),
      makeInstalledPlugin(
        { id: 'new', pluginName: 'new.nvim' },
        { addedAt: now },
      ),
      makeOrphanedPlugin('old-orphan', { addedAt: now - 2000 }),
    ]

    const result = sortInstalledWithGrouping(plugins, 'recently-added')
    const names = result.map((p) =>
      p.status === 'orphaned' ? p.schemaId : p.schema.pluginName,
    )

    // Healthy first (sorted by date), then orphaned (sorted by date)
    expect(names).toEqual(['new.nvim', 'old.nvim', 'new-orphan', 'old-orphan'])
  })

  it('places all orphaned after all healthy regardless of sort', () => {
    const plugins = [
      makeOrphanedPlugin('z-orphan'),
      makeOrphanedPlugin('a-orphan'),
      makeInstalledPlugin({ id: 'z', pluginName: 'zebra.nvim' }),
      makeInstalledPlugin({ id: 'a', pluginName: 'alpha.nvim' }),
    ]

    const result = sortInstalledWithGrouping(plugins, 'name-asc')
    const orphaned = result.filter((p) => p.status === 'orphaned')
    const healthy = result.filter((p) => p.status !== 'orphaned')

    // All healthy should come before all orphaned
    expect(healthy.length).toBe(2)
    expect(orphaned.length).toBe(2)
    const firstHealthy = healthy[0]
    const firstOrphaned = orphaned[0]
    expect(firstHealthy).toBeDefined()
    expect(firstOrphaned).toBeDefined()
    if (firstHealthy !== undefined && firstOrphaned !== undefined) {
      expect(result.indexOf(firstHealthy)).toBeLessThan(
        result.indexOf(firstOrphaned),
      )
    }
  })

  it('handles all orphaned plugins', () => {
    const plugins = [
      makeOrphanedPlugin('z-orphan'),
      makeOrphanedPlugin('a-orphan'),
      makeOrphanedPlugin('m-orphan'),
    ]

    const result = sortInstalledWithGrouping(plugins, 'name-asc')
    const names = result.map((p) => (p.status === 'orphaned' ? p.schemaId : ''))

    expect(names).toEqual(['a-orphan', 'm-orphan', 'z-orphan'])
  })

  it('handles all healthy plugins (no change from sortInstalled)', () => {
    const plugins = [
      makeInstalledPlugin({ id: 'c', pluginName: 'charlie.nvim' }),
      makeInstalledPlugin({ id: 'a', pluginName: 'alpha.nvim' }),
      makeInstalledPlugin({ id: 'b', pluginName: 'bravo.nvim' }),
    ]

    const groupedResult = sortInstalledWithGrouping(plugins, 'name-asc')
    const normalResult = sortInstalled(plugins, 'name-asc')

    expect(groupedResult).toEqual(normalResult)
  })

  it('does not mutate the input array', () => {
    const plugins = [
      makeInstalledPlugin({ id: 'a', pluginName: 'a.nvim' }),
      makeOrphanedPlugin('orphan'),
    ]
    const original = [...plugins]
    sortInstalledWithGrouping(plugins, 'name-asc')
    expect(plugins[0]).toBe(original[0])
    expect(plugins[1]).toBe(original[1])
  })
})

// ============================================
// filterBrowseEligible
// ============================================

describe('filterBrowseEligible', () => {
  it('returns only available plugins', () => {
    const plugins: PluginDisplayInfo[] = [
      makeAvailablePlugin({ id: 'avail', pluginName: 'avail.nvim' }),
      makeInstalledPlugin({ id: 'inst', pluginName: 'inst.nvim' }),
      makeInstalledPlugin(
        { id: 'disabled', pluginName: 'disabled.nvim' },
        { enabled: false },
      ),
      makeOrphanedPlugin('orphan'),
    ]

    const result = filterBrowseEligible(plugins)
    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe('available')
    expect(result[0] ? getPluginName(result[0]) : '').toBe('avail.nvim')
  })

  it('does not mutate the input array', () => {
    const plugins = [makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim' })]
    const original = [...plugins]
    filterBrowseEligible(plugins)
    expect(plugins).toEqual(original)
  })

  it('narrows the result type to AvailablePluginDisplayInfo[]', () => {
    const plugins: PluginDisplayInfo[] = [
      makeAvailablePlugin({ id: 'avail', pluginName: 'avail.nvim' }),
    ]
    const result = filterBrowseEligible(plugins)
    expectTypeOf(result).toEqualTypeOf<AvailablePluginDisplayInfo[]>()
  })
})

// ============================================
// sortBrowse
// ============================================

describe('sortBrowse', () => {
  it('returns empty array for empty input', () => {
    expect(sortBrowse([], 'stars-desc')).toEqual([])
    expect(sortBrowse([], 'name-asc')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const plugins = [
      makeAvailablePlugin(
        {
          id: 'b',
          pluginName: 'b.nvim',
          stars: 100,
          pluginRepo: 'https://github.com/example/b.nvim',
        },
        'global',
      ),
      makeAvailablePlugin(
        {
          id: 'a',
          pluginName: 'a.nvim',
          stars: 200,
          pluginRepo: 'https://github.com/example/a.nvim',
        },
        'global',
      ),
    ]
    const original = [...plugins]
    sortBrowse(plugins, 'stars-desc')
    expect(plugins[0]).toBe(original[0])
    expect(plugins[1]).toBe(original[1])
  })

  it('sorts by stars descending', () => {
    const plugins = [
      makeAvailablePlugin(
        {
          id: 'low',
          pluginName: 'low.nvim',
          stars: 100,
          pluginRepo: 'https://github.com/example/low.nvim',
        },
        'global',
      ),
      makeAvailablePlugin(
        {
          id: 'high',
          pluginName: 'high.nvim',
          stars: 16400,
          pluginRepo: 'https://github.com/example/high.nvim',
        },
        'global',
      ),
      makeAvailablePlugin(
        {
          id: 'mid',
          pluginName: 'mid.nvim',
          stars: 8200,
          pluginRepo: 'https://github.com/example/mid.nvim',
        },
        'global',
      ),
    ]
    const result = sortBrowse(plugins, 'stars-desc')
    expect(result.map(getPluginName)).toEqual([
      'high.nvim',
      'mid.nvim',
      'low.nvim',
    ])
  })

  it('treats undefined stars as 0', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'no-stars', pluginName: 'no-stars.nvim' }), // stars: undefined
      makeAvailablePlugin(
        {
          id: 'some',
          pluginName: 'some.nvim',
          stars: 500,
          pluginRepo: 'https://github.com/example/some.nvim',
        },
        'global',
      ),
      makeAvailablePlugin(
        {
          id: 'zero',
          pluginName: 'zero.nvim',
          stars: 0,
          pluginRepo: 'https://github.com/example/zero.nvim',
        },
        'global',
      ),
    ]
    const result = sortBrowse(plugins, 'stars-desc')
    // 500 first, then 0, then missing snapshot/schema stars last
    expect(result[0] ? getPluginName(result[0]) : '').toBe('some.nvim')
    expect(result[1] ? getPluginName(result[1]) : '').toBe('zero.nvim')
    expect(result[2] ? getPluginName(result[2]) : '').toBe('no-stars.nvim')
  })

  it('does not use built-in schema stars as fallback when snapshot data is missing', () => {
    const plugins = [
      makeAvailablePlugin({
        id: 'builtin-missing',
        pluginName: 'builtin-missing.nvim',
        stars: 9999,
        pluginRepo: 'https://github.com/example/builtin-missing.nvim',
      }),
      makeAvailablePlugin(
        {
          id: 'external',
          pluginName: 'external.nvim',
          stars: 100,
          pluginRepo: 'https://github.com/example/external.nvim',
        },
        'global',
      ),
    ]

    const result = sortBrowse(plugins, 'stars-desc')
    expect(result.map(getPluginName)).toEqual([
      'external.nvim',
      'builtin-missing.nvim',
    ])
  })

  it('uses name as tie-breaker for same star count', () => {
    const plugins = [
      makeAvailablePlugin(
        {
          id: 'z',
          pluginName: 'zebra.nvim',
          stars: 1000,
          pluginRepo: 'https://github.com/example/zebra.nvim',
        },
        'global',
      ),
      makeAvailablePlugin(
        {
          id: 'a',
          pluginName: 'alpha.nvim',
          stars: 1000,
          pluginRepo: 'https://github.com/example/alpha.nvim',
        },
        'global',
      ),
      makeAvailablePlugin(
        {
          id: 'm',
          pluginName: 'mason.nvim',
          stars: 1000,
          pluginRepo: 'https://github.com/example/mason.nvim',
        },
        'global',
      ),
    ]
    const result = sortBrowse(plugins, 'stars-desc')
    expect(result.map(getPluginName)).toEqual([
      'alpha.nvim',
      'mason.nvim',
      'zebra.nvim',
    ])
  })

  it('sorts by name ascending (case-insensitive)', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'z', pluginName: 'Zebra.nvim' }),
      makeAvailablePlugin({ id: 'a', pluginName: 'alpha.nvim' }),
      makeAvailablePlugin({ id: 'm', pluginName: 'Mason.nvim' }),
    ]
    const result = sortBrowse(plugins, 'name-asc')
    expect(result.map(getPluginName)).toEqual([
      'alpha.nvim',
      'Mason.nvim',
      'Zebra.nvim',
    ])
  })

  it('handles single plugin', () => {
    const plugins = [
      makeAvailablePlugin({ pluginName: 'solo.nvim', stars: 42 }),
    ]
    expect(sortBrowse(plugins, 'stars-desc')).toHaveLength(1)
    expect(sortBrowse(plugins, 'name-asc')).toHaveLength(1)
  })
})

// ============================================
// filterByCategory
// ============================================

describe('filterByCategory', () => {
  it('returns all plugins when selectedCategory is null', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim', category: 'git' }),
      makeAvailablePlugin({ id: 'c', pluginName: 'c.nvim' }),
    ]
    expect(filterByCategory(plugins, null)).toHaveLength(3)
  })

  it('returns only plugins matching the selected category', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim', category: 'git' }),
      makeAvailablePlugin({ id: 'c', pluginName: 'c.nvim', category: 'lsp' }),
    ]
    const result = filterByCategory(plugins, 'lsp')
    expect(result).toHaveLength(2)
    expect(result.map(getPluginName)).toEqual(['a.nvim', 'c.nvim'])
  })

  it('returns empty array when no plugins match the category', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
    ]
    expect(filterByCategory(plugins, 'git')).toHaveLength(0)
  })

  it('excludes plugins with undefined category when filtering', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim' }), // no category
    ]
    const result = filterByCategory(plugins, 'lsp')
    expect(result).toHaveLength(1)
    expect(result[0] ? getPluginName(result[0]) : '').toBe('a.nvim')
  })

  it('does not mutate the input array', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim', category: 'git' }),
    ]
    const original = [...plugins]
    filterByCategory(plugins, 'lsp')
    expect(plugins[0]).toBe(original[0])
    expect(plugins[1]).toBe(original[1])
  })

  it('returns empty array for empty input', () => {
    expect(filterByCategory([], 'lsp')).toEqual([])
    expect(filterByCategory([], null)).toEqual([])
  })

  it('works with installed plugins', () => {
    const plugins = [
      makeInstalledPlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeInstalledPlugin({ id: 'b', pluginName: 'b.nvim', category: 'git' }),
    ]
    const result = filterByCategory(plugins, 'lsp')
    expect(result).toHaveLength(1)
    expect(result[0] ? getPluginName(result[0]) : '').toBe('a.nvim')
  })
})

// ============================================
// computeCategoryCounts
// ============================================

describe('computeCategoryCounts', () => {
  it('returns empty object for empty input', () => {
    expect(computeCategoryCounts([])).toEqual({})
  })

  it('counts plugins per category', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'c', pluginName: 'c.nvim', category: 'git' }),
    ]
    const counts = computeCategoryCounts(plugins)
    expect(counts.lsp).toBe(2)
    expect(counts.git).toBe(1)
  })

  it('does not include categories with zero count', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
    ]
    const counts = computeCategoryCounts(plugins)
    expect(Object.keys(counts)).toEqual(['lsp'])
  })

  it('ignores plugins with undefined category', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim' }), // no category
    ]
    const counts = computeCategoryCounts(plugins)
    expect(counts.lsp).toBe(1)
    expect(Object.keys(counts)).toEqual(['lsp'])
  })

  it('counts installed plugins too', () => {
    const plugins = [
      makeInstalledPlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim', category: 'lsp' }),
    ]
    const counts = computeCategoryCounts(plugins)
    expect(counts.lsp).toBe(2)
  })

  it('total of category counts may be less than total plugins (uncategorized excluded)', () => {
    const plugins = [
      makeAvailablePlugin({ id: 'a', pluginName: 'a.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim' }), // no category
      makeAvailablePlugin({ id: 'c', pluginName: 'c.nvim' }), // no category
    ]
    const counts = computeCategoryCounts(plugins)
    const totalFromCounts = Object.values(counts).reduce(
      (sum, n) => sum + (n ?? 0),
      0,
    )
    // Total from counts (1) is less than total plugins (3) because uncategorized are excluded
    expect(totalFromCounts).toBe(1)
    expect(plugins.length).toBe(3)
  })

  it('handles all categories', () => {
    const plugins = [
      makeAvailablePlugin({
        id: 'a',
        pluginName: 'a.nvim',
        category: 'editor',
      }),
      makeAvailablePlugin({ id: 'b', pluginName: 'b.nvim', category: 'lsp' }),
      makeAvailablePlugin({ id: 'c', pluginName: 'c.nvim', category: 'ui' }),
      makeAvailablePlugin({
        id: 'd',
        pluginName: 'd.nvim',
        category: 'navigation',
      }),
      makeAvailablePlugin({ id: 'e', pluginName: 'e.nvim', category: 'git' }),
      makeAvailablePlugin({
        id: 'f',
        pluginName: 'f.nvim',
        category: 'debugging',
      }),
      makeAvailablePlugin({
        id: 'g',
        pluginName: 'g.nvim',
        category: 'syntax',
      }),
      makeAvailablePlugin({
        id: 'h',
        pluginName: 'h.nvim',
        category: 'utility',
      }),
    ]
    const counts = computeCategoryCounts(plugins)
    expect(Object.keys(counts)).toHaveLength(8)
    for (const count of Object.values(counts)) {
      expect(count).toBe(1)
    }
  })
})
