import { describe, expect, it } from 'vitest'
import type { InstalledPlugin, ResolvedSchema } from '@/shared/types'
import { getPluginDisplayList } from '../store'

// Minimal schema mock
const createMockSchema = (id: string): ResolvedSchema => ({
  schema: {
    id,
    pluginName: `Plugin ${id}`,
    pluginRepo: `https://github.com/test/${id}`,
    version: '1.0',
    options: [],
    functions: [],
  },
  source: 'builtin',
})

describe('getPluginDisplayList', () => {
  it('maps installed plugins to installed status', () => {
    const schemas = [createMockSchema('plugin-a'), createMockSchema('plugin-b')]
    const installed: InstalledPlugin[] = [
      { schemaId: 'plugin-a', enabled: true, config: {}, addedAt: 1000 },
    ]

    const result = getPluginDisplayList(schemas, installed)

    expect(result).toHaveLength(2)
    expect(result.find((r) => r.status === 'installed')?.schema.id).toBe(
      'plugin-a',
    )
    expect(result.find((r) => r.status === 'available')?.schema.id).toBe(
      'plugin-b',
    )
  })

  it('detects orphaned plugin when schema is missing', () => {
    const schemas: ResolvedSchema[] = [createMockSchema('telescope-nvim')]
    const installed: InstalledPlugin[] = [
      { schemaId: 'telescope-nvim', enabled: true, config: {}, addedAt: 1000 },
      {
        schemaId: 'missing-plugin',
        enabled: true,
        config: { key: 'val' },
        addedAt: 2000,
      },
    ]

    const result = getPluginDisplayList(schemas, installed)

    expect(result).toHaveLength(2)
    const installedEntry = result.find((r) => r.status === 'installed')
    expect(installedEntry).toBeDefined()

    const orphanedEntry = result.find((r) => r.status === 'orphaned')
    expect(orphanedEntry).toBeDefined()
    if (orphanedEntry?.status === 'orphaned') {
      expect(orphanedEntry.schemaId).toBe('missing-plugin')
      expect(orphanedEntry.installed.schemaId).toBe('missing-plugin')
      expect(orphanedEntry.installed.config).toEqual({ key: 'val' })
    }
  })

  it('returns no orphans when all plugins have schemas', () => {
    const schemas = [createMockSchema('plugin-a')]
    const installed: InstalledPlugin[] = [
      { schemaId: 'plugin-a', enabled: true, config: {}, addedAt: 1000 },
    ]

    const result = getPluginDisplayList(schemas, installed)
    expect(result.filter((r) => r.status === 'orphaned')).toHaveLength(0)
  })

  it('returns no orphans when no plugins are installed', () => {
    const schemas = [createMockSchema('plugin-a')]
    const result = getPluginDisplayList(schemas, [])
    expect(result.filter((r) => r.status === 'orphaned')).toHaveLength(0)
    expect(result.filter((r) => r.status === 'available')).toHaveLength(1)
  })

  it('handles multiple orphaned plugins', () => {
    const schemas: ResolvedSchema[] = []
    const installed: InstalledPlugin[] = [
      { schemaId: 'missing-1', enabled: true, config: {}, addedAt: 1000 },
      { schemaId: 'missing-2', enabled: false, config: {}, addedAt: 2000 },
    ]

    const result = getPluginDisplayList(schemas, installed)
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.status === 'orphaned')).toBe(true)
  })
})
