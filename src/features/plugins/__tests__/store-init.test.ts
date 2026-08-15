import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the storage module before importing the store
vi.mock('../storage', () => ({
  loadAllSchemas: vi.fn(),
  loadInstalledPlugins: vi.fn(),
  installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
  togglePlugin: vi.fn(),
  updatePluginConfig: vi.fn(),
  updatePluginInstallOverride: vi.fn(),
  clearPluginInstallOverride: vi.fn(),
  resetPluginToDefaults: vi.fn(),
  saveGlobalSchema: vi.fn(),
  saveProjectSchema: vi.fn(),
  deleteGlobalSchema: vi.fn(),
  deleteProjectSchema: vi.fn(),
  exportStandalone: vi.fn(),
}))

import type { PluginSchema } from '@/shared/types'
import * as pluginStorage from '../storage'
import { _resetPluginStoreTestState, usePluginStore } from '../store'

const mockLoadAllSchemas = vi.mocked(pluginStorage.loadAllSchemas)
const mockLoadInstalledPlugins = vi.mocked(pluginStorage.loadInstalledPlugins)
const mockUpdatePluginInstallOverride = vi.mocked(
  pluginStorage.updatePluginInstallOverride,
)
const mockClearPluginInstallOverride = vi.mocked(
  pluginStorage.clearPluginInstallOverride,
)

function makeSchema(): PluginSchema {
  return {
    id: 'plugin-a',
    pluginName: 'Plugin A',
    pluginRepo: 'https://github.com/example/plugin-a',
    version: '1.0.0',
    options: [],
    functions: [],
  }
}

