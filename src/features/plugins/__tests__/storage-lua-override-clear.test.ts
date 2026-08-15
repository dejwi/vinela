import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import type { InstalledPlugin } from '@/shared/types'
import {
  _resetLuaFieldOverrideQueueTestState,
  clearLuaFieldOverride,
  updateLuaFieldOverride,
} from '../storage'

const mockProjectFileExists = vi.mocked(projectFileExists)
const mockReadProjectFile = vi.mocked(readProjectFile)
const mockWriteProjectFile = vi.mocked(writeProjectFile)

interface StoredPluginsFile {
  configVersion: 1
  plugins: InstalledPlugin[]
}

function clonePlugins(plugins: InstalledPlugin[]): InstalledPlugin[] {
  return JSON.parse(JSON.stringify(plugins)) as InstalledPlugin[]
}

function getOverride(
  plugins: InstalledPlugin[],
  schemaId: string,
  optionKey: string,
): boolean | undefined {
  return plugins.find((p) => p.schemaId === schemaId)?.luaFieldOverrides?.[
    optionKey
  ]
}

function parseStoredPlugins(data: unknown): InstalledPlugin[] {
  if (typeof data !== 'object' || data === null || !('plugins' in data)) {
    throw new Error('Expected versioned plugins payload')
  }

  const plugins = (data as StoredPluginsFile).plugins
  if (!Array.isArray(plugins)) {
    throw new Error('Expected plugins array in payload')
  }

  return clonePlugins(plugins)
}

describe('clearLuaFieldOverride', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetLuaFieldOverrideQueueTestState()
    mockProjectFileExists.mockResolvedValue(true)
  })

  it('deletes one override key and keeps siblings', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        luaFieldOverrides: {
          a: true,
          b: false,
        },
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 1,
      plugins: clonePlugins(persisted),
    }))

    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _file, data) => {
        persisted = parseStoredPlugins(data)
      },
    )

    await clearLuaFieldOverride('/test/project', 'plugin-a', 'a')

    expect(getOverride(persisted, 'plugin-a', 'a')).toBeUndefined()
    expect(getOverride(persisted, 'plugin-a', 'b')).toBe(false)
  })

  it('resolves concurrent clear + set in queued call order', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        luaFieldOverrides: {
          handler: true,
        },
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 1,
      plugins: clonePlugins(persisted),
    }))

    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _file, data) => {
        persisted = parseStoredPlugins(data)
      },
    )

    await Promise.all([
      clearLuaFieldOverride('/test/project', 'plugin-a', 'handler'),
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', false),
    ])

    expect(getOverride(persisted, 'plugin-a', 'handler')).toBe(false)
  })
})
