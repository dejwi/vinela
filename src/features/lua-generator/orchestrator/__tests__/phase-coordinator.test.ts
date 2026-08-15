// ============================================
// Orchestrator Tests
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import type {
  Graph,
  GraphDisableState,
  GraphNode,
  InstalledPlugin,
  PluginSchema,
} from '@/shared/types'
import type { GenerationPhase, OrchestratorOptions } from '../../types'
import { generateInitLuaOrchestrator } from '../phase-coordinator'

// Mock storage modules - simple factory functions
vi.mock('@/features/graph-editor/storage', () => ({
  listGraphs: vi.fn(),
}))

vi.mock('@/features/plugins/storage', () => ({
  loadInstalledPlugins: vi.fn(),
  loadAllSchemas: vi.fn(),
}))

vi.mock('@/features/settings/storage/neovim-options', () => ({
  readNeovimOptions: vi.fn(),
}))

vi.mock('@/features/keymaps/storage', () => ({
  loadKeymaps: vi.fn(),
}))

vi.mock('@/features/lsp/storage', () => ({
  loadProjectLspConfig: vi.fn(),
}))

vi.mock('@/features/colorschemes/storage', () => ({
  loadColorSchemePreferences: vi.fn(),
}))

vi.mock('@/features/graph-editor/utils/graph-disable-state', () => ({
  computeDisableStates: vi.fn(),
}))

vi.mock('@/shared/lib/storage-api', () => ({
  readProjectFile: vi.fn(),
}))

