import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the storage-api module
vi.mock('@/shared/lib/storage-api', () => ({
  projectFileExists: vi.fn(),
  readProjectFile: vi.fn(),
  writeProjectFile: vi.fn(),
}))

import {
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type { InstalledPlugin, PluginSchema } from '@/shared/types'
import { loadInstalledPlugins, normalizeInstalledPlugin } from '../storage'

const mockProjectFileExists = vi.mocked(projectFileExists)
const mockReadProjectFile = vi.mocked(readProjectFile)
const mockWriteProjectFile = vi.mocked(writeProjectFile)

function makeBlinkSchemaWithKeymap(): PluginSchema {
  return {
    id: 'blink-cmp',
    pluginName: 'blink.cmp',
    pluginRepo: 'https://github.com/saghen/blink.cmp',
    version: '1.0.0',
    functions: [],
    options: [
      {
        key: 'keymap',
        label: 'Keymaps',
        type: 'plugin-keymap',
        defaultPreset: 'default',
        allowDisable: true,
        commands: [{ name: 'accept', label: 'Accept' }],
        presets: [{ id: 'default', label: 'Default', mappings: {} }],
      },
    ],
  }
}

describe('loadInstalledPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Migration writes back v1 format on first load — resolve by default
    mockWriteProjectFile.mockResolvedValue(undefined)
  })

  it('returns file-not-found status when file does not exist', async () => {
    mockProjectFileExists.mockResolvedValue(false)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('file-not-found')
    expect(result.plugins).toEqual([])
    expect(mockReadProjectFile).not.toHaveBeenCalled()
  })

  it('returns loaded status with plugins on success', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    const validPlugins: InstalledPlugin[] = [
      {
        schemaId: 'test-plugin',
        enabled: true,
        config: { option1: 'value1' },
        addedAt: 1000,
      },
      {
        schemaId: 'another-plugin',
        enabled: false,
        config: {},
        addedAt: 2000,
      },
    ]
    mockReadProjectFile.mockResolvedValue(validPlugins)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('loaded')
    expect(result.plugins).toHaveLength(2)
    expect(result.plugins[0]).toEqual(validPlugins[0])
    expect(result.plugins[1]).toEqual(validPlugins[1])
  })

  it('returns loaded status with empty plugins for empty array', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([])

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('loaded')
    expect(result.plugins).toEqual([])
  })

  it('returns corrupted status when file contains non-array', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue({ not: 'an array' })

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toContain(
        'Expected array or { configVersion, plugins }, got object',
      )
    }
    expect(result.plugins).toEqual([])
  })

  it('returns corrupted status when JSON parse fails', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(
      new SyntaxError('Unexpected token in JSON'),
    )

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toContain('Unexpected token in JSON')
    }
    expect(result.plugins).toEqual([])
  })

  it('returns permission-denied when access is denied', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    const error = new Error('EACCES: permission denied')
    mockReadProjectFile.mockRejectedValue(error)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
    if (result.status === 'permission-denied') {
      expect(result.error).toContain('EACCES')
    }
    expect(result.plugins).toEqual([])
  })

  it('returns permission-denied for EPERM errors', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    const error = new Error('EPERM: operation not permitted')
    mockReadProjectFile.mockRejectedValue(error)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
    if (result.status === 'permission-denied') {
      expect(result.error).toContain('EPERM')
    }
  })

  it('returns corrupted for generic errors without permission keywords', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    const error = new Error('Some random error')
    mockReadProjectFile.mockRejectedValue(error)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toBe('Some random error')
    }
  })

  // Permission error detection test cases
  it('returns permission-denied for "access denied" (case insensitive)', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(new Error('Access Denied'))

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('returns permission-denied for "operation not permitted"', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(new Error('Operation not permitted'))

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('returns permission-denied for "requires elevation"', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(
      new Error('This operation requires elevation'),
    )

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('returns permission-denied for "not authorized"', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(new Error('Not authorized to access'))

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('returns permission-denied for Windows "error 5"', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(
      new Error('CreateFile failed with error 5'),
    )

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('returns permission-denied for "errno 13"', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(new Error('read failed: errno 13'))

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('handles mixed case permission errors', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(
      new Error('EACCES: Permission Denied'),
    )

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('permission-denied')
  })

  it('normalizes malformed plugin entries gracefully', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([
      // Valid entry
      {
        schemaId: 'valid-plugin',
        enabled: true,
        config: {},
        addedAt: 1000,
      },
      // Invalid entry: no schemaId
      { no_schema_id: true },
      // Partial entry: missing enabled, config, addedAt
      { schemaId: 'partial-plugin' },
      // Invalid entry: empty schemaId
      { schemaId: '', enabled: true },
    ])

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('loaded')
    expect(result.plugins).toHaveLength(2)
    expect(result.plugins[0]?.schemaId).toBe('valid-plugin')
    expect(result.plugins[1]?.schemaId).toBe('partial-plugin')
  })

  it('skips entries with empty schemaId', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([
      { schemaId: '', enabled: true, config: {}, addedAt: 1 },
    ])

    const result = await loadInstalledPlugins('/test/project')

    expect(result.plugins).toHaveLength(0)
  })

  it('skips entries with whitespace-only schemaId', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([
      { schemaId: '   ', enabled: true, config: {}, addedAt: 1 },
    ])

    const result = await loadInstalledPlugins('/test/project')

    expect(result.plugins).toHaveLength(0)
  })

  it('applies defaults for missing fields in entries', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([{ schemaId: 'test' }])

    const result = await loadInstalledPlugins('/test/project')

    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.schemaId).toBe('test')
    expect(result.plugins[0]?.enabled).toBe(true) // default
    expect(result.plugins[0]?.config).toEqual({}) // default
    expect(typeof result.plugins[0]?.addedAt).toBe('number') // default Date.now()
  })

  it('handles null data in corrupted file', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue(null)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toContain(
        'Expected array or { configVersion, plugins }, got object',
      )
    }
  })

  it('handles undefined data in corrupted file', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue(undefined)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toContain(
        'Expected array or { configVersion, plugins }, got undefined',
      )
    }
  })

  it('handles string data in corrupted file', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue('corrupted content')

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toContain(
        'Expected array or { configVersion, plugins }, got string',
      )
    }
  })

  it('handles number data in corrupted file', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue(12345)

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') {
      expect(result.error).toContain(
        'Expected array or { configVersion, plugins }, got number',
      )
    }
  })

  it('migrates v0 data through keymap stage only, then writes version 2 once', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([
      {
        schemaId: 'blink-cmp',
        enabled: true,
        config: { 'keymap.preset': 'default' },
        addedAt: 1,
      },
      {
        schemaId: 'mason-nvim',
        enabled: true,
        config: {
          registries: ['mason:mason-org/mason-registry'],
        },
        addedAt: 2,
      },
    ])

    const result = await loadInstalledPlugins('/test/project', [
      makeBlinkSchemaWithKeymap(),
    ])

    expect(result.status).toBe('loaded')
    expect(result.plugins[0]?.config['keymap']).toEqual({ preset: 'default' })
    expect(result.plugins[1]?.config['registries']).toEqual([
      'mason:mason-org/mason-registry',
    ])
    expect(mockWriteProjectFile).toHaveBeenCalledTimes(1)
    expect(mockWriteProjectFile.mock.calls[0]?.[2]).toEqual({
      configVersion: 2,
      plugins: result.plugins,
    })
  })

  it('rewrites v1 wrapper to version 2 without plugin-specific runtime migration', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue({
      configVersion: 1,
      plugins: [
        {
          schemaId: 'mason-nvim',
          enabled: true,
          config: {
            registries: ['mason:mason-org/mason-registry', 'custom:registry'],
          },
          addedAt: 1,
        },
      ],
    })

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('loaded')
    expect(result.plugins[0]?.config['registries']).toEqual([
      'mason:mason-org/mason-registry',
      'custom:registry',
    ])
    expect(mockWriteProjectFile).toHaveBeenCalledTimes(1)
    expect(mockWriteProjectFile.mock.calls[0]?.[2]).toEqual({
      configVersion: 2,
      plugins: result.plugins,
    })
  })

  it('leaves v2 wrapper data unchanged and skips rewrite', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue({
      configVersion: 2,
      plugins: [
        {
          schemaId: 'mason-nvim',
          enabled: true,
          config: {
            registries: ['github:mason-org/mason-registry'],
          },
          addedAt: 1,
        },
      ],
    })

    const result = await loadInstalledPlugins('/test/project')

    expect(result.status).toBe('loaded')
    expect(result.plugins[0]?.config['registries']).toEqual([
      'github:mason-org/mason-registry',
    ])
    expect(mockWriteProjectFile).not.toHaveBeenCalled()
  })
})

