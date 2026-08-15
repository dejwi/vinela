/**
 * Orchestrator Fixture Helper
 *
 * Centralises storage-mock wiring for Category 11 (Full Pipeline) integration
 * tests. Exports:
 *   - `OrchestratorFixture` – typed fixture contract
 *   - `setupOrchestratorMocks(fixture)` – configure all vi.fn() mocks
 *   - `makeResolvedSchemas(schemas, source?)` – wrap plain schemas into
 *     `ResolvedSchema[]` expected by data-loader.ts's `loadSchemasSafe` path
 *   - `createEnabledStateMap(graphs)` – build a fully-enabled disable-state map
 *   - `createComplexOrchestratorFixture()` – reusable multi-graph fixture
 *
 * Usage:
 *   ```ts
 *   vi.mock('@/features/graph-editor/storage', () => ({ listGraphs: vi.fn() }))
 *   // … (all other mocks) …
 *   await setupOrchestratorMocks(createComplexOrchestratorFixture())
 *   ```
 */

import type { vi } from 'vitest'
import type { ProjectKeymap } from '@/features/keymaps/types'
import type {
  Graph,
  GraphDisableState,
  PluginSchema,
  ResolvedSchema,
} from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { createCallablePort, GraphBuilder } from '../../utils/graph-builder'

// Re-export so callers can import from this file without importing shared/types
export type { ResolvedSchema }

export interface InstalledPluginFixture {
  schemaId: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface NeovimOptionsFixture {
  version: number
  options: Record<string, unknown>
  leaderKey?: string
  highlightOverrides?: Array<{
    id: string
    groupName: string
    foreground: string
    background: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    undercurl: boolean
    link: string
    enabled: boolean
    source: { kind: string }
  }>
  updatedAt: number
}

export interface OrchestratorFixture {
  graphs: Graph[]
  plugins?: InstalledPluginFixture[]
  resolvedSchemas?: ResolvedSchema[]
  options?: NeovimOptionsFixture | null
  keymaps?: ProjectKeymap[]
  lsp?: { enabledServers: string[] }
  colorscheme?: {
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }
  projectMeta?: {
    id: string
    name: string
    createdAt: number
    lastModifiedAt: number
  } | null
  /**
   * Optional override for the disable-states map returned by computeDisableStates.
   * When omitted all graphs with `enabled: true` are marked effective 'enabled'.
   */
  disableStates?: ReadonlyMap<string, GraphDisableState>
}

// ============================================
// Helpers
// ============================================

/**
 * Create a fully-enabled disable-state map for the given graphs.
 * Only graphs with `graph.enabled === true` are included.
 */
export function createEnabledStateMap(
  graphs: readonly Graph[],
): ReadonlyMap<string, GraphDisableState> {
  return new Map(
    graphs
      .filter((g) => g.enabled)
      .map((graph) => [
        graph.id,
        {
          graphId: graph.id,
          userEnabled: true,
          effective: { kind: 'enabled' as const },
        },
      ]),
  )
}

/**
 * Wrap plain PluginSchema objects into the ResolvedSchema shape expected by
 * data-loader.ts's `loadSchemasSafe`. Always use this when mocking
 * `loadAllSchemas` — a plain `PluginSchema[]` will cause silent runtime errors
 * in the `r.schema` mapping path.
 */
export function makeResolvedSchemas(
  schemas: PluginSchema[],
  source: 'builtin' | 'global' | 'project' = 'builtin',
): ResolvedSchema[] {
  return schemas.map((schema) => ({ schema, source }))
}

// ============================================
// Mock Setup
// ============================================

/**
 * Configure all vi.fn() mocks using the given fixture.
 *
 * Must be called AFTER all `vi.mock(...)` declarations at the top of the test
 * file. Uses dynamic imports so that the hoisted vi.mock() factory wrappers
 * are already in place by the time mock values are set.
 */
export async function setupOrchestratorMocks(
  fixture: OrchestratorFixture,
): Promise<void> {
  const { listGraphs } = await import('@/features/graph-editor/storage')
  const { loadInstalledPlugins, loadAllSchemas } = await import(
    '@/features/plugins/storage'
  )
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

  // Graphs
  ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue(fixture.graphs)

  // Plugins
  ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
    status: fixture.plugins !== undefined ? 'loaded' : 'file-not-found',
    plugins:
      fixture.plugins?.map((p) => ({
        schemaId: p.schemaId,
        enabled: p.enabled,
        config: p.config,
        addedAt: Date.now(),
      })) ?? [],
  })

  // Schemas — MUST be ResolvedSchema[], not plain PluginSchema[]
  const resolvedSchemas = fixture.resolvedSchemas ?? []
  ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue(
    resolvedSchemas,
  )

  // Neovim options
  ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.options ?? null,
  )

  // Keymaps
  ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.keymaps ?? [],
  )

  // LSP
  ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixture.lsp ?? { enabledServers: [] },
  )

  // Colorscheme
  ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: fixture.colorscheme ?? {
      activeScheme: null,
      variantPreferences: {},
    },
    source: fixture.colorscheme !== undefined ? 'file' : 'default',
  })

  // Disable states
  const stateMap =
    fixture.disableStates ?? createEnabledStateMap(fixture.graphs)
  ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
    statesByGraphId: stateMap,
  })

  // Project metadata
  if (fixture.projectMeta !== undefined && fixture.projectMeta !== null) {
    ;(readProjectFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      fixture.projectMeta,
    )
  } else {
    ;(readProjectFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('project.json not found'),
    )
  }
}

