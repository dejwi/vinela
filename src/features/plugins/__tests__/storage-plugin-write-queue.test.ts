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
import type { InstalledPlugin, PluginConfigValue } from '@/shared/types'
import {
  _resetPluginWriteQueueTestState,
  clearLuaFieldOverride,
  clearPluginInstallOverride,
  resetPluginOption,
  resetPluginToDefaults,
  updateLuaFieldOverride,
  updatePluginConfig,
  updatePluginInstallOverride,
} from '../storage'

const mockProjectFileExists = vi.mocked(projectFileExists)
const mockReadProjectFile = vi.mocked(readProjectFile)
const mockWriteProjectFile = vi.mocked(writeProjectFile)

interface StoredPluginsFile {
  configVersion: 2
  plugins: InstalledPlugin[]
}

function clonePlugins(plugins: InstalledPlugin[]): InstalledPlugin[] {
  return JSON.parse(JSON.stringify(plugins)) as InstalledPlugin[]
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolveFn: (() => void) | null = null
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve
  })

  if (resolveFn === null) {
    throw new Error('Invariant: deferred resolver was not initialized')
  }

  return {
    promise,
    resolve: resolveFn,
  }
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

function getConfigValue(
  plugins: InstalledPlugin[],
  schemaId: string,
  key: string,
): PluginConfigValue | undefined {
  return plugins.find((p) => p.schemaId === schemaId)?.config[key]
}