describe('Plugin store init lifecycle', () => {
  beforeEach(() => {
    usePluginStore.getState().resetForProjectClose()
    _resetPluginStoreTestState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with idle status', () => {
    expect(usePluginStore.getState().initStatus).toEqual({ status: 'idle' })
  })

  it('transitions to loading then ready on success', async () => {
    mockLoadAllSchemas.mockResolvedValue([])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    const statusHistory: string[] = []
    const unsubscribe = usePluginStore.subscribe((state) => {
      statusHistory.push(state.initStatus.status)
    })

    await usePluginStore.getState().initializePlugins('/project-a')

    expect(usePluginStore.getState().initStatus).toEqual({
      status: 'ready',
      projectPath: '/project-a',
    })

    unsubscribe()
  })

  it('guards against duplicate init for same project', async () => {
    mockLoadAllSchemas.mockResolvedValue([])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    await usePluginStore.getState().initializePlugins('/project-a')
    expect(mockLoadAllSchemas).toHaveBeenCalledTimes(1)

    // Second call should be a no-op (already ready)
    await usePluginStore.getState().initializePlugins('/project-a')
    expect(mockLoadAllSchemas).toHaveBeenCalledTimes(1)
  })

  it('re-initializes for different project', async () => {
    mockLoadAllSchemas.mockResolvedValue([])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    await usePluginStore.getState().initializePlugins('/project-a')
    expect(mockLoadAllSchemas).toHaveBeenCalledTimes(1)

    // Different project should trigger new init
    await usePluginStore.getState().initializePlugins('/project-b')
    expect(mockLoadAllSchemas).toHaveBeenCalledTimes(2)
    expect(usePluginStore.getState().initStatus).toEqual({
      status: 'ready',
      projectPath: '/project-b',
    })
  })

  it('discards stale results when project changes during init', async () => {
    // Simulate slow init for project A
    let resolveA!: () => void
    const slowPromiseA = new Promise<void>((resolve) => {
      resolveA = resolve
    })

    mockLoadAllSchemas.mockImplementation(async (path) => {
      if (path === '/project-a') {
        await slowPromiseA
      }
      return []
    })
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    // Start init for project A (don't await)
    const initA = usePluginStore.getState().initializePlugins('/project-a')

    // Close and open project B before A completes.
    // resetForProjectClose() bumps initGeneration — do NOT call
    // _resetPluginStoreTestState() here, as that would undo the bump.
    usePluginStore.getState().resetForProjectClose()
    const initB = usePluginStore.getState().initializePlugins('/project-b')

    // Now let A complete
    resolveA()
    await initA

    // B should have completed too
    await initB

    // Store should have B's state, not A's
    expect(usePluginStore.getState().initStatus).toEqual({
      status: 'ready',
      projectPath: '/project-b',
    })
  })

  it('deduplicates concurrent calls for same project', async () => {
    mockLoadAllSchemas.mockResolvedValue([])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    // Fire two concurrent inits for same project
    const init1 = usePluginStore.getState().initializePlugins('/project-a')
    const init2 = usePluginStore.getState().initializePlugins('/project-a')

    await Promise.all([init1, init2])

    // Should only have loaded once
    expect(mockLoadAllSchemas).toHaveBeenCalledTimes(1)
  })

  it('transitions to error status on failure', async () => {
    mockLoadAllSchemas.mockRejectedValue(new Error('disk fail'))
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    await usePluginStore.getState().initializePlugins('/project-a')

    const status = usePluginStore.getState().initStatus
    expect(status.status).toBe('error')
    if (status.status === 'error') {
      expect(status.projectPath).toBe('/project-a')
      expect(status.error).toContain('disk fail')
    }
  })

  it('allows retry after error by resetting to idle', async () => {
    mockLoadAllSchemas.mockRejectedValueOnce(new Error('fail'))
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    await usePluginStore.getState().initializePlugins('/project-a')
    expect(usePluginStore.getState().initStatus.status).toBe('error')

    // Reset to idle then retry (simulating what the retry button does)
    usePluginStore.setState((state) => {
      state.initStatus = { status: 'idle' }
    })
    _resetPluginStoreTestState()

    mockLoadAllSchemas.mockResolvedValueOnce([])
    await usePluginStore.getState().initializePlugins('/project-a')
    expect(usePluginStore.getState().initStatus.status).toBe('ready')
  })

  it('resetForProjectClose resets to idle and clears data', async () => {
    mockLoadAllSchemas.mockResolvedValue([])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    await usePluginStore.getState().initializePlugins('/project-a')
    expect(usePluginStore.getState().initStatus.status).toBe('ready')

    usePluginStore.getState().resetForProjectClose()
    expect(usePluginStore.getState().initStatus).toEqual({ status: 'idle' })
    expect(usePluginStore.getState().schemas).toEqual([])
    expect(usePluginStore.getState().installedPlugins).toEqual([])
    expect(usePluginStore.getState().error).toBeNull()
  })

  it('sets error field alongside error initStatus', async () => {
    mockLoadAllSchemas.mockRejectedValue(new Error('disk fail'))
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [],
    })

    await usePluginStore.getState().initializePlugins('/project-a')

    expect(usePluginStore.getState().error).toContain('disk fail')
  })

  it('updates and clears plugin install override without resetting config', async () => {
    mockLoadAllSchemas.mockResolvedValue([
      { schema: makeSchema(), source: 'builtin' },
    ])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [
        {
          schemaId: 'plugin-a',
          enabled: true,
          config: { keep: 'value' },
          addedAt: 1,
        },
      ],
    })
    mockUpdatePluginInstallOverride.mockResolvedValue(undefined)
    mockClearPluginInstallOverride.mockResolvedValue(undefined)

    await usePluginStore.getState().initializePlugins('/project-a')

    mockLoadInstalledPlugins.mockResolvedValueOnce({
      status: 'loaded',
      plugins: [
        {
          schemaId: 'plugin-a',
          enabled: true,
          config: { keep: 'value' },
          installOverride: {
            version: { mode: 'ref', refKind: 'branch', value: 'main' },
          },
          addedAt: 1,
        },
      ],
    })

    await usePluginStore
      .getState()
      .updatePluginInstallOverride('/project-a', 'plugin-a', {
        version: { mode: 'ref', refKind: 'branch', value: ' main ' },
      })

    expect(
      usePluginStore.getState().installedPlugins[0]?.installOverride,
    ).toEqual({
      version: { mode: 'ref', refKind: 'branch', value: 'main' },
    })
    expect(usePluginStore.getState().installedPlugins[0]?.config).toEqual({
      keep: 'value',
    })

    mockLoadInstalledPlugins.mockResolvedValueOnce({
      status: 'loaded',
      plugins: [
        {
          schemaId: 'plugin-a',
          enabled: true,
          config: { keep: 'value' },
          addedAt: 1,
        },
      ],
    })

    await usePluginStore
      .getState()
      .clearPluginInstallOverride('/project-a', 'plugin-a')

    expect(
      usePluginStore.getState().installedPlugins[0]?.installOverride,
    ).toBeUndefined()
    expect(usePluginStore.getState().installedPlugins[0]?.config).toEqual({
      keep: 'value',
    })
  })

  it('resetPluginToDefaults preserves installOverride', async () => {
    mockLoadAllSchemas.mockResolvedValue([])
    mockLoadInstalledPlugins.mockResolvedValue({
      status: 'loaded',
      plugins: [
        {
          schemaId: 'plugin-a',
          enabled: true,
          config: { keep: 'value' },
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v1.0.0' },
          },
          addedAt: 1,
        },
      ],
    })

    await usePluginStore.getState().initializePlugins('/project-a')
    vi.mocked(pluginStorage.resetPluginToDefaults).mockResolvedValue(undefined)
    mockLoadInstalledPlugins.mockResolvedValueOnce({
      status: 'loaded',
      plugins: [
        {
          schemaId: 'plugin-a',
          enabled: true,
          config: {},
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v1.0.0' },
          },
          addedAt: 1,
        },
      ],
    })

    await usePluginStore
      .getState()
      .resetPluginToDefaults('/project-a', 'plugin-a', {})

    expect(
      usePluginStore.getState().installedPlugins[0]?.installOverride,
    ).toEqual({
      version: { mode: 'ref', refKind: 'tag', value: 'v1.0.0' },
    })
  })

  it('routes schema imports and deletion to their selected tier', async () => {
    const schema = makeSchema()
    mockLoadAllSchemas.mockResolvedValue([])
    usePluginStore.setState({
      initStatus: { status: 'ready', projectPath: '/project-a' },
    })

    await usePluginStore
      .getState()
      .importSchema(schema, '/project-a', 'project')
    await usePluginStore.getState().importSchema(schema, '/project-a', 'global')
    await usePluginStore
      .getState()
      .deleteSchema(schema.id, 'project', '/project-a')
    await usePluginStore
      .getState()
      .deleteSchema(schema.id, 'global', '/project-a')

    expect(pluginStorage.saveProjectSchema).toHaveBeenCalledWith(
      '/project-a',
      schema,
    )
    expect(pluginStorage.saveGlobalSchema).toHaveBeenCalledWith(schema)
    expect(pluginStorage.deleteProjectSchema).toHaveBeenCalledWith(
      '/project-a',
      schema.id,
    )
    expect(pluginStorage.deleteGlobalSchema).toHaveBeenCalledWith(schema.id)
    expect(mockLoadAllSchemas).toHaveBeenCalledTimes(4)
  })
})
