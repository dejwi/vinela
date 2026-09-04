import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetPluginStoreTestState,
  usePluginStore,
} from '@/features/plugins/store'
import {
  _resetProjectProfilesStoreTestState,
  useProjectProfilesStore,
} from '@/features/profiles/store'
import type {
  InstalledPlugin,
  PluginSchema,
  ResolvedSchema,
} from '@/shared/types'

// Mock the storage and scanner modules before importing the store
vi.mock('../storage', () => ({
  loadKeymaps: vi.fn(),
  saveKeymaps: vi.fn(),
}))

vi.mock('../scanner', () => ({
  scanGraphsForKeymaps: vi.fn(),
}))

import * as keymapScanner from '../scanner'
import * as keymapStorage from '../storage'
import { _resetKeymapStoreTestState, useKeymapStore } from '../store'
import type { ProjectKeymap } from '../types'

const mockLoadKeymaps = vi.mocked(keymapStorage.loadKeymaps)
const mockScanGraphsForKeymaps = vi.mocked(keymapScanner.scanGraphsForKeymaps)

const TEST_PLUGIN_ID = 'test-plugin'
const TEST_FUNCTION_NAME = 'run_test_fn'

function createPluginSchema(): PluginSchema {
  return {
    id: TEST_PLUGIN_ID,
    pluginName: 'Test Plugin',
    pluginRepo: 'https://github.com/example/test-plugin',
    version: '1.0.0',
    options: [],
    functions: [
      {
        name: TEST_FUNCTION_NAME,
        params: [],
        luaCall: 'require("test-plugin").run_test_fn($params)',
      },
    ],
  }
}

function createResolvedSchema(): ResolvedSchema {
  return {
    schema: createPluginSchema(),
    source: 'project',
  }
}

function createInstalledPlugin(): InstalledPlugin {
  return {
    schemaId: TEST_PLUGIN_ID,
    enabled: true,
    config: {},
    addedAt: 123,
  }
}

function createManualPluginKeymap(): ProjectKeymap {
  return {
    id: 'keymap-1',
    modes: ['n'],
    keySequence: '<leader>tt',
    action: {
      actionType: 'run-function',
      selectedFunctionKey: TEST_FUNCTION_NAME,
      functionSource: {
        type: 'plugin',
        pluginId: TEST_PLUGIN_ID,
        functionName: TEST_FUNCTION_NAME,
      },
      signature: null,
      paramDefaults: {},
    },
    description: 'Run test plugin function',
    silent: true,
    noremap: true,
    expr: false,
    enabled: true,
  }
}

