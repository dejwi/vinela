/**
 * Phase 4 Lifecycle Tests
 *
 * Tests for: seed data, safe cleanup, project store integration, auto-start scenarios.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnsureProjectProfilesSetup = vi.fn()

// ── Top-level mocks ───────────────────────────────────────────────────────────

// Mock the storage backend so lifecycle functions can be tested in isolation
vi.mock('@/shared/lib/storage', () => ({
  getStorageBackend: vi.fn(),
  getProjectStorageBackend: vi.fn(),
}))

// Mock the project store for openProjectForTutorial tests
vi.mock('@/features/projects/store', () => ({
  useProjectStore: {
    getState: vi.fn(),
  },
}))

// Mock settings for storage tests
vi.mock('@/shared/lib/settings', () => ({
  loadAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}))

vi.mock('@/features/profiles/storage', () => ({
  ensureProjectProfilesSetup: (...args: unknown[]) =>
    mockEnsureProjectProfilesSetup(...args),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import * as projectStoreModule from '@/features/projects/store'
import * as settingsModule from '@/shared/lib/settings'
import * as storageModule from '@/shared/lib/storage'
import { CURRENT_TUTORIAL_VERSION } from '@/shared/types/tutorial'
import {
  createTutorialSeedData,
  TUTORIAL_GRAPH_IDS,
  TUTORIAL_PROJECT_ID,
  TUTORIAL_SEED_VERSION,
} from '../data/seed-project'
import {
  cleanupTutorialProject,
  createTutorialProject,
  openTutorialProject,
} from '../lifecycle'
import { loadTutorialProgress } from '../storage'

// ── Typed mock references ─────────────────────────────────────────────────────

const mockGetProjectStorageBackend = vi.mocked(
  storageModule.getProjectStorageBackend,
)
const mockLoadAppSettings = vi.mocked(settingsModule.loadAppSettings)
const PREVIOUS_TUTORIAL_VERSION = CURRENT_TUTORIAL_VERSION - 1

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockBackendOptions {
  ensureProjectDir?: ReturnType<typeof vi.fn>
  writeProjectTextFile?: ReturnType<typeof vi.fn>
  writeProjectFile?: ReturnType<typeof vi.fn>
  readProjectFile?: ReturnType<typeof vi.fn>
  projectFileExists?: ReturnType<typeof vi.fn>
  removeProjectFile?: ReturnType<typeof vi.fn>
  listProjectDir?: ReturnType<typeof vi.fn>
  getAppDataPath?: ReturnType<typeof vi.fn>
  joinPath?: ReturnType<typeof vi.fn>
}

function createMockBackend(
  overrides: MockBackendOptions = {},
): Record<string, ReturnType<typeof vi.fn>> {
  return {
    ensureProjectDir:
      overrides.ensureProjectDir ?? vi.fn().mockResolvedValue(undefined),
    writeProjectTextFile:
      overrides.writeProjectTextFile ?? vi.fn().mockResolvedValue(undefined),
    writeProjectFile:
      overrides.writeProjectFile ?? vi.fn().mockResolvedValue(undefined),
    readProjectFile:
      overrides.readProjectFile ?? vi.fn().mockResolvedValue(undefined),
    projectFileExists:
      overrides.projectFileExists ?? vi.fn().mockResolvedValue(true),
    removeProjectFile:
      overrides.removeProjectFile ?? vi.fn().mockResolvedValue(undefined),
    listProjectDir: overrides.listProjectDir ?? vi.fn().mockResolvedValue([]),
    getAppDataPath:
      overrides.getAppDataPath ?? vi.fn().mockResolvedValue('/tmp'),
    joinPath:
      overrides.joinPath ??
      vi
        .fn()
        .mockImplementation((...args: string[]) =>
          Promise.resolve(args.join('/')),
        ),
  }
}

// ─── Seed Data Tests ──────────────────────────────────────────────────────────

describe('createTutorialSeedData', () => {
  it('returns a project named "Tutorial Project"', () => {
    const seed = createTutorialSeedData()
    expect(seed.project.name).toBe('Tutorial Project')
  })

  it('returns a project with deterministic ID', () => {
    const seed = createTutorialSeedData()
    expect(seed.project.id).toBe(TUTORIAL_PROJECT_ID)
  })

  it('creates exactly 3 graphs with unique IDs', () => {
    const seed = createTutorialSeedData()
    expect(seed.graphs).toHaveLength(3)

    const ids = seed.graphs.map((g) => g.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(3)
  })

  it('graph edges reference valid node IDs within the same graph', () => {
    const seed = createTutorialSeedData()

    for (const graph of seed.graphs) {
      const nodeIds = new Set(graph.nodes.map((n) => n.id))
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
      }
    }
  })

  it('"My First Config" has an On Startup trigger node', () => {
    const seed = createTutorialSeedData()
    const myFirstConfig = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.MY_FIRST_CONFIG,
    )
    expect(myFirstConfig).toBeDefined()

    const triggerNode = myFirstConfig?.nodes.find(
      (n) => n.data.nodeType === 'trigger',
    )
    expect(triggerNode).toBeDefined()
    if (triggerNode?.data.nodeType === 'trigger') {
      expect(triggerNode.data.triggerType).toBe('startup')
    }
  })

  it('"Greet User" has a Callable Entry node', () => {
    const seed = createTutorialSeedData()
    const greetUser = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.GREET_USER,
    )
    expect(greetUser).toBeDefined()

    const callableEntryNode = greetUser?.nodes.find(
      (n) => n.data.nodeType === 'callable-entry',
    )
    expect(callableEntryNode).toBeDefined()
  })

  it('includes at least one manual keymap', () => {
    const seed = createTutorialSeedData()
    expect(seed.keymaps.keymaps.length).toBeGreaterThanOrEqual(1)
  })

  it('neovim options include number and relativenumber', () => {
    const seed = createTutorialSeedData()
    expect(seed.neovimOptions.options['number']).toBeDefined()
    expect(seed.neovimOptions.options['relativenumber']).toBeDefined()
  })

  it('graphs have sequential order values', () => {
    const seed = createTutorialSeedData()
    const orders = seed.graphs.map((g) => g.order).sort((a, b) => a - b)
    expect(orders).toEqual([0, 1, 2])
  })

  it('all graphs are enabled by default', () => {
    const seed = createTutorialSeedData()
    for (const graph of seed.graphs) {
      expect(graph.enabled).toBe(true)
    }
  })

  // ── Fix 5: Seed graph edge ports ─────────────────────────────────────────

  it('seed graph edges use execution ports (not legacy out/in)', () => {
    const seed = createTutorialSeedData()
    for (const graph of seed.graphs) {
      for (const edge of graph.edges) {
        expect(edge.sourcePort).not.toBe('out')
        expect(edge.targetPort).not.toBe('in')
      }
    }
  })

  it('"My First Config" trigger edges use exec source port', () => {
    const seed = createTutorialSeedData()
    const myFirstConfig = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.MY_FIRST_CONFIG,
    )
    expect(myFirstConfig).toBeDefined()

    const triggerEdges = myFirstConfig?.edges.filter(
      (e) => e.source === 'tut-node-trigger-startup',
    )
    expect(triggerEdges?.length).toBeGreaterThan(0)
    for (const edge of triggerEdges ?? []) {
      expect(edge.sourcePort).toBe('exec')
      expect(edge.targetPort).toBe('exec')
    }
  })

  it('"My First Config" trigger-to-set-highlight edge uses exec ports', () => {
    const seed = createTutorialSeedData()
    const myFirstConfig = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.MY_FIRST_CONFIG,
    )
    const highlightEdge = myFirstConfig?.edges.find(
      (e) => e.id === 'edge-tut-trigger-to-highlight',
    )
    expect(highlightEdge).toBeDefined()
    expect(highlightEdge?.sourcePort).toBe('exec')
    expect(highlightEdge?.targetPort).toBe('exec')
  })

  it('"Greet User" callable-entry edge uses exec source port', () => {
    const seed = createTutorialSeedData()
    const greetUser = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.GREET_USER,
    )
    const entryEdge = greetUser?.edges.find(
      (e) => e.id === 'edge-tut-entry-to-run-function',
    )
    expect(entryEdge).toBeDefined()
    expect(entryEdge?.sourcePort).toBe('exec')
    expect(entryEdge?.targetPort).toBe('exec')
  })

  it('"Greet User" run-function-to-return edge uses done/exec ports', () => {
    const seed = createTutorialSeedData()
    const greetUser = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.GREET_USER,
    )
    const returnEdge = greetUser?.edges.find(
      (e) => e.id === 'edge-tut-run-function-to-return',
    )
    expect(returnEdge).toBeDefined()
    expect(returnEdge?.sourcePort).toBe('done')
    expect(returnEdge?.targetPort).toBe('exec')
  })

  // ── Fix 2: Node layout non-overlap ───────────────────────────────────────────

  it('"My First Config" nodes have minimum 120px gap between them', () => {
    const seed = createTutorialSeedData()
    const myFirstConfig = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.MY_FIRST_CONFIG,
    )
    expect(myFirstConfig).toBeDefined()

    const nodes = myFirstConfig?.nodes ?? []
    const minGap = 120

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i]
        const nodeB = nodes[j]
        if (nodeA === undefined || nodeB === undefined) {
          throw new Error(
            `Invariant: node at index ${i}/${j} missing in test data`,
          )
        }
        const dx = Math.abs(nodeA.position.x - nodeB.position.x)
        const dy = Math.abs(nodeA.position.y - nodeB.position.y)
        // At least one dimension should have minimum gap
        expect(dx >= minGap || dy >= minGap).toBe(true)
      }
    }
  })

  it('"Greet User" nodes have minimum 120px gap between them', () => {
    const seed = createTutorialSeedData()
    const greetUser = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.GREET_USER,
    )
    expect(greetUser).toBeDefined()

    const nodes = greetUser?.nodes ?? []
    const minGap = 120

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i]
        const nodeB = nodes[j]
        if (nodeA === undefined || nodeB === undefined) {
          throw new Error(
            `Invariant: node at index ${i}/${j} missing in test data`,
          )
        }
        const dx = Math.abs(nodeA.position.x - nodeB.position.x)
        const dy = Math.abs(nodeA.position.y - nodeB.position.y)
        expect(dx >= minGap || dy >= minGap).toBe(true)
      }
    }
  })

  it('"Editor Setup" nodes have minimum 120px gap between them', () => {
    const seed = createTutorialSeedData()
    const editorSetup = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.EDITOR_SETUP,
    )
    expect(editorSetup).toBeDefined()

    const nodes = editorSetup?.nodes ?? []
    const minGap = 120

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i]
        const nodeB = nodes[j]
        if (nodeA === undefined || nodeB === undefined) {
          throw new Error(
            `Invariant: node at index ${i}/${j} missing in test data`,
          )
        }
        const dx = Math.abs(nodeA.position.x - nodeB.position.x)
        const dy = Math.abs(nodeA.position.y - nodeB.position.y)
        expect(dx >= minGap || dy >= minGap).toBe(true)
      }
    }
  })

  // ── Keymap action type assertions ─────────────────────────────────────────

  it('no tutorial keymap uses telescope plugin functions', () => {
    const seed = createTutorialSeedData()
    for (const keymap of seed.keymaps.keymaps) {
      if (keymap.action.actionType === 'run-function') {
        expect(keymap.action.selectedFunctionKey).not.toContain('telescope')
      }
    }
  })

  it('"Save File" keymap uses run-action action type', () => {
    const seed = createTutorialSeedData()
    const saveKeymap = seed.keymaps.keymaps.find(
      (k) => k.id === 'tut-keymap-save-file',
    )
    expect(saveKeymap).toBeDefined()
    expect(saveKeymap?.action.actionType).toBe('run-action')
  })

  it('"Format" keymap uses run-function with core lsp_buf_format', () => {
    const seed = createTutorialSeedData()
    const formatKeymap = seed.keymaps.keymaps.find(
      (k) => k.id === 'tut-keymap-format',
    )
    expect(formatKeymap).toBeDefined()
    expect(formatKeymap?.action.actionType).toBe('run-function')
    if (formatKeymap?.action.actionType === 'run-function') {
      expect(formatKeymap.action.selectedFunctionKey).toBe(
        'core:lsp_buf_format',
      )
    }
  })

  it('"Greet" keymap uses run-custom-action pointing to Greet User graph', () => {
    const seed = createTutorialSeedData()
    const greetKeymap = seed.keymaps.keymaps.find(
      (k) => k.id === 'tut-keymap-greet',
    )
    expect(greetKeymap).toBeDefined()
    expect(greetKeymap?.action.actionType).toBe('run-custom-action')
    if (greetKeymap?.action.actionType === 'run-custom-action') {
      expect(greetKeymap.action.graphId).toBe(TUTORIAL_GRAPH_IDS.GREET_USER)
    }
  })

  // ── Tutorial Rework Tests (Phase 1-4) ──────────────────────────────────────

  it('seed data includes version field matching TUTORIAL_SEED_VERSION', () => {
    const seed = createTutorialSeedData()
    expect(seed.version).toBeDefined()
    expect(seed.version).toBe(TUTORIAL_SEED_VERSION)
    expect(seed.version).toBeGreaterThanOrEqual(2)
  })

  it('all autocmd nodes have empty callbackLua (on-event port usage)', () => {
    const seed = createTutorialSeedData()
    for (const graph of seed.graphs) {
      for (const node of graph.nodes) {
        if (
          node.data.nodeType === 'action' &&
          node.data.actionType === 'create-autocmd'
        ) {
          expect(node.data.actionConfig.callbackLua).toBe('')
        }
      }
    }
  })

  it('"Save File" keymap uses catalog mode with write action', () => {
    const seed = createTutorialSeedData()
    const saveKeymap = seed.keymaps.keymaps.find(
      (k) => k.id === 'tut-keymap-save-file',
    )
    expect(saveKeymap).toBeDefined()
    expect(saveKeymap?.action.actionType).toBe('run-action')
    if (saveKeymap?.action.actionType === 'run-action') {
      expect(saveKeymap.action.config.mode).toBe('catalog')
      expect(saveKeymap.action.config.selectedActionKey).toBe('write')
      expect(saveKeymap.action.config.action).toBe(':write')
    }
  })

  it('"My First Config" has Run Function node for yank highlighting', () => {
    const seed = createTutorialSeedData()
    const myFirstConfig = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.MY_FIRST_CONFIG,
    )
    const runFnNode = myFirstConfig?.nodes.find(
      (n) => n.id === 'tut-node-run-fn-highlight-yank',
    )
    expect(runFnNode).toBeDefined()
    expect(runFnNode?.type).toBe('run-function')
  })

  it('"Editor Setup" has Create Autocmd for BufWritePre', () => {
    const seed = createTutorialSeedData()
    const editorSetup = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.EDITOR_SETUP,
    )
    const autocmdNode = editorSetup?.nodes.find(
      (n) => n.id === 'tut-node-autocmd-format-on-save',
    )
    expect(autocmdNode).toBeDefined()
    expect(autocmdNode?.data.nodeType).toBe('action')
    if (
      autocmdNode?.data.nodeType === 'action' &&
      autocmdNode.data.actionType === 'create-autocmd'
    ) {
      expect(autocmdNode.data.actionConfig.events).toContain('BufWritePre')
    }
  })

  it('"Editor Setup" has Run Function node for lsp_buf_format', () => {
    const seed = createTutorialSeedData()
    const editorSetup = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.EDITOR_SETUP,
    )
    const runFnNode = editorSetup?.nodes.find(
      (n) => n.id === 'tut-node-run-fn-format',
    )
    expect(runFnNode).toBeDefined()
    expect(runFnNode?.type).toBe('run-function')
    if (runFnNode?.data.nodeType === 'run-function') {
      expect(runFnNode.data.selectedFunctionKey).toBe('core:lsp_buf_format')
      expect(runFnNode.data.signature).not.toBeNull()
    }
  })

  it('"Editor Setup" graph-ref node references Greet User graph', () => {
    const seed = createTutorialSeedData()
    const editorSetup = seed.graphs.find(
      (g) => g.id === TUTORIAL_GRAPH_IDS.EDITOR_SETUP,
    )
    const graphRefNode = editorSetup?.nodes.find(
      (n) => n.id === 'tut-node-graph-ref-greet',
    )
    expect(graphRefNode).toBeDefined()
    expect(graphRefNode?.type).toBe('graph-ref')
    if (graphRefNode?.data.nodeType === 'graph-ref') {
      expect(graphRefNode.data.referencedGraphId).toBe(
        TUTORIAL_GRAPH_IDS.GREET_USER,
      )
    }
  })
})

// ─── Version & Stale Detection Tests ─────────────────────────────────────────

describe('isTutorialStale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when version file matches current version', async () => {
    const { isTutorialStale } = await import('../lifecycle')
    const mockBackend = createMockBackend({
      readProjectFile: vi
        .fn()
        .mockResolvedValue({ version: TUTORIAL_SEED_VERSION }),
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    const stale = await isTutorialStale('/memory/projects/tutorial-12345')
    expect(stale).toBe(false)
  })

  it('returns true when version file has older version', async () => {
    const { isTutorialStale } = await import('../lifecycle')
    const mockBackend = createMockBackend({
      readProjectFile: vi
        .fn()
        .mockResolvedValue({ version: TUTORIAL_SEED_VERSION - 1 }),
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    const stale = await isTutorialStale('/memory/projects/tutorial-12345')
    expect(stale).toBe(true)
  })

  it('returns true when version file does not exist', async () => {
    const { isTutorialStale } = await import('../lifecycle')
    const mockBackend = createMockBackend({
      readProjectFile: vi.fn().mockRejectedValue(new Error('Not found')),
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    const stale = await isTutorialStale('/memory/projects/tutorial-12345')
    expect(stale).toBe(true)
  })
})

// ─── Cleanup Safety Tests (Fix #1) ───────────────────────────────────────────

describe('cleanupTutorialProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refuses to delete path without tutorial identifier (memory mode)', async () => {
    const mockBackend = createMockBackend()
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    // Path doesn't match /memory/projects/tutorial-* pattern
    await cleanupTutorialProject('/memory/projects/my-real-project')

    // Should not have called removeProjectFile (guard 1 failed)
    expect(mockBackend['removeProjectFile']).not.toHaveBeenCalled()
  })

  it('refuses to delete path without sentinel marker file', async () => {
    const mockBackend = createMockBackend({
      projectFileExists: vi.fn().mockResolvedValue(false), // No sentinel
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    await cleanupTutorialProject('/memory/projects/tutorial-12345')

    // Should not have called removeProjectFile (guard 2 failed)
    expect(mockBackend['removeProjectFile']).not.toHaveBeenCalled()
  })

  it('successfully cleans up valid tutorial project with sentinel (memory mode)', async () => {
    const mockRemoveProjectFile = vi.fn().mockResolvedValue(undefined)
    const mockBackend = createMockBackend({
      projectFileExists: vi.fn().mockResolvedValue(true), // Sentinel exists
      removeProjectFile: mockRemoveProjectFile,
      listProjectDir: vi.fn().mockResolvedValue([
        {
          name: 'tutorial-graph-my-first-config.json',
          isFile: true,
          isDirectory: false,
          isSymlink: false,
        },
      ]),
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    await cleanupTutorialProject('/memory/projects/tutorial-12345')

    // Should have called removeProjectFile at least once (for sentinel + other files)
    expect(mockRemoveProjectFile).toHaveBeenCalled()
  })

  it('handles cleanup of non-existent project gracefully (no throw)', async () => {
    const mockBackend = createMockBackend({
      projectFileExists: vi.fn().mockRejectedValue(new Error('Not found')),
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    // Should not throw
    await expect(
      cleanupTutorialProject('/memory/projects/tutorial-12345'),
    ).resolves.toBeUndefined()
  })
})

// ─── Project Store Integration (Fix #2) ──────────────────────────────────────

describe('openProjectForTutorial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens project without adding to recent projects', async () => {
    const mockAddRecentProject = vi.fn()
    const mockOpenProjectForTutorial = vi.fn().mockResolvedValue({
      success: true,
      project: {
        id: 'tutorial-project',
        name: 'Tutorial Project',
        absolutePath: '/memory/projects/tutorial-12345',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      },
    })

    // The mock is set up via vi.mock at module level — getState is already a vi.fn()
    ;(
      projectStoreModule.useProjectStore.getState as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      openProjectForTutorial: mockOpenProjectForTutorial,
      addRecentProject: mockAddRecentProject,
    })

    await openTutorialProject('/memory/projects/tutorial-12345')

    expect(mockOpenProjectForTutorial).toHaveBeenCalledWith(
      '/memory/projects/tutorial-12345',
    )
    // addRecentProject should NOT have been called
    expect(mockAddRecentProject).not.toHaveBeenCalled()
  })

  it('throws when project open fails', async () => {
    const mockOpenProjectForTutorial = vi.fn().mockResolvedValue({
      success: false,
      error: 'not_found',
      message: 'Folder not found',
    })

    ;(
      projectStoreModule.useProjectStore.getState as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      openProjectForTutorial: mockOpenProjectForTutorial,
    })

    await expect(
      openTutorialProject('/memory/projects/tutorial-12345'),
    ).rejects.toThrow('Failed to open tutorial project')
  })
})

// ─── Auto-Start / Resume Scenarios ───────────────────────────────────────────

describe('loadTutorialProgress (auto-start scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when no progress exists (first launch)', async () => {
    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: undefined,
    })

    const progress = await loadTutorialProgress()
    expect(progress).toBeNull()
  })

  it('returns progress with isActive=true when tutorial was interrupted', async () => {
    const interruptedProgress = {
      tutorialVersion: CURRENT_TUTORIAL_VERSION,
      currentStepIndex: 3,
      hasCompleted: false,
      isActive: true,
      startedAt: Date.now() - 60000,
      lastInteractedAt: Date.now() - 30000,
      tutorialProjectPath: '/memory/projects/tutorial-12345',
    }

    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: interruptedProgress,
    })

    const progress = await loadTutorialProgress()
    expect(progress).not.toBeNull()
    expect(progress?.isActive).toBe(true)
    expect(progress?.hasCompleted).toBe(false)
  })

  it('returns progress with hasCompleted=true when tutorial was completed', async () => {
    const completedProgress = {
      tutorialVersion: CURRENT_TUTORIAL_VERSION,
      currentStepIndex: 9,
      hasCompleted: true,
      isActive: false,
      startedAt: Date.now() - 120000,
      lastInteractedAt: Date.now() - 60000,
      tutorialProjectPath: null,
    }

    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: completedProgress,
    })

    const progress = await loadTutorialProgress()
    expect(progress).not.toBeNull()
    expect(progress?.hasCompleted).toBe(true)
  })
})

// ─── Version Migration ────────────────────────────────────────────────────────

describe('Tutorial version migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('treats outdated version as needing re-offer (resets hasCompleted)', async () => {
    const outdatedProgress = {
      tutorialVersion: PREVIOUS_TUTORIAL_VERSION,
      currentStepIndex: 9,
      hasCompleted: true,
      isActive: false,
      startedAt: 0,
      lastInteractedAt: 0,
      tutorialProjectPath: null,
    }

    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: outdatedProgress,
    })

    const progress = await loadTutorialProgress()
    expect(progress).not.toBeNull()
    // Version should be bumped to current
    expect(progress?.tutorialVersion).toBe(CURRENT_TUTORIAL_VERSION)
    // hasCompleted should be reset to false (re-offer)
    expect(progress?.hasCompleted).toBe(false)
  })

  it('preserves hasCompleted=false when migrating version', async () => {
    const outdatedProgress = {
      tutorialVersion: PREVIOUS_TUTORIAL_VERSION,
      currentStepIndex: 3,
      hasCompleted: false,
      isActive: false,
      startedAt: 0,
      lastInteractedAt: 0,
      tutorialProjectPath: null,
    }

    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: outdatedProgress,
    })

    const progress = await loadTutorialProgress()
    expect(progress).not.toBeNull()
    expect(progress?.tutorialVersion).toBe(CURRENT_TUTORIAL_VERSION)
    expect(progress?.hasCompleted).toBe(false)
  })
})

// ─── createTutorialProject Integration ───────────────────────────────────────

describe('createTutorialProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureProjectProfilesSetup.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes sentinel file before seed data', async () => {
    const callOrder: string[] = []
    const mockBackend = createMockBackend({
      writeProjectTextFile: vi
        .fn()
        .mockImplementation(async (_path: string, relativePath: string) => {
          callOrder.push(`text:${relativePath}`)
        }),
      writeProjectFile: vi
        .fn()
        .mockImplementation(async (_path: string, relativePath: string) => {
          callOrder.push(`json:${relativePath}`)
        }),
    })
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    await createTutorialProject()

    // Sentinel should be written before project.json
    const sentinelIndex = callOrder.findIndex((c) =>
      c.includes('.vinela-tutorial'),
    )
    const projectJsonIndex = callOrder.findIndex((c) =>
      c.includes('project.json'),
    )
    expect(sentinelIndex).toBeGreaterThanOrEqual(0)
    expect(projectJsonIndex).toBeGreaterThanOrEqual(0)
    expect(sentinelIndex).toBeLessThan(projectJsonIndex)
    expect(mockEnsureProjectProfilesSetup).toHaveBeenCalledWith(
      expect.stringContaining('tutorial-'),
    )
  })

  it('returns a path containing tutorial identifier (memory mode)', async () => {
    const mockBackend = createMockBackend()
    mockGetProjectStorageBackend.mockResolvedValue(mockBackend as never)

    const path = await createTutorialProject()

    expect(path).toContain('tutorial-')
    expect(path).toContain('/memory/projects/')
  })
})