function getInstallOverrideValue(
  plugins: InstalledPlugin[],
  schemaId: string,
): string | undefined {
  return plugins.find((p) => p.schemaId === schemaId)?.installOverride?.version
    ?.value
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

describe('plugin write queueing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetPluginWriteQueueTestState()
    mockProjectFileExists.mockResolvedValue(true)
  })

  it('persists rapid ON→OFF→ON toggles in last-intent order', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    const writeOrder: Array<boolean | undefined> = []
    const writeDelays = [40, 10, 1]

    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        const nextPlugins = parseStoredPlugins(data)
        writeOrder.push(getOverride(nextPlugins, 'plugin-a', 'handler'))

        const callIndex = writeOrder.length - 1
        const delayMs = writeDelays[callIndex] ?? 0
        await wait(delayMs)
        persisted = nextPlugins
      },
    )

    await Promise.all([
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', true),
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', false),
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', true),
    ])

    expect(writeOrder).toEqual([true, false, true])
    expect(getOverride(persisted, 'plugin-a', 'handler')).toBe(true)
  })

  it('continues queue after a failed write', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    let writeCount = 0
    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        writeCount += 1
        const nextPlugins = parseStoredPlugins(data)

        if (writeCount === 1) {
          throw new Error('simulated write failure')
        }

        persisted = nextPlugins
      },
    )

    const results = await Promise.allSettled([
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', true),
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', false),
    ])

    expect(results[0]?.status).toBe('rejected')
    expect(results[1]?.status).toBe('fulfilled')
    expect(getOverride(persisted, 'plugin-a', 'handler')).toBe(false)
  })

  it('keeps queues isolated per plugin key', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        addedAt: 1,
      },
      {
        schemaId: 'plugin-b',
        enabled: true,
        config: {},
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    const gate = createDeferred()
    let heldAWrite = false

    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        const nextPlugins = parseStoredPlugins(data)
        const nextA = getOverride(nextPlugins, 'plugin-a', 'aOpt')
        const nextB = getOverride(nextPlugins, 'plugin-b', 'bOpt')

        if (nextA === true && nextB !== true && !heldAWrite) {
          heldAWrite = true
          await gate.promise
        }

        persisted = nextPlugins
      },
    )

    const aPromise = updateLuaFieldOverride(
      '/test/project',
      'plugin-a',
      'aOpt',
      true,
    )

    await wait(1)

    const bPromise = updateLuaFieldOverride(
      '/test/project',
      'plugin-b',
      'bOpt',
      true,
    )

    const bState = await Promise.race([
      bPromise.then(() => 'fulfilled' as const),
      wait(20).then(() => 'pending' as const),
    ])

    expect(bState).toBe('fulfilled')

    gate.resolve()
    await Promise.all([aPromise, bPromise])
  })

  it('preserves override mutation when config update is queued after it', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        luaFieldOverrides: { handler: true },
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    let firstWrite = true
    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        const nextPlugins = parseStoredPlugins(data)
        if (firstWrite) {
          firstWrite = false
          await wait(25)
        }
        persisted = nextPlugins
      },
    )

    await Promise.all([
      updateLuaFieldOverride('/test/project', 'plugin-a', 'handler', false),
      updatePluginConfig('/test/project', 'plugin-a', { a: 1 }),
    ])

    expect(getOverride(persisted, 'plugin-a', 'handler')).toBe(false)
    expect(getConfigValue(persisted, 'plugin-a', 'a')).toBe(1)
  })

  it('preserves clear mutation when clear is queued after config update', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        luaFieldOverrides: { handler: true },
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    let firstWrite = true
    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        const nextPlugins = parseStoredPlugins(data)
        if (firstWrite) {
          firstWrite = false
          await wait(25)
        }
        persisted = nextPlugins
      },
    )

    await Promise.all([
      updatePluginConfig('/test/project', 'plugin-a', { a: 1 }),
      clearLuaFieldOverride('/test/project', 'plugin-a', 'handler'),
    ])

    expect(getOverride(persisted, 'plugin-a', 'handler')).toBeUndefined()
    expect(getConfigValue(persisted, 'plugin-a', 'a')).toBe(1)
  })

  it('serializes install override writes with config writes', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: {},
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    let firstWrite = true
    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        const nextPlugins = parseStoredPlugins(data)
        if (firstWrite) {
          firstWrite = false
          await wait(25)
        }
        persisted = nextPlugins
      },
    )

    await Promise.all([
      updatePluginInstallOverride('/test/project', 'plugin-a', {
        version: { mode: 'ref', refKind: 'tag', value: 'v2.0.0' },
      }),
      updatePluginConfig('/test/project', 'plugin-a', { a: 1 }),
    ])

    expect(getInstallOverrideValue(persisted, 'plugin-a')).toBe('v2.0.0')
    expect(getConfigValue(persisted, 'plugin-a', 'a')).toBe(1)

    await clearPluginInstallOverride('/test/project', 'plugin-a')
    expect(getInstallOverrideValue(persisted, 'plugin-a')).toBeUndefined()
  })

  it('resetPluginToDefaults updates config and clears overrides in one write', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: { previous: true },
        luaFieldOverrides: { handler: true },
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        persisted = parseStoredPlugins(data)
      },
    )

    await resetPluginToDefaults('/test/project', 'plugin-a', {
      handler: 'default',
    })

    expect(mockWriteProjectFile).toHaveBeenCalledTimes(1)
    const plugin = persisted.find((p) => p.schemaId === 'plugin-a')
    expect(plugin?.config).toEqual({ handler: 'default' })
    expect(plugin?.luaFieldOverrides).toBeUndefined()
  })

  it('resetPluginOption writes merged config and clears only requested override key', async () => {
    let persisted: InstalledPlugin[] = [
      {
        schemaId: 'plugin-a',
        enabled: true,
        config: { old: true },
        luaFieldOverrides: { handler: true },
        addedAt: 1,
      },
    ]

    mockReadProjectFile.mockImplementation(async () => ({
      configVersion: 2,
      plugins: clonePlugins(persisted),
    }))

    mockWriteProjectFile.mockImplementation(
      async (_projectPath, _filePath, data) => {
        persisted = parseStoredPlugins(data)
      },
    )

    await resetPluginOption('/test/project', 'plugin-a', 'handler', {
      handler: 'function() return nil end',
      sibling: 'keep',
    })

    expect(mockWriteProjectFile).toHaveBeenCalledTimes(1)
    const plugin = persisted.find((p) => p.schemaId === 'plugin-a')
    expect(plugin?.config).toEqual({
      handler: 'function() return nil end',
      sibling: 'keep',
    })
    expect(plugin?.luaFieldOverrides).toBeUndefined()
  })
})