describe('normalizeInstalledPlugin', () => {
  it('returns null for non-objects', () => {
    expect(normalizeInstalledPlugin(null)).toBeNull()
    expect(normalizeInstalledPlugin(undefined)).toBeNull()
    expect(normalizeInstalledPlugin('string')).toBeNull()
    expect(normalizeInstalledPlugin(123)).toBeNull()
    expect(normalizeInstalledPlugin(true)).toBeNull()
    expect(normalizeInstalledPlugin([])).toBeNull()
  })

  it('returns null for objects without schemaId', () => {
    expect(normalizeInstalledPlugin({ enabled: true })).toBeNull()
  })

  it('returns null for non-string schemaId', () => {
    expect(normalizeInstalledPlugin({ schemaId: 123 })).toBeNull()
    expect(normalizeInstalledPlugin({ schemaId: true })).toBeNull()
    expect(normalizeInstalledPlugin({ schemaId: {} })).toBeNull()
  })

  it('returns null for empty schemaId', () => {
    expect(normalizeInstalledPlugin({ schemaId: '' })).toBeNull()
    expect(normalizeInstalledPlugin({ schemaId: '   ' })).toBeNull()
  })

  it('normalizes valid plugin entry', () => {
    const input = {
      schemaId: 'test-plugin',
      enabled: false,
      config: { option: 'value' },
      addedAt: 12345,
    }
    const result = normalizeInstalledPlugin(input)

    expect(result).not.toBeNull()
    expect(result?.schemaId).toBe('test-plugin')
    expect(result?.enabled).toBe(false)
    expect(result?.config).toEqual({ option: 'value' })
    expect(result?.addedAt).toBe(12345)
  })

  it('applies defaults for missing fields', () => {
    const input = { schemaId: 'minimal' }
    const result = normalizeInstalledPlugin(input)

    expect(result).not.toBeNull()
    expect(result?.schemaId).toBe('minimal')
    expect(result?.enabled).toBe(true) // default
    expect(result?.config).toEqual({}) // default
    expect(typeof result?.addedAt).toBe('number')
  })

  it('applies default enabled when not boolean', () => {
    const input = {
      schemaId: 'test',
      enabled: 'yes', // invalid type
    }
    const result = normalizeInstalledPlugin(input)

    expect(result?.enabled).toBe(true)
  })

  it('applies default config when not object', () => {
    const input = {
      schemaId: 'test',
      config: 'invalid', // invalid type
    }
    const result = normalizeInstalledPlugin(input)

    expect(result?.config).toEqual({})
  })

  it('applies default config when null', () => {
    const input = {
      schemaId: 'test',
      config: null,
    }
    const result = normalizeInstalledPlugin(input)

    expect(result?.config).toEqual({})
  })

  it('applies default config when array', () => {
    const input = {
      schemaId: 'test',
      config: ['array', 'not', 'object'],
    }
    const result = normalizeInstalledPlugin(input)

    expect(result?.config).toEqual({})
  })

  it('applies default addedAt when not number', () => {
    const input = {
      schemaId: 'test',
      addedAt: '2024-01-01', // invalid type
    }
    const before = Date.now()
    const result = normalizeInstalledPlugin(input)
    const after = Date.now()

    expect(result?.addedAt).toBeGreaterThanOrEqual(before)
    expect(result?.addedAt).toBeLessThanOrEqual(after)
  })

  it('preserves luaFieldOverrides when present and valid', () => {
    const input = {
      schemaId: 'lua-plugin',
      enabled: true,
      config: {},
      addedAt: 123,
      luaFieldOverrides: {
        on_start: true,
        on_exit: false,
      },
    }

    const result = normalizeInstalledPlugin(input)
    expect(result?.luaFieldOverrides).toEqual({
      on_start: true,
      on_exit: false,
    })
  })

  it('omits luaFieldOverrides when not present', () => {
    const input = {
      schemaId: 'lua-plugin',
      enabled: true,
      config: {},
      addedAt: 123,
    }

    const result = normalizeInstalledPlugin(input)
    expect(result?.luaFieldOverrides).toBeUndefined()
  })

  it('filters non-boolean entries from luaFieldOverrides', () => {
    const input = {
      schemaId: 'lua-plugin',
      enabled: true,
      config: {},
      addedAt: 123,
      luaFieldOverrides: {
        valid_true: true,
        valid_false: false,
        invalid_number: 1,
        invalid_string: 'yes',
        invalid_object: {},
      },
    }

    const result = normalizeInstalledPlugin(input)
    expect(result?.luaFieldOverrides).toEqual({
      valid_true: true,
      valid_false: false,
    })
  })

  it('omits luaFieldOverrides when normalized object is empty', () => {
    const input = {
      schemaId: 'lua-plugin',
      enabled: true,
      config: {},
      addedAt: 123,
      luaFieldOverrides: {
        invalid_number: 1,
        invalid_string: 'no',
      },
    }

    const result = normalizeInstalledPlugin(input)
    expect(result?.luaFieldOverrides).toBeUndefined()
  })

  it('normalizes install overrides for semver and refs', () => {
    const result = normalizeInstalledPlugin({
      schemaId: 'pinned-plugin',
      enabled: true,
      config: { option: 'value' },
      luaFieldOverrides: { handler: true },
      addedAt: 123,
      installOverride: {
        version: {
          mode: 'ref',
          refKind: 'branch',
          value: '  release/1.x  ',
        },
      },
    })

    expect(result).toEqual({
      schemaId: 'pinned-plugin',
      enabled: true,
      config: { option: 'value' },
      luaFieldOverrides: { handler: true },
      installOverride: {
        version: {
          mode: 'ref',
          refKind: 'branch',
          value: 'release/1.x',
        },
      },
      addedAt: 123,
    })
  })

  it('infers refKind for manual persisted install overrides', () => {
    const commitResult = normalizeInstalledPlugin({
      schemaId: 'commit-plugin',
      installOverride: {
        version: { mode: 'ref', value: 'abc1234' },
      },
    })
    const genericRefResult = normalizeInstalledPlugin({
      schemaId: 'ref-plugin',
      installOverride: {
        version: { mode: 'ref', value: 'nightly' },
      },
    })

    expect(commitResult?.installOverride).toEqual({
      version: { mode: 'ref', refKind: 'commit', value: 'abc1234' },
    })
    expect(genericRefResult?.installOverride).toEqual({
      version: { mode: 'ref', refKind: 'ref', value: 'nightly' },
    })
  })

  it('drops malformed installOverride without dropping plugin entry', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    const result = normalizeInstalledPlugin({
      schemaId: 'invalid-pin',
      enabled: false,
      config: { keep: true },
      addedAt: 456,
      installOverride: {
        version: { mode: 'ref', refKind: 'commit', value: 'not-a-sha' },
      },
    })

    expect(result).toEqual({
      schemaId: 'invalid-pin',
      enabled: false,
      config: { keep: true },
      addedAt: 456,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      'Dropping malformed installOverride for plugin "invalid-pin": installOverride.version is invalid',
    )
    warnSpy.mockRestore()
  })
})
