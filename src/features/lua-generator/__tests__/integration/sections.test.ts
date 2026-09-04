/**
 * Category 9: Section Generation Integration Tests
 *
 * Verifies that section-level Lua output is correctly generated and assembled
 * by the orchestrator, with deterministic ordering and omission of empty sections.
 *
 * All tests use the real orchestration path (`generateInitLuaOrchestrator`) and
 * assert section headers, representative lines, and relative ordering instead of
 * whole-file snapshots, making them robust against timestamp/header changes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectKeymap } from '@/features/keymaps/types'
import { expectedCallableRef } from '@/features/lua-generator/__tests__/utils/callable-keys'
import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
} from '@/features/lua-generator/__tests__/utils/lua-assert'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import { generateInitLuaOrchestrator } from '@/features/lua-generator/orchestrator/phase-coordinator'
import type { OrchestratorOptions } from '@/features/lua-generator/types'
import type {
  Graph,
  GraphDisableState,
  HighlightOverride,
  InstalledPlugin,
  PluginSchema,
  ResolvedSchema,
} from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'

// ============================================
// Mock all storage modules (same pattern as full-pipeline.test.ts)
// ============================================

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

vi.mock('@/features/profiles/storage', () => ({
  loadProjectProfiles: vi.fn().mockResolvedValue([]),
  loadProjectProfileOverrides: vi.fn().mockResolvedValue({}),
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

// ============================================
// Assertion Helpers
// ============================================

/**
 * Returns the index of a marker comment in the Lua string.
 * Fails the test if the marker is not found.
 */
function getMarkerIndex(lua: string, marker: string): number {
  const idx = lua.indexOf(marker)
  expect(
    idx,
    `Expected to find marker "${marker}" in output`,
  ).toBeGreaterThanOrEqual(0)
  return idx
}

/**
 * Asserts that the given markers appear in strictly ascending order
 * within the Lua string.
 */
function expectMarkersInOrder(lua: string, markers: string[]): void {
  let prev = -1
  let prevMarker = '(start)'
  for (const marker of markers) {
    const idx = getMarkerIndex(lua, marker)
    expect(
      idx,
      `Expected "${marker}" to appear after "${prevMarker}", but it came first`,
    ).toBeGreaterThan(prev)
    prev = idx
    prevMarker = marker
  }
}

/**
 * Asserts a marker appears exactly once in the Lua output.
 * Catches duplicate section headers that would still pass an order-only check.
 */
function expectContainsOnce(lua: string, marker: string): void {
  const count = lua.split(marker).length - 1
  expect(
    count,
    `Expected "${marker}" to appear exactly once but found ${count} occurrence(s)`,
  ).toBe(1)
}

/**
 * Asserts that a section header is present in the Lua output.
 */
function expectSectionPresent(lua: string, sectionId: string): void {
  expect(
    lua,
    `Expected section "-- Section: ${sectionId}" to be present`,
  ).toContain(`-- Section: ${sectionId}`)
}

/**
 * Asserts that a section header is absent from the Lua output.
 */
function expectSectionAbsent(lua: string, sectionId: string): void {
  expect(
    lua,
    `Expected section "-- Section: ${sectionId}" to be absent`,
  ).not.toContain(`-- Section: ${sectionId}`)
}

// ============================================
// Mock Setup Helpers
// ============================================

/**
 * Helper type for fixture definition passed to setupMocksWithFixture.
 */
interface SectionTestFixture {
  graphs: Graph[]
  plugins?: InstalledPlugin[]
  schemas?: PluginSchema[]
  options?: {
    version: 1
    options: Record<string, { valueType: string; value: unknown }>
    leaderKey?: string
    highlightOverrides?: HighlightOverride[]
    updatedAt: number
  } | null
  keymaps?: ProjectKeymap[]
  lsp?: { enabledServers: string[] }
  colorscheme?: {
    activeScheme: string | null
    variantPreferences: Record<string, string>
  }
}