describe('Keymap store init lifecycle', () => {
  beforeEach(() => {
    useKeymapStore.getState().resetForProjectClose()
    _resetKeymapStoreTestState()
    usePluginStore.getState().resetForProjectClose()
    _resetPluginStoreTestState()
    useProjectProfilesStore.getState().resetForProjectClose()
    _resetProjectProfilesStoreTestState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with idle status', () => {
    expect(useKeymapStore.getState().initStatus).toEqual({ status: 'idle' })
  })

  it('transitions to loading then ready on success', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    expect(useKeymapStore.getState().initStatus).toEqual({
      status: 'ready',
      projectPath: '/project-a',
    })
  })

  it('guards against duplicate init for same project', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(mockLoadKeymaps).toHaveBeenCalledTimes(1)

    // Second call should be a no-op (already ready)
    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(mockLoadKeymaps).toHaveBeenCalledTimes(1)
  })

  it('re-initializes for different project', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(mockLoadKeymaps).toHaveBeenCalledTimes(1)

    // Different project should trigger new init
    await useKeymapStore.getState().loadAllKeymaps('/project-b')
    expect(mockLoadKeymaps).toHaveBeenCalledTimes(2)
    expect(useKeymapStore.getState().initStatus).toEqual({
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

    mockLoadKeymaps.mockImplementation(async (path) => {
      if (path === '/project-a') {
        await slowPromiseA
      }
      return []
    })
    mockScanGraphsForKeymaps.mockResolvedValue([])

    // Start init for project A (don't await)
    const initA = useKeymapStore.getState().loadAllKeymaps('/project-a')

    // Close and open project B before A completes.
    // resetForProjectClose() bumps initGeneration — do NOT call
    // _resetKeymapStoreTestState() here, as that would undo the bump.
    useKeymapStore.getState().resetForProjectClose()
    const initB = useKeymapStore.getState().loadAllKeymaps('/project-b')

    // Now let A complete
    resolveA()
    await initA

    // B should have completed too
    await initB

    // Store should have B's state, not A's
    expect(useKeymapStore.getState().initStatus).toEqual({
      status: 'ready',
      projectPath: '/project-b',
    })
  })

  it('deduplicates concurrent calls for same project', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    // Fire two concurrent inits for same project
    const init1 = useKeymapStore.getState().loadAllKeymaps('/project-a')
    const init2 = useKeymapStore.getState().loadAllKeymaps('/project-a')

    await Promise.all([init1, init2])

    // Should only have loaded once
    expect(mockLoadKeymaps).toHaveBeenCalledTimes(1)
  })

  it('transitions to error status on failure', async () => {
    mockLoadKeymaps.mockRejectedValue(new Error('disk fail'))
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    const status = useKeymapStore.getState().initStatus
    expect(status.status).toBe('error')
    if (status.status === 'error') {
      expect(status.projectPath).toBe('/project-a')
      expect(status.error).toContain('disk fail')
    }
  })

  it('allows retry after error by resetting to idle', async () => {
    mockLoadKeymaps.mockRejectedValueOnce(new Error('fail'))
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(useKeymapStore.getState().initStatus.status).toBe('error')

    // Reset to idle then retry
    useKeymapStore.setState((state) => {
      state.initStatus = { status: 'idle' }
    })
    _resetKeymapStoreTestState()

    mockLoadKeymaps.mockResolvedValueOnce([])
    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(useKeymapStore.getState().initStatus.status).toBe('ready')
  })

  it('resetForProjectClose resets to idle and clears data', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(useKeymapStore.getState().initStatus.status).toBe('ready')

    useKeymapStore.getState().resetForProjectClose()
    expect(useKeymapStore.getState().initStatus).toEqual({ status: 'idle' })
    expect(useKeymapStore.getState().manualKeymaps).toEqual([])
    expect(useKeymapStore.getState().graphKeymaps).toEqual([])
    expect(useKeymapStore.getState().error).toBeNull()
    expect(useKeymapStore.getState().projectPath).toBeNull()
  })

  it('sets projectPath in state during loading', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    expect(useKeymapStore.getState().projectPath).toBe('/project-a')
  })

  it('sets error field alongside error initStatus', async () => {
    mockLoadKeymaps.mockRejectedValue(new Error('disk fail'))
    mockScanGraphsForKeymaps.mockResolvedValue([])

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    expect(useKeymapStore.getState().error).toContain('disk fail')
  })

  it('clears plugin-reference warnings when plugins become ready later', async () => {
    const manualKeymaps = [createManualPluginKeymap()]
    mockLoadKeymaps.mockResolvedValue(manualKeymaps)
    mockScanGraphsForKeymaps.mockResolvedValue([])

    usePluginStore.setState((state) => {
      state.installedPlugins = []
      state.schemas = []
      state.initStatus = { status: 'loading', projectPath: '/project-a' }
    })
    useProjectProfilesStore.setState({
      initStatus: { status: 'ready', projectPath: '/project-a' },
      projectPath: '/project-a',
    })

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    expect(useKeymapStore.getState().validationIssues).toHaveLength(1)
    expect(useKeymapStore.getState().validationIssues[0]?.code).toBe(
      'plugin-not-installed',
    )

    usePluginStore.setState({
      installedPlugins: [createInstalledPlugin()],
      schemas: [createResolvedSchema()],
      initStatus: { status: 'ready', projectPath: '/project-a' },
    })

    expect(useKeymapStore.getState().validationIssues).toEqual([])
  })

  it('does not revalidate on plugin UI-only state updates', async () => {
    mockLoadKeymaps.mockResolvedValue([])
    mockScanGraphsForKeymaps.mockResolvedValue([])

    usePluginStore.setState({
      installedPlugins: [createInstalledPlugin()],
      schemas: [createResolvedSchema()],
      initStatus: { status: 'ready', projectPath: '/project-a' },
    })
    useProjectProfilesStore.setState({
      initStatus: { status: 'ready', projectPath: '/project-a' },
      projectPath: '/project-a',
    })

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    const validateSpy = vi.spyOn(useKeymapStore.getState(), 'validateKeymaps')

    usePluginStore.getState().setSearchQuery('ui-only-change')
    usePluginStore.getState().setActiveTab('browse')

    expect(validateSpy).not.toHaveBeenCalled()

    validateSpy.mockRestore()
  })

  it('does not keep prior plugin subscription after failed re-init', async () => {
    mockLoadKeymaps.mockResolvedValueOnce([])
    mockLoadKeymaps.mockRejectedValueOnce(new Error('failed to load keymaps'))
    mockScanGraphsForKeymaps.mockResolvedValue([])

    usePluginStore.setState({
      installedPlugins: [createInstalledPlugin()],
      schemas: [createResolvedSchema()],
      initStatus: { status: 'ready', projectPath: '/project-a' },
    })
    useProjectProfilesStore.setState({
      initStatus: { status: 'ready', projectPath: '/project-a' },
      projectPath: '/project-a',
    })

    await useKeymapStore.getState().loadAllKeymaps('/project-a')

    const validateSpy = vi.spyOn(useKeymapStore.getState(), 'validateKeymaps')
    validateSpy.mockClear()

    await useKeymapStore.getState().loadAllKeymaps('/project-b')

    const currentInstalledPlugins = usePluginStore.getState().installedPlugins
    usePluginStore.setState({
      installedPlugins: [
        ...currentInstalledPlugins,
        {
          schemaId: 'another-plugin',
          enabled: true,
          config: {},
          addedAt: 456,
        },
      ],
      initStatus: { status: 'ready', projectPath: '/project-b' },
    })
    useProjectProfilesStore.setState({
      profiles: [
        { id: 'a', name: 'A', color: '#000000', defaultActive: false },
      ],
      overrides: { a: true },
    })

    expect(validateSpy).not.toHaveBeenCalled()
    expect(useKeymapStore.getState().initStatus.status).toBe('error')

    validateSpy.mockRestore()
  })

  it('defers profile-controlled validation until profiles are ready and follows active overrides', async () => {
    const keymap = createManualPluginKeymap()
    keymap.enabled = false
    keymap.profileIds = ['a']
    mockLoadKeymaps.mockResolvedValue([keymap])
    mockScanGraphsForKeymaps.mockResolvedValue([])
    useProjectProfilesStore.setState({
      initStatus: { status: 'loading', projectPath: '/project-a' },
      projectPath: '/project-a',
    })

    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(useKeymapStore.getState().validationIssues).toEqual([])

    useProjectProfilesStore.setState({
      profiles: [
        { id: 'a', name: 'A', color: '#000000', defaultActive: false },
      ],
      overrides: { a: true },
      initStatus: { status: 'ready', projectPath: '/project-a' },
    })
    expect(useKeymapStore.getState().validationIssues[0]?.code).toBe(
      'plugin-not-installed',
    )

    useProjectProfilesStore.setState({ overrides: { a: false } })
    expect(useKeymapStore.getState().validationIssues).toEqual([])
  })

  it('clears validation issues when profile initialization errors', async () => {
    const keymap = createManualPluginKeymap()
    keymap.profileIds = ['a']
    mockLoadKeymaps.mockResolvedValue([keymap])
    mockScanGraphsForKeymaps.mockResolvedValue([])
    useProjectProfilesStore.setState({
      profiles: [{ id: 'a', name: 'A', color: '#000000', defaultActive: true }],
      initStatus: { status: 'ready', projectPath: '/project-a' },
      projectPath: '/project-a',
    })

    await useKeymapStore.getState().loadAllKeymaps('/project-a')
    expect(useKeymapStore.getState().validationIssues).toHaveLength(1)
    useProjectProfilesStore.setState({
      initStatus: {
        status: 'error',
        projectPath: '/project-a',
        error: 'profile load failed',
      },
    })
    expect(useKeymapStore.getState().validationIssues).toEqual([])
  })
})