describe('generateInitLuaOrchestrator', () => {
  const createMockOptions = (
    overrides?: Partial<OrchestratorOptions>,
  ): OrchestratorOptions => ({
    projectPath: '/test/project',
    targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
    ...overrides,
  })

  function createEnabledStateMap(
    graphs: readonly Graph[],
  ): ReadonlyMap<string, GraphDisableState> {
    return new Map(
      graphs.map((graph) => [
        graph.id,
        {
          graphId: graph.id,
          userEnabled: true,
          effective: { kind: 'enabled' },
        },
      ]),
    )
  }

  function createGraphRefNodeWithNoTarget(id: string): GraphNode {
    return {
      id,
      type: 'graph-ref',
      definitionId: 'graph-ref',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'graph-ref',
        referencedGraphId: '',
      },
    }
  }

  function createGraph(
    id: string,
    name: string,
    nodes: readonly GraphNode[] = [],
  ): Graph {
    return {
      id,
      name,
      nodes: [...nodes],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
      enabled: true,
      order: 0,
    }
  }

  async function setupDefaultMocks(
    graphs: readonly Graph[] = [],
    projectName?: string,
  ): Promise<void> {
    const { listGraphs } = await import('@/features/graph-editor/storage')
    const { loadInstalledPlugins } = await import('@/features/plugins/storage')
    const { loadAllSchemas } = await import('@/features/plugins/storage')
    const { readNeovimOptions } = await import(
      '@/features/settings/storage/neovim-options'
    )
    const { loadKeymaps } = await import('@/features/keymaps/storage')
    const { loadProjectLspConfig } = await import('@/features/lsp/storage')
    const { loadColorSchemePreferences } = await import(
      '@/features/colorschemes/storage'
    )
    const { computeDisableStates } = await import(
      '@/features/graph-editor/utils/graph-disable-state'
    )
    const { readProjectFile } = await import('@/shared/lib/storage-api')

    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue(graphs)
    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'file-not-found',
      plugins: [],
    })
    ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      enabledServers: [],
    })
    ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        success: true,
        data: { activeScheme: null, variantPreferences: {} },
        source: 'default',
      },
    )
    ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
      statesByGraphId: createEnabledStateMap(graphs),
    })
    if (projectName !== undefined) {
      ;(readProjectFile as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'test-project-id',
        name: projectName,
        createdAt: 1,
        lastModifiedAt: 1,
      })
    } else {
      ;(readProjectFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('project.json not found'),
      )
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error for empty project path', async () => {
    const result = await generateInitLuaOrchestrator('', createMockOptions())

    expect(result.success).toBe(false)
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.id).toBe('ERR_INVALID_PROJECT')
  })

  it('should handle cancellation before start', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({ signal: controller.signal }),
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.id).toBe('ERR_CANCELLED')
  })

  it('should emit progress phases in order', async () => {
    const phases: GenerationPhase[] = []

    const { listGraphs } = await import('@/features/graph-editor/storage')
    const { loadInstalledPlugins } = await import('@/features/plugins/storage')
    const { loadAllSchemas } = await import('@/features/plugins/storage')
    const { readNeovimOptions } = await import(
      '@/features/settings/storage/neovim-options'
    )
    const { loadKeymaps } = await import('@/features/keymaps/storage')
    const { loadProjectLspConfig } = await import('@/features/lsp/storage')
    const { loadColorSchemePreferences } = await import(
      '@/features/colorschemes/storage'
    )
    const { computeDisableStates } = await import(
      '@/features/graph-editor/utils/graph-disable-state'
    )
    const { readProjectFile } = await import('@/shared/lib/storage-api')

    // Setup mocks
    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'file-not-found',
      plugins: [],
    })
    ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      enabledServers: [],
    })
    ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        success: true,
        data: { activeScheme: null, variantPreferences: {} },
        source: 'default',
      },
    )
    ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
      statesByGraphId: new Map(),
    })
    ;(readProjectFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('project.json not found'),
    )

    await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({
        onProgress: (phase: GenerationPhase) => phases.push(phase),
      }),
    )

    // Verify phases were emitted
    const phaseTypes = phases.map((p) => p.type)
    expect(phaseTypes).toContain('validating')
    expect(phaseTypes).toContain('generating-sections')
    expect(phaseTypes).toContain('complete')
  })

  it('should return successful result with initLua', async () => {
    const { listGraphs } = await import('@/features/graph-editor/storage')
    const { loadInstalledPlugins } = await import('@/features/plugins/storage')
    const { loadAllSchemas } = await import('@/features/plugins/storage')
    const { readNeovimOptions } = await import(
      '@/features/settings/storage/neovim-options'
    )
    const { loadKeymaps } = await import('@/features/keymaps/storage')
    const { loadProjectLspConfig } = await import('@/features/lsp/storage')
    const { loadColorSchemePreferences } = await import(
      '@/features/colorschemes/storage'
    )
    const { computeDisableStates } = await import(
      '@/features/graph-editor/utils/graph-disable-state'
    )
    const { readProjectFile } = await import('@/shared/lib/storage-api')

    // Setup mocks
    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'file-not-found',
      plugins: [],
    })
    ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      enabledServers: [],
    })
    ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        success: true,
        data: { activeScheme: null, variantPreferences: {} },
        source: 'default',
      },
    )
    ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
      statesByGraphId: new Map(),
    })
    ;(readProjectFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('project.json not found'),
    )

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
    expect(result.initLua?.length).toBeGreaterThan(0)
    expect(result.metadata.graphsGenerated).toBe(0)
    expect(result.metadata.pluginsConfigured).toBe(0)
  })

  it('should include metadata with phase timings', async () => {
    const { listGraphs } = await import('@/features/graph-editor/storage')
    const { loadInstalledPlugins } = await import('@/features/plugins/storage')
    const { loadAllSchemas } = await import('@/features/plugins/storage')
    const { readNeovimOptions } = await import(
      '@/features/settings/storage/neovim-options'
    )
    const { loadKeymaps } = await import('@/features/keymaps/storage')
    const { loadProjectLspConfig } = await import('@/features/lsp/storage')
    const { loadColorSchemePreferences } = await import(
      '@/features/colorschemes/storage'
    )
    const { computeDisableStates } = await import(
      '@/features/graph-editor/utils/graph-disable-state'
    )
    const { readProjectFile } = await import('@/shared/lib/storage-api')

    // Setup mocks
    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'file-not-found',
      plugins: [],
    })
    ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      enabledServers: [],
    })
    ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        success: true,
        data: { activeScheme: null, variantPreferences: {} },
        source: 'default',
      },
    )
    ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
      statesByGraphId: new Map(),
    })
    ;(readProjectFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('project.json not found'),
    )

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.metadata.generationTimeMs).toBeGreaterThanOrEqual(0)
    expect(result.metadata.phaseTimingsMs).toBeDefined()
    expect(Object.keys(result.metadata.phaseTimingsMs).length).toBeGreaterThan(
      0,
    )
  })

  it('runs pre-generation checks before generation', async () => {
    const phases: GenerationPhase[] = []
    await setupDefaultMocks()

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({
        onProgress: (phase: GenerationPhase) => phases.push(phase),
      }),
    )

    expect(result.success).toBe(true)

    const preGenerationPhaseIndex = phases.findIndex(
      (phase) =>
        phase.type === 'validating' && phase.checkName === 'pre-generation',
    )
    const disableStatePhaseIndex = phases.findIndex(
      (phase) =>
        phase.type === 'validating' &&
        phase.checkName === 'compute-disable-state',
    )
    const sectionPhaseIndex = phases.findIndex(
      (phase) => phase.type === 'generating-sections',
    )

    expect(preGenerationPhaseIndex).toBeGreaterThan(-1)
    expect(disableStatePhaseIndex).toBeGreaterThan(preGenerationPhaseIndex)
    expect(sectionPhaseIndex).toBeGreaterThan(disableStatePhaseIndex)
  })

  it('returns early if pre-generation has errors', async () => {
    const phases: GenerationPhase[] = []
    const invalidGraph = createGraph('graph-a', 'Graph A', [
      createGraphRefNodeWithNoTarget('graph-ref-1'),
    ])

    await setupDefaultMocks([invalidGraph])

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({
        onProgress: (phase: GenerationPhase) => phases.push(phase),
      }),
    )

    expect(result.success).toBe(false)
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.id === 'ERR_REF_GRAPH_REF_NO_TARGET',
      ),
    ).toBe(true)
    expect(phases).toContainEqual({
      type: 'validating',
      checkName: 'pre-generation',
    })
    expect(phases.some((phase) => phase.type === 'generating-sections')).toBe(
      false,
    )
    expect(phases.some((phase) => phase.type === 'generating-graphs')).toBe(
      false,
    )
    expect(phases.some((phase) => phase.type === 'validating-output')).toBe(
      false,
    )
  })

  // ============================================
  // Gap 7: Project Name in Header (was hardcoded 'Project')
  // ============================================

  it('includes actual project name in generated initLua header', async () => {
    await setupDefaultMocks([], 'My Awesome Config')

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(result.initLua).toContain('My Awesome Config')
  })

  it('falls back to "Project" when project.json cannot be read', async () => {
    // setupDefaultMocks with no projectName causes readProjectFile to reject
    await setupDefaultMocks([])

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    // Should contain the fallback name
    expect(result.initLua).toContain('Project')
  })

  it('succeeds even when project metadata fails to load (non-fatal)', async () => {
    // Project meta failure should emit a warning (not block generation)
    await setupDefaultMocks([])

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    // Generation should still succeed
    expect(result.success).toBe(true)
    expect(result.initLua).toBeDefined()
  })

  // ============================================
  // Gap 6: Phase 8 validating-output progress phase
  // ============================================

  it('emits validating-output phase during generation', async () => {
    const phases: GenerationPhase[] = []
    await setupDefaultMocks([], 'Test Project')

    await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions({
        onProgress: (phase: GenerationPhase) => phases.push(phase),
      }),
    )

    expect(phases.some((phase) => phase.type === 'validating-output')).toBe(
      true,
    )
  })

  it('does not emit WARN_BLOCK_IMBALANCE for balanced generated output', async () => {
    await setupDefaultMocks([], 'Test Project')

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    expect(
      result.diagnostics.some((d) => d.id === 'WARN_BLOCK_IMBALANCE'),
    ).toBe(false)
  })

  it('applies nested lua include overrides in final orchestrated Lua output', async () => {
    const { loadInstalledPlugins } = await import('@/features/plugins/storage')
    const { loadAllSchemas } = await import('@/features/plugins/storage')

    await setupDefaultMocks([], 'Nested Override Project')

    const schema: PluginSchema = {
      id: 'nested-plugin',
      pluginName: 'Nested Plugin',
      pluginRepo: 'owner/nested-plugin',
      version: '1.0.0',
      options: [
        {
          key: 'opts',
          label: 'Options',
          type: 'object',
          properties: [
            {
              key: 'callback',
              label: 'Callback',
              type: 'lua',
            },
          ],
        },
      ],
      setup: {
        requirePath: 'nested-plugin',
      },
      functions: [],
    }

    const basePlugin: InstalledPlugin = {
      schemaId: 'nested-plugin',
      enabled: true,
      config: {
        opts: {
          callback: 'function() return 7 end',
        },
      },
      addedAt: 1,
    }

    ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue([
      { schema, source: 'project' },
    ])
    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'loaded',
      plugins: [
        {
          ...basePlugin,
          luaFieldOverrides: { 'opts.callback': false },
        },
      ],
    })

    const excluded = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(excluded.success).toBe(true)
    expect(excluded.initLua).not.toContain('callback')

    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'loaded',
      plugins: [
        {
          ...basePlugin,
          luaFieldOverrides: { 'opts.callback': true },
        },
      ],
    })

    const included = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(included.success).toBe(true)
    expect(included.initLua).toContain('callback')
  })
})