/**
 * Sets up all storage mocks with the given fixture data.
 *
 * Key invariant: `schemas` must be wrapped as `ResolvedSchema[]` before being
 * passed to `loadAllSchemas`, because `loadSchemasSafe()` calls
 * `resolved.map((r) => r.schema)` — passing raw schemas would produce undefined
 * entries and silently break plugin resolution.
 */
async function setupMocksWithFixture(
  fixture: SectionTestFixture,
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

  // Graphs
  ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue(fixture.graphs)

  // Plugins — use InstalledPlugin shape directly
  ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
    status: fixture.plugins !== undefined ? 'loaded' : 'file-not-found',
    plugins: fixture.plugins ?? [],
  })

  // Schemas — wrap to ResolvedSchema[] so loadSchemasSafe().map((r) => r.schema) works
  const resolvedSchemas: ResolvedSchema[] = (fixture.schemas ?? []).map(
    (schema) => ({ schema, source: 'project' as const }),
  )
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

  // Enable all graphs by default (all graphs from fixture are treated as enabled)
  ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
    statesByGraphId: createEnabledStateMap(fixture.graphs),
  })
}

/**
 * Creates an OrchestratorOptions object for the test project path.
 */
function createMockOptions(
  overrides?: Partial<OrchestratorOptions>,
): OrchestratorOptions {
  return {
    projectPath: '/test/project',
    targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
    ...overrides,
  }
}

/**
 * Creates a map of graph IDs to fully-enabled GraphDisableState objects.
 * Used to mock computeDisableStates for tests that don't need disable logic.
 */
function createEnabledStateMap(
  graphs: readonly Graph[],
): ReadonlyMap<string, GraphDisableState> {
  return new Map(
    graphs.map((graph) => [
      graph.id,
      {
        graphId: graph.id,
        userEnabled: true,
        effective: { kind: 'enabled' as const },
      },
    ]),
  )
}

// ============================================
// Minimal Graph Factories
// ============================================

/**
 * Create a minimal startup graph with a connected exec path.
 *
 * IMPORTANT: A bare startup trigger with no downstream edges produces an empty
 * unit and suppresses the `-- Startup Execution` block entirely. This factory
 * always connects at least one action to ensure a real snippet is emitted.
 */
function createMinimalStartupGraph(
  id = 'startup-graph',
  name = 'Startup',
): Graph {
  return new GraphBuilder(name, id)
    .startupTrigger('entry')
    .action('setNum', 'set-option', {
      ...createDefaultActionConfig('set-option'),
      optionName: 'number',
      scope: 'global',
      valueConfig: { valueMode: 'suggested', suggestedValue: true },
    })
    .connectExec('entry', 'setNum')
    .build()
}

/**
 * Create a minimal callable graph for testing callable-functions section emission.
 */
function createCallableGraph(id = 'callable-graph', name = 'Helper'): Graph {
  return new GraphBuilder(name, id)
    .callableEntry('entry', [createCallablePort('msg', 'Message', 'string')])
    .action('echo', 'run-action', {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo msg',
      selectedActionKey: '',
      paramValues: {},
    })
    .returnNode('ret', [createCallablePort('result', 'Result', 'string')])
    .connectExec('entry', 'echo')
    .connectExec('echo', 'ret')
    .build()
}

/**
 * Minimal PluginSchema factory — creates a schema with only the required fields
 * needed by the LSP gate checks in the section generator.
 */
function createMinimalSchema(
  id: string,
  pluginName: string,
  pluginRepo: string,
  capabilities?: PluginSchema['capabilities'],
): PluginSchema {
  return {
    id,
    pluginName,
    pluginRepo,
    version: '1.0.0',
    options: [],
    functions: [],
    capabilities,
  }
}

/**
 * Create a minimal InstalledPlugin entry.
 */
function createInstalledPlugin(
  schemaId: string,
  enabled = true,
): InstalledPlugin {
  return {
    schemaId,
    enabled,
    config: {},
    addedAt: Date.now(),
  }
}

/**
 * Build a minimal HighlightOverride with sensible defaults.
 */