// ============================================
// Complex Fixture Builder
// ============================================

/**
 * Create a reusable multi-graph fixture with:
 *   - 3 graphs: startup, conditional, callable
 *   - options (leaderKey + booleans/numbers)
 *   - 1 enabled plugin + matching resolvedSchemas entry
 *   - 1 project keymap
 *   - LSP servers
 *   - Active colorscheme
 *   - Project metadata with a custom name
 */
export function createComplexOrchestratorFixture(): OrchestratorFixture {
  // Graph 1: startup graph with set-option actions
  const startupGraph = new GraphBuilder('Main Startup', 'complex-startup')
    .startupTrigger('entry')
    .action('setNumber', 'set-option', {
      ...createDefaultActionConfig('set-option'),
      optionName: 'number',
      scope: 'global',
      valueConfig: { valueMode: 'suggested', suggestedValue: true },
    })
    .action('setWrap', 'set-option', {
      ...createDefaultActionConfig('set-option'),
      optionName: 'wrap',
      scope: 'global',
      valueConfig: { valueMode: 'suggested', suggestedValue: false },
    })
    .connectExec('entry', 'setNumber')
    .connectExec('setNumber', 'setWrap')
    .withOrder(0)
    .build()

  // Graph 2: conditional graph
  const condGraph = new GraphBuilder('Conditional', 'complex-cond')
    .startupTrigger('entry')
    .condition('cond', '>', 'x', '5')
    .action('high', 'run-action', {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "High"',
      selectedActionKey: '',
      paramValues: {},
    })
    .action('low', 'run-action', {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Low"',
      selectedActionKey: '',
      paramValues: {},
    })
    .connectExec('entry', 'cond')
    .connectTrue('cond', 'high')
    .connectFalse('cond', 'low')
    .withOrder(1)
    .build()

  // Graph 3: callable graph
  const callableGraph = new GraphBuilder('Helper', 'complex-callable')
    .callableEntry('entry', [createCallablePort('name', 'Name', 'string')])
    .action('greet', 'run-action', {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Hello"',
      selectedActionKey: '',
      paramValues: {},
    })
    .returnNode('ret', [createCallablePort('greeting', 'Greeting', 'string')])
    .connectExec('entry', 'greet')
    .connectExec('greet', 'ret')
    .withOrder(2)
    .build()

  const graphs = [startupGraph, condGraph, callableGraph]

  // Simple plugin schema
  const pluginSchema: PluginSchema = {
    id: 'test-plugin',
    pluginName: 'Test Plugin',
    pluginRepo: 'user/test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    options: [],
    functions: [],
  }

  // Project keymap
  const keymap: ProjectKeymap = {
    id: 'km-1',
    modes: ['n'],
    keySequence: '<leader>t',
    action: {
      actionType: 'run-action',
      config: {
        mode: 'custom-command',
        actionType: 'command',
        action: ':echo "test"<CR>',
        selectedActionKey: '',
        paramValues: {},
      },
    },
    description: 'Test keymap',
    silent: true,
    noremap: true,
    expr: false,
    enabled: true,
  }

  return {
    graphs,
    plugins: [{ schemaId: 'test-plugin', enabled: true, config: {} }],
    resolvedSchemas: makeResolvedSchemas([pluginSchema], 'builtin'),
    options: {
      version: 1,
      options: {
        number: { valueType: 'boolean', value: true },
        relativenumber: { valueType: 'boolean', value: true },
        wrap: { valueType: 'boolean', value: false },
        tabstop: { valueType: 'number', value: 2 },
      },
      leaderKey: ' ',
      updatedAt: Date.now(),
    },
    keymaps: [keymap],
    lsp: { enabledServers: ['lua_ls'] },
    colorscheme: {
      activeScheme: 'tokyonight',
      variantPreferences: {},
    },
    projectMeta: {
      id: 'complex-project-id',
      name: 'Complex Test Project',
      createdAt: 1000,
      lastModifiedAt: Date.now(),
    },
  }
}
