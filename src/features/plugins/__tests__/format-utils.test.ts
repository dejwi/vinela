import { describe, expect, it } from 'vitest'
import type { PluginSchema, SchemaOption } from '@/shared/types'
import {
  buildGroupTree,
  formatStars,
  getAuthorName,
  getResolvedStars,
  getTagline,
  groupOptionsByGroup,
  resolvePluginMetadata,
} from '../format-utils'

// ============================================
// Helpers
// ============================================

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

function makeOption(key: string, group?: string): SchemaOption {
  const base = { key, label: key, type: 'string' as const }
  if (group !== undefined) {
    return { ...base, group }
  }
  return base
}

// ============================================
// formatStars
// ============================================

describe('formatStars', () => {
  it('returns null for undefined', () => {
    expect(formatStars(undefined)).toBeNull()
  })

  it('returns "0" for 0', () => {
    expect(formatStars(0)).toBe('0')
  })

  it('returns raw number string below 1000', () => {
    expect(formatStars(999)).toBe('999')
  })

  it('returns raw number string for 1', () => {
    expect(formatStars(1)).toBe('1')
  })

  it('formats exactly 1000 as "1.0k"', () => {
    expect(formatStars(1000)).toBe('1.0k')
  })

  it('formats 1500 as "1.5k"', () => {
    expect(formatStars(1500)).toBe('1.5k')
  })

  it('formats 16400 as "16.4k"', () => {
    expect(formatStars(16400)).toBe('16.4k')
  })

  it('formats 1000000 as "1000.0k"', () => {
    expect(formatStars(1000000)).toBe('1000.0k')
  })

  it('formats 8200 as "8.2k"', () => {
    expect(formatStars(8200)).toBe('8.2k')
  })

  it('formats 10800 as "10.8k"', () => {
    expect(formatStars(10800)).toBe('10.8k')
  })
})

// ============================================
// getAuthorName
// ============================================

describe('getAuthorName', () => {
  it('returns seeded snapshot author for built-in schemas', () => {
    const schema = makeSchema({
      pluginRepo: 'https://github.com/folke/tokyonight.nvim',
    })
    expect(getAuthorName(schema, 'builtin')).toBe('folke')
  })

  it('returns schema auth fallback for external schemas without snapshot data', () => {
    const schema = makeSchema({
      author: 'custom-author',
      pluginRepo: 'https://github.com/example/custom.nvim',
    })
    expect(getAuthorName(schema, 'global')).toBe('custom-author')
  })

  it('omits built-in author fallback when snapshot data is missing', () => {
    const schema = makeSchema({
      author: 'stale-author',
      pluginRepo: 'https://github.com/example/custom.nvim',
    })
    expect(getAuthorName(schema, 'builtin')).toBeUndefined()
  })

  it('returns undefined for external schemas without snapshot or schema author', () => {
    const schema = makeSchema({
      pluginRepo: 'https://github.com/example/custom.nvim',
    })
    expect(getAuthorName(schema, 'project')).toBeUndefined()
  })
})

describe('resolvePluginMetadata', () => {
  it('prefers snapshot metadata for built-in schemas', () => {
    const metadata = resolvePluginMetadata(
      makeSchema({ pluginRepo: 'https://github.com/folke/tokyonight.nvim' }),
      'builtin',
    )
    expect(metadata.metadataSource).toBe('snapshot')
    expect(metadata.repoSlug).toBe('folke/tokyonight.nvim')
    expect(metadata.author).toBe('folke')
    expect(metadata.stars).toBeTypeOf('number')
  })

  it('uses schema metadata fallback for non-builtin schemas when snapshot data is missing', () => {
    const metadata = resolvePluginMetadata(
      makeSchema({
        author: 'schema-author',
        stars: 42,
        pluginRepo: 'https://github.com/example/custom.nvim',
      }),
      'global',
    )

    expect(metadata).toMatchObject({
      metadataSource: 'schema',
      author: 'schema-author',
      stars: 42,
      repoSlug: 'example/custom.nvim',
    })
  })

  it('does not use schema fallback for built-in schemas when snapshot data is missing', () => {
    const metadata = resolvePluginMetadata(
      makeSchema({
        author: 'schema-author',
        stars: 42,
        pluginRepo: 'https://github.com/example/custom.nvim',
      }),
      'builtin',
    )

    expect(metadata).toMatchObject({
      metadataSource: 'none',
      repoSlug: 'example/custom.nvim',
    })
    expect(metadata.author).toBeUndefined()
    expect(metadata.stars).toBeUndefined()
  })
})