function createHighlightOverride(
  id: string,
  groupName: string,
  overrides: Partial<Omit<HighlightOverride, 'id' | 'groupName'>> = {},
): HighlightOverride {
  return {
    id,
    groupName,
    foreground: '',
    background: '',
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    undercurl: false,
    link: '',
    enabled: true,
    source: { kind: 'custom' },
    ...overrides,
  }
}

// ============================================
// Setup
// ============================================

// ============================================
// Tests
// ============================================

describe('Category 9: Section Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.1  Leader key section
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.1 leader-key section', () => {
    it('emits vim.g.mapleader and vim.g.maplocalleader before keymaps', async () => {
      const graph = createMinimalStartupGraph()

      const km: ProjectKeymap = {
        id: 'km-1',
        modes: ['n'],
        keySequence: '<leader>w',
        action: {
          actionType: 'run-action',
          config: {
            mode: 'custom-command',
            actionType: 'command',
            action: 'w',
            selectedActionKey: '',
            paramValues: {},
          },
        },
        description: '',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      }

      await setupMocksWithFixture({
        graphs: [graph],
        options: {
          version: 1,
          options: {},
          leaderKey: ' ',
          updatedAt: Date.now(),
        },
        keymaps: [km],
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Section header must exist
      expectSectionPresent(lua, 'leader-key')

      // Both mapleader assignments must be present
      expect(lua).toContain('vim.g.mapleader = " "')
      expect(lua).toContain('vim.g.maplocalleader = " "')

      // leader-key section must come before project-keymaps section
      expectMarkersInOrder(lua, [
        '-- Section: leader-key',
        '-- Section: project-keymaps',
      ])

      // First mapleader assignment must come before first vim.keymap.set call
      const mapleaderIdx = lua.indexOf('vim.g.mapleader')
      const keymapSetIdx = lua.indexOf('vim.keymap.set(')
      expect(mapleaderIdx).toBeGreaterThanOrEqual(0)
      expect(keymapSetIdx).toBeGreaterThan(mapleaderIdx)

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.2  Neovim options section
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.2 neovim-options section', () => {
    it('emits vim.opt.* assignments for non-default option values', async () => {
      const graph = createMinimalStartupGraph()

      // NOTE: `wrap` defaults to `true` in Neovim, so setting wrap=true would be
      // omitted by the generator (it's the default). Use wrap=false instead —
      // that IS non-default and will be emitted as `vim.opt.wrap = false`.
      await setupMocksWithFixture({
        graphs: [graph],
        options: {
          version: 1,
          options: {
            number: { valueType: 'boolean', value: true },
            tabstop: { valueType: 'number', value: 4 },
            wrap: { valueType: 'boolean', value: false },
          },
          updatedAt: Date.now(),
        },
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Section header must exist
      expectSectionPresent(lua, 'neovim-options')

      // Each configured option must appear as a vim.opt.* line
      expect(lua).toContain('vim.opt.number = true')
      expect(lua).toContain('vim.opt.tabstop = 4')
      expect(lua).toContain('vim.opt.wrap = false')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.3  Project keymaps section
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.3 project-keymaps section', () => {
    it('emits exactly 2 vim.keymap.set calls for 2 enabled keymaps', async () => {
      const graph = createMinimalStartupGraph()

      const km1: ProjectKeymap = {
        id: 'km-ff',
        modes: ['n'],
        keySequence: '<leader>ff',
        action: {
          actionType: 'run-action',
          config: {
            mode: 'custom-command',
            actionType: 'command',
            action: 'Telescope find_files',
            selectedActionKey: '',
            paramValues: {},
          },
        },
        description: 'Find files',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      }

      const km2: ProjectKeymap = {
        id: 'km-w',
        modes: ['n'],
        keySequence: '<leader>w',
        action: {
          actionType: 'run-action',
          config: {
            mode: 'custom-command',
            actionType: 'command',
            action: 'w',
            selectedActionKey: '',
            paramValues: {},
          },
        },
        description: 'Save',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      }

      await setupMocksWithFixture({
        graphs: [graph],
        options: {
          version: 1,
          options: {},
          leaderKey: ' ',
          updatedAt: Date.now(),
        },
        keymaps: [km1, km2],
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Section header must exist
      expectSectionPresent(lua, 'project-keymaps')

      // Section must contain the keymaps comment header
      expect(lua).toContain('-- Keymaps')

      // Exactly 2 vim.keymap.set calls (startup graph has no set-keymap actions)
      const keymapSetCount = (lua.match(/vim\.keymap\.set\(/g) ?? []).length
      expect(
        keymapSetCount,
        `Expected exactly 2 vim.keymap.set() calls, found ${keymapSetCount}`,
      ).toBe(2)

      // Both key sequences must be present
      expect(lua).toContain('<leader>ff')
      expect(lua).toContain('<leader>w')

      // Commands must be wrapped in <cmd>...<CR> form
      expect(lua).toContain('<cmd>Telescope find_files<CR>')
      expect(lua).toContain('<cmd>w<CR>')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.4  LSP section
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.4 lsp section', () => {
    it('emits vim.lsp.enable block with sorted server names when nvim-lspconfig is installed', async () => {
      const graph = createMinimalStartupGraph()

      // Both plugins required for the LSP section to emit its full content:
      // mason-nvim  → mason-registry block
      // nvim-lspconfig → vim.lsp.enable block
      const plugins: InstalledPlugin[] = [
        createInstalledPlugin('nvim-lspconfig'),
        createInstalledPlugin('mason-nvim'),
      ]

      const schemas: PluginSchema[] = [
        createMinimalSchema(
          'nvim-lspconfig',
          'nvim-lspconfig',
          'https://github.com/neovim/nvim-lspconfig',
          [
            {
              kind: 'lsp-server-enabler',
              api: 'vim.lsp.enable',
              minNvimVersion: '0.11',
            },
          ],
        ),
        createMinimalSchema(
          'mason-nvim',
          'mason.nvim',
          'https://github.com/mason-org/mason.nvim',
          [
            {
              kind: 'lsp-package-installer',
              provider: 'mason-registry',
            },
          ],
        ),
      ]

      await setupMocksWithFixture({
        graphs: [graph],
        plugins,
        schemas,
        lsp: { enabledServers: ['vtsls', 'lua_ls'] }, // intentionally unsorted
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Section header must exist
      expectSectionPresent(lua, 'lsp')

      // Version gate must be present
      expect(lua).toContain('if vim.fn.has("nvim-0.11") == 1 then')

      // vim.lsp.enable block must be present
      expect(lua).toContain('vim.lsp.enable({')

      // Both server names must appear
      expect(lua).toContain('"lua_ls"')
      expect(lua).toContain('"vtsls"')

      // Alphabetical order: lua_ls must appear before vtsls in the vim.lsp.enable({}) block.
      // NOTE: We scope the search to the lsp-enable block specifically, because the Mason
      // auto-install block (emitted before it) also contains server/package names in a
      // different order (mason packages: "lua-language-server" vs "vtsls"), which would
      // confuse a naive indexOf check on the whole file.
      const lspEnableStart = lua.indexOf('vim.lsp.enable({')
      expect(
        lspEnableStart,
        'Expected vim.lsp.enable({ to be present in LSP section',
      ).toBeGreaterThanOrEqual(0)
      const lspEnableEnd = lua.indexOf('})', lspEnableStart)
      const lspEnableBlock = lua.slice(lspEnableStart, lspEnableEnd)
      const luaLsIdxInBlock = lspEnableBlock.indexOf('"lua_ls"')
      const vtslsIdxInBlock = lspEnableBlock.indexOf('"vtsls"')
      expect(
        luaLsIdxInBlock,
        '"lua_ls" must be present in vim.lsp.enable block',
      ).toBeGreaterThanOrEqual(0)
      expect(
        vtslsIdxInBlock,
        '"vtsls" must appear after "lua_ls" in vim.lsp.enable block (alphabetical)',
      ).toBeGreaterThan(luaLsIdxInBlock)

      // Mason block must be present (mason-nvim is installed)
      expect(lua).toContain('mason-registry')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.5  Highlight overrides section
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.5 highlights section', () => {
    it('emits set_hl_merged helper and override calls for enabled overrides', async () => {
      const graph = createMinimalStartupGraph()

      const overrides: HighlightOverride[] = [
        createHighlightOverride('hl-normal', 'Normal', {
          background: 'NONE',
        }),
        createHighlightOverride('hl-comment', 'Comment', {
          foreground: '#7aa2f7',
          italic: true,
        }),
      ]

      await setupMocksWithFixture({
        graphs: [graph],
        options: {
          version: 1,
          options: {},
          highlightOverrides: overrides,
          updatedAt: Date.now(),
        },
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Section header must exist
      expectSectionPresent(lua, 'highlights')

      // Merge helper function must be present
      expect(lua).toContain('local function set_hl_merged(group, overrides)')

      // vim.api.nvim_set_hl call via the helper
      expect(lua).toContain('vim.api.nvim_set_hl(0, group, merged)')

      // Both override calls must be present (groups sorted alphabetically: Comment before Normal)
      expect(lua).toContain('set_hl_merged("Comment"')
      expect(lua).toContain('set_hl_merged("Normal"')

      // Comment override should come before Normal (alphabetical sort in generator)
      const commentIdx = lua.indexOf('set_hl_merged("Comment"')
      const normalIdx = lua.indexOf('set_hl_merged("Normal"')
      expect(commentIdx).toBeGreaterThanOrEqual(0)
      expect(normalIdx).toBeGreaterThan(commentIdx)

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.6  Section ordering (canonical order)
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.6 canonical section ordering', () => {
    it('emits all sections in SECTION_ORDER and each appears exactly once', async () => {
      // Callable graph → callable-functions section
      const callableGraph = createCallableGraph('callable-graph', 'Helper')

      // Startup graph → startup-execution block
      const startupGraph = createMinimalStartupGraph('startup-graph', 'Main')

      // Plugins for LSP section
      const plugins: InstalledPlugin[] = [
        createInstalledPlugin('nvim-lspconfig'),
      ]
      const schemas: PluginSchema[] = [
        createMinimalSchema(
          'nvim-lspconfig',
          'nvim-lspconfig',
          'https://github.com/neovim/nvim-lspconfig',
          [
            {
              kind: 'lsp-server-enabler',
              api: 'vim.lsp.enable',
              minNvimVersion: '0.11',
            },
          ],
        ),
      ]

      const km: ProjectKeymap = {
        id: 'km-ord',
        modes: ['n'],
        keySequence: '<leader>x',
        action: {
          actionType: 'run-action',
          config: {
            mode: 'custom-command',
            actionType: 'command',
            action: 'echo hi',
            selectedActionKey: '',
            paramValues: {},
          },
        },
        description: '',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      }

      await setupMocksWithFixture({
        graphs: [callableGraph, startupGraph],
        plugins,
        schemas,
        options: {
          version: 1,
          options: {
            number: { valueType: 'boolean', value: true },
          },
          leaderKey: ' ',
          highlightOverrides: [
            createHighlightOverride('hl-1', 'Normal', { background: 'NONE' }),
          ],
          updatedAt: Date.now(),
        },
        lsp: { enabledServers: ['lua_ls'] },
        colorscheme: {
          // tokyonight-storm is in the catalog (verified from catalog.json)
          activeScheme: 'tokyonight-storm',
          variantPreferences: {},
        },
        keymaps: [km],
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Each of the 9 expected markers must appear exactly once
      const expectedMarkers = [
        '-- Section: leader-key',
        '-- Section: neovim-options',
        '-- Section: callable-functions',
        '-- Section: plugins',
        '-- Section: lsp',
        '-- Section: colorscheme',
        '-- Section: highlights',
        '-- Section: project-keymaps',
        '-- Startup Execution',
      ]

      for (const marker of expectedMarkers) {
        expectContainsOnce(lua, marker)
      }

      // All markers must appear in canonical order
      expectMarkersInOrder(lua, expectedMarkers)

      // Spot-check representative content in each section
      expect(lua).toContain('vim.g.mapleader') // leader-key
      expect(lua).toContain('vim.opt.number') // neovim-options
      expect(lua).toContain('_vinela_callables') // callable-functions
      expect(lua).toContain('if vim.fn.has("nvim-0.11")') // lsp
      expect(lua).toContain('vim.cmd.colorscheme') // colorscheme
      expect(lua).toContain('set_hl_merged(') // highlights
      expect(lua).toContain('vim.keymap.set(') // project-keymaps

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9.7  Empty sections omitted
  // ─────────────────────────────────────────────────────────────────────────

  describe('9.7 empty sections omitted', () => {
    it('omits section headers for all unpopulated sections', async () => {
      const graph = createMinimalStartupGraph()

      await setupMocksWithFixture({
        graphs: [graph],
        options: {
          version: 1,
          options: {}, // no options → neovim-options section empty
          leaderKey: ' ', // leader key set → leader-key section present
          // no highlightOverrides → highlights section empty
          updatedAt: Date.now(),
        },
        // no plugins/schemas → plugins section empty
        plugins: [],
        schemas: [],
        lsp: { enabledServers: [] }, // no servers → lsp section empty
        colorscheme: {
          activeScheme: null, // no scheme → colorscheme section empty
          variantPreferences: {},
        },
        // no keymaps → project-keymaps section empty
        keymaps: [],
      })

      const result = await generateInitLuaOrchestrator(
        '/test/project',
        createMockOptions(),
      )

      expect(result.success).toBe(true)
      const lua = result.initLua ?? ''

      // Present: leader-key (leaderKey is set) and startup-execution (graph has actions)
      expectSectionPresent(lua, 'leader-key')
      expect(lua).toContain('-- Startup Execution')

      // Absent: all unpopulated sections must not have headers
      expectSectionAbsent(lua, 'neovim-options')
      expectSectionAbsent(lua, 'callable-functions')
      expectSectionAbsent(lua, 'plugins')
      expectSectionAbsent(lua, 'lsp')
      expectSectionAbsent(lua, 'colorscheme')
      expectSectionAbsent(lua, 'highlights')
      expectSectionAbsent(lua, 'project-keymaps')

      await assertLuaSyntaxValid(lua)
      assertBlocksBalanced(lua)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13.7 Graph disable state — transitive dependency cascade
  // ─────────────────────────────────────────────────────────────────────────

  it('13.7 disabled graph B and transitively-blocked graph C are excluded; graph A still generates', async () => {
    const graphC = new GraphBuilder('Helper C', 'graph-c')
      .callableEntry('entry', [createCallablePort('input', 'Input', 'string')])
      .action('act', 'run-action', {
        ...createDefaultActionConfig('run-action'),
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo c',
        selectedActionKey: '',
        paramValues: {},
      })
      .returnNode('ret', [])
      .connectExec('entry', 'act')
      .connectExec('act', 'ret')
      .withOrder(2)
      .build()

    const graphB = new GraphBuilder('Helper B', 'graph-b')
      .callableEntry('entry', [createCallablePort('x', 'X', 'number')])
      .action('setOpt', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .graphRef('refC', 'graph-c')
      .returnNode('ret', [])
      .connectExec('entry', 'setOpt')
      .connectExec('setOpt', 'refC')
      .connectExec('refC', 'ret')
      .withEnabled(false)
      .withOrder(1)
      .build()

    // Graph A is a plain startup graph — no ref to graph-b to avoid
    // the graph-ref-target-not-callable error diagnostic that would cause
    // success: false. The test validates that B/C code is absent, and that
    // graph A itself generates its own startup content normally.
    const graphA = new GraphBuilder('Main', 'graph-a')
      .startupTrigger('entry')
      .action('setNum', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'setNum')
      .withOrder(0)
      .build()

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

    const disableStates = new Map<string, GraphDisableState>([
      [
        'graph-a',
        {
          graphId: 'graph-a',
          userEnabled: true,
          effective: { kind: 'enabled' },
        },
      ],
      [
        'graph-b',
        {
          graphId: 'graph-b',
          userEnabled: false,
          effective: { kind: 'user-disabled' },
        },
      ],
      [
        'graph-c',
        {
          graphId: 'graph-c',
          userEnabled: true,
          effective: {
            kind: 'dependency-disabled',
            blockedByRootId: 'graph-b',
            blockedByRootName: 'Helper B',
          },
        },
      ],
    ])

    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([
      graphA,
      graphB,
      graphC,
    ])
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
      statesByGraphId: disableStates,
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    // Without any GraphRef to graph-b, graph A generates cleanly (success: true)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Graph B is disabled: its option must not appear
    expect(lua).not.toContain('vim.opt.wrap = false')

    // Graph C is transitively disabled: its action must not appear
    expect(lua).not.toContain('echo c')

    // Disabled callables must not be registered
    expect(lua).not.toContain(expectedCallableRef('graph-b', 'graph-b'))
    expect(lua).not.toContain(expectedCallableRef('graph-c', 'graph-c'))

    // Graph A itself is effectively enabled and must produce a startup section
    expect(lua).toContain('-- Startup Execution')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13.8 Complex keymap — multi-mode + expr + description
  // ─────────────────────────────────────────────────────────────────────────

  it('13.8 multi-mode+expr keymap generates { "n", "v", "s" } table and expr = true in opts', async () => {
    const smartTab: ProjectKeymap = {
      id: 'km-smart-tab',
      modes: ['n', 'v', 's'],
      keySequence: '<Tab>',
      action: {
        actionType: 'code-block',
        code: 'if vim.fn.pumvisible() == 1 then return "<C-n>" else return "<Tab>" end',
      },
      description: 'Smart tab completion',
      silent: true,
      noremap: true,
      expr: true,
      enabled: true,
    }

    await setupMocksWithFixture({
      graphs: [],
      keymaps: [smartTab],
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Multi-mode Lua table form
    expect(lua).toContain('{ "n", "v", "s" }')

    // Key sequence
    expect(lua).toContain('"<Tab>"')

    // opts
    expect(lua).toContain('expr = true')
    expect(lua).toContain('desc = "Smart tab completion"')
    expect(lua).toContain('silent = true')

    // noremap=true means no remap in output
    expect(lua).not.toContain('remap = true')

    // function() wrapper for code-block
    expect(lua).toContain('function()')
    expect(lua).toContain('vim.fn.pumvisible')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13.9 Complex keymap — run-custom-action (callable graph reference)
  // ─────────────────────────────────────────────────────────────────────────

  it('13.9 run-custom-action keymap emits callable lookup function call', async () => {
    const callableGraph = createCallableGraph(
      'my-refactor-graph',
      'Refactor Helper',
    )

    const customAction: ProjectKeymap = {
      id: 'km-custom',
      modes: ['n'],
      keySequence: '<leader>r',
      action: {
        actionType: 'run-custom-action',
        graphId: 'my-refactor-graph',
        graphName: 'Refactor Helper',
      },
      description: 'Run refactor',
      silent: true,
      noremap: true,
      expr: false,
      enabled: true,
    }

    await setupMocksWithFixture({
      graphs: [callableGraph],
      keymaps: [customAction],
    })

    const result = await generateInitLuaOrchestrator(
      '/test/project',
      createMockOptions(),
    )

    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    expect(lua).toContainCallableInvocation(
      'Refactor Helper',
      'my-refactor-graph',
    )

    // function() wrapper
    expect(lua).toContain('function()')

    // Description
    expect(lua).toContain('desc = "Run refactor"')

    // expr is false → must NOT appear in opts
    expect(lua).not.toContain('expr = true')
    expect(lua).not.toContain('expr = false')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })
})