describe('getResolvedStars', () => {
  it('returns snapshot stars for built-in schemas', () => {
    const stars = getResolvedStars(
      makeSchema({ pluginRepo: 'https://github.com/folke/tokyonight.nvim' }),
      'builtin',
    )
    expect(stars).toBeTypeOf('number')
  })

  it('returns schema star fallback for external schemas without snapshot data', () => {
    expect(
      getResolvedStars(
        makeSchema({
          stars: 99,
          pluginRepo: 'https://github.com/example/custom.nvim',
        }),
        'global',
      ),
    ).toBe(99)
  })
})

// ============================================
// getTagline
// ============================================

describe('getTagline', () => {
  it('returns tagline when both tagline and description are present', () => {
    const schema = makeSchema({
      tagline: 'Short tagline',
      description: 'Long description',
    })
    expect(getTagline(schema)).toBe('Short tagline')
  })

  it('falls back to description when tagline is absent', () => {
    // No tagline field — makeSchema base has no tagline
    const schema = makeSchema({ description: 'Long description' })
    expect(getTagline(schema)).toBe('Long description')
  })

  it('returns undefined when neither tagline nor description exists', () => {
    // makeSchema base has no tagline or description
    const schema = makeSchema()
    expect(getTagline(schema)).toBeUndefined()
  })

  it('returns tagline even when description is absent', () => {
    // No description field — makeSchema base has no description
    const schema = makeSchema({ tagline: 'Only tagline' })
    expect(getTagline(schema)).toBe('Only tagline')
  })
})

// ============================================
// groupOptionsByGroup
// ============================================

describe('groupOptionsByGroup', () => {
  it('returns empty map for empty options array', () => {
    const result = groupOptionsByGroup([])
    expect(result.size).toBe(0)
  })

  it('groups options by their group field', () => {
    const options = [
      makeOption('a', 'Parsers'),
      makeOption('b', 'Parsers'),
      makeOption('c', 'Highlight'),
    ]
    const result = groupOptionsByGroup(options)
    expect(result.size).toBe(2)
    expect(result.get('Parsers')).toHaveLength(2)
    expect(result.get('Highlight')).toHaveLength(1)
  })

  it('places ungrouped options under "General"', () => {
    const options = [makeOption('a', undefined), makeOption('b', undefined)]
    const result = groupOptionsByGroup(options)
    expect(result.size).toBe(1)
    expect(result.get('General')).toHaveLength(2)
  })

  it('mixes grouped and ungrouped options correctly', () => {
    const options = [
      makeOption('a', 'Parsers'),
      makeOption('b', undefined),
      makeOption('c', 'Parsers'),
    ]
    const result = groupOptionsByGroup(options)
    expect(result.get('Parsers')).toHaveLength(2)
    expect(result.get('General')).toHaveLength(1)
  })

  it('preserves option order within groups', () => {
    const options = [
      makeOption('first', 'Group'),
      makeOption('second', 'Group'),
      makeOption('third', 'Group'),
    ]
    const result = groupOptionsByGroup(options)
    const group = result.get('Group')
    expect(group).toBeDefined()
    expect(group?.[0]?.key).toBe('first')
    expect(group?.[1]?.key).toBe('second')
    expect(group?.[2]?.key).toBe('third')
  })

  it('handles single option with group', () => {
    const options = [makeOption('only', 'Solo')]
    const result = groupOptionsByGroup(options)
    expect(result.size).toBe(1)
    expect(result.get('Solo')).toHaveLength(1)
  })
})

describe('buildGroupTree', () => {
  it('builds parent and child nodes', () => {
    const options = [
      makeOption('a', 'Picker'),
      makeOption('b', 'Picker / Matcher'),
      makeOption('c', 'Picker / Sources / Custom'),
    ]

    const tree = buildGroupTree(options)
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({
      id: 'Picker',
      hasOwnOptions: true,
      count: 3,
    })
    expect(tree[0]?.children.map((child) => child.label)).toEqual([
      'Matcher',
      'Sources / Custom',
    ])
  })

  it('creates synthetic parent for child-only groups', () => {
    const tree = buildGroupTree([makeOption('a', 'Scope / Treesitter')])
    expect(tree[0]).toMatchObject({ id: 'Scope', hasOwnOptions: false })
    expect(tree[0]?.children[0]?.id).toBe('Scope / Treesitter')
  })
})
