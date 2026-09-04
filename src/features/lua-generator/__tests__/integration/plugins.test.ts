/**
 * Category 8: Plugin Integration Tests
 *
 * Tests the full orchestrator pipeline for plugin-focused scenarios:
 * - Single plugin with schema (vim.pack.add + require().setup)
 * - Plugin with schema but no setup metadata (vim.pack.add only)
 * - Multiple plugins (three plugins, all enabled)
 * - Disabled plugin (not present in output)
 * - Co-installed linked plugins (dependency field present; alphabetical ordering)
 * - Colorscheme plugin (pcall(vim.cmd.colorscheme, ...) + no setup)
 *
 * Uses storage mocks via vi.mock() to keep tests fast and deterministic.
 * Validates Lua syntax via luac when available.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import snacksSchemaJson from '@/schemas/snacks-nvim.json'
import treesitterSchemaJson from '@/schemas/treesitter.json'
import type { PluginSchema, ResolvedSchema } from '@/shared/types'
import { generateInitLuaOrchestrator } from '../../orchestrator/phase-coordinator'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
  ensureLuaParserAvailable,
} from './helpers/lua-assertions'

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

// ============================================
// Schema Factory
// ============================================

/**
 * Build a minimal PluginSchema for test fixtures.
 * Fills required fields with safe defaults so callers only specify what matters.
 */
function makeSchema(params: {
  id: string
  pluginName: string
  pluginRepo: string
  setup?: { requirePath: string; setupFunction?: string }
  dependencies?: string[]
  options?: PluginSchema['options']
}): PluginSchema {
  return {
    id: params.id,
    pluginName: params.pluginName,
    pluginRepo: params.pluginRepo,
    version: '1.0.0',
    options: params.options ?? [],
    functions: [],
    ...(params.setup !== undefined && { setup: params.setup }),
    ...(params.dependencies !== undefined && {
      dependencies: params.dependencies,
    }),
  }
}

/**
 * Wrap a PluginSchema array into the ResolvedSchema shape that loadAllSchemas returns.
 */
function makeResolvedSchemas(schemas: PluginSchema[]): ResolvedSchema[] {
  return schemas.map((schema) => ({ schema, source: 'project' as const }))
}

// ============================================
// Installed-plugin fixture shape
// ============================================

interface InstalledPluginFixture {
  schemaId: string
  enabled: boolean
  config: Record<string, import('@/shared/types').PluginConfigValue>
}

function makeInstalledPlugin(params: {
  schemaId: string
  enabled?: boolean
  config?: Record<string, import('@/shared/types').PluginConfigValue>
}): InstalledPluginFixture {
  return {
    schemaId: params.schemaId,
    enabled: params.enabled ?? true,
    config: params.config ?? {},
  }
}

// ============================================
// Fixture Setup Helper
// ============================================

interface PluginIntegrationFixture {
  installedPlugins?: InstalledPluginFixture[]
  schemas?: PluginSchema[]
  activeScheme?: string | null
}

/**
 * Apply storage mocks for a plugin-focused integration test.
 * Non-plugin sources are given safe empty defaults.
 */
async function setupPluginFixture(
  fixture: PluginIntegrationFixture,
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

  // No graphs in plugin-only tests
  ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([])

  // Installed plugins
  const plugins = fixture.installedPlugins ?? []
  ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
    status: plugins.length > 0 ? 'loaded' : 'file-not-found',
    plugins: plugins.map((p) => ({
      schemaId: p.schemaId,
      enabled: p.enabled,
      config: p.config,
      addedAt: 1, // fixed for determinism
    })),
  })

  // Schemas as ResolvedSchema[]
  const resolvedSchemas = makeResolvedSchemas(fixture.schemas ?? [])
  ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue(
    resolvedSchemas,
  )

  // Empty / null optional sources
  ;(readNeovimOptions as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(loadKeymaps as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(loadProjectLspConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
    enabledServers: [],
  })

  // Colorscheme preferences
  const activeScheme = fixture.activeScheme ?? null
  ;(loadColorSchemePreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: { activeScheme, variantPreferences: {} },
    source: activeScheme !== null ? 'file' : 'default',
  })

  // No graphs → empty disable state map
  ;(computeDisableStates as ReturnType<typeof vi.fn>).mockReturnValue({
    statesByGraphId: new Map(),
  })
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that the pack-add block contains a specific repository URL.
 */
function expectPackAddContains(lua: string, repo: string): void {
  const fullUrl = repo.startsWith('https://')
    ? repo
    : `https://github.com/${repo}`
  expect(lua, `Expected vim.pack.add to contain repo: ${fullUrl}`).toContain(
    `src = "${fullUrl}"`,
  )
}

/**
 * Assert that a require().setup() call is present for the given require path.
 */
function expectSetupCallPresent(lua: string, requirePath: string): void {
  expect(
    lua,
    `Expected require("${requirePath}").setup( to be present`,
  ).toContain(`require("${requirePath}").setup(`)
}

/**
 * Assert that a require().setup() call is absent for the given require path.
 */
function expectSetupCallAbsent(lua: string, requirePath: string): void {
  expect(
    lua,
    `Expected require("${requirePath}").setup( to be absent`,
  ).not.toContain(`require("${requirePath}").setup(`)
}

/**
 * Assert there are no error-level diagnostics.
 * Warnings from optional sources (e.g., projectMeta) are allowed.
 */
function assertNoErrorDiagnostics(
  result: Awaited<ReturnType<typeof generateInitLuaOrchestrator>>,
): void {
  const errors = result.diagnostics.filter((d) => d.severity === 'error')
  expect(
    errors,
    `Expected no error diagnostics but found: ${JSON.stringify(errors, null, 2)}`,
  ).toHaveLength(0)
}

// ============================================
// beforeAll / beforeEach
// ============================================

// Probe Neovim-compatible syntax tooling once before plugin integration tests.
beforeAll(async () => {
  await ensureLuaParserAvailable()
})

describe('Category 8: Plugin Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8.1 Single plugin with schema
  // ─────────────────────────────────────────────────────────────────────────

  it('8.1 single plugin with schema emits vim.pack.add and treesitter core highlighting', async () => {
    const schema = treesitterSchemaJson as PluginSchema

    await setupPluginFixture({
      installedPlugins: [makeInstalledPlugin({ schemaId: 'nvim-treesitter' })],
      schemas: [schema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    expect(lua).toContain('vim.pack.add({')
    expectPackAddContains(
      lua,
      'https://github.com/nvim-treesitter/nvim-treesitter',
    )
    expect(lua).toContain('version = "main"')
    expect(lua).toContain("nvim_create_autocmd('FileType'")
    expect(lua).toContain('vim.treesitter.language.get_lang')
    expect(lua).toContain('pcall(vim.treesitter.start, args.buf, lang)')
    expect(lua).not.toContain('require("nvim-treesitter")')
    expect(lua).not.toContain("treesitter.get_installed('parsers')")
    expect(lua).not.toContain('treesitter.setup()')
    expect(lua).not.toContain('treesitter.install(')
    expect(lua).not.toContain('treesitter.update(')
    expectSetupCallAbsent(lua, 'nvim-treesitter.configs')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8.2 Plugin with schema but no setup metadata
  // ─────────────────────────────────────────────────────────────────────────

  it('8.2 plugin with schema but no setup field emits vim.pack.add only', async () => {
    const schema = makeSchema({
      id: 'plain-plugin',
      pluginName: 'Plain Plugin',
      pluginRepo: 'https://github.com/owner/plain-plugin',
      // no setup field
    })

    await setupPluginFixture({
      installedPlugins: [makeInstalledPlugin({ schemaId: 'plain-plugin' })],
      schemas: [schema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Repo entry present in pack block
    expectPackAddContains(lua, 'https://github.com/owner/plain-plugin')

    // No setup call
    expectSetupCallAbsent(lua, 'plain-plugin')

    // "no setup required" comment emitted
    expect(lua).toContain('-- Plain Plugin: no setup required')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8.3 Multiple plugins
  // ─────────────────────────────────────────────────────────────────────────

  it('8.3 multiple enabled plugins all appear in a single vim.pack.add block', async () => {
    const schemas = [
      makeSchema({
        id: 'mason-nvim',
        pluginName: 'mason.nvim',
        pluginRepo: 'https://github.com/williamboman/mason.nvim',
        setup: { requirePath: 'mason' },
      }),
      makeSchema({
        id: 'telescope-nvim',
        pluginName: 'telescope.nvim',
        pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
        setup: { requirePath: 'telescope' },
      }),
      makeSchema({
        id: 'nvim-cmp',
        pluginName: 'nvim-cmp',
        pluginRepo: 'https://github.com/hrsh7th/nvim-cmp',
        setup: { requirePath: 'cmp' },
      }),
    ]

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({ schemaId: 'mason-nvim' }),
        makeInstalledPlugin({ schemaId: 'telescope-nvim' }),
        makeInstalledPlugin({ schemaId: 'nvim-cmp' }),
      ],
      schemas,
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Only one vim.pack.add block
    const packAddOccurrences = (lua.match(/vim\.pack\.add\(\{/g) ?? []).length
    expect(
      packAddOccurrences,
      'Expected exactly one vim.pack.add({ block',
    ).toBe(1)

    // All three repos present in the single block
    expectPackAddContains(lua, 'https://github.com/williamboman/mason.nvim')
    expectPackAddContains(
      lua,
      'https://github.com/nvim-telescope/telescope.nvim',
    )
    expectPackAddContains(lua, 'https://github.com/hrsh7th/nvim-cmp')

    // Setup calls for all three
    expectSetupCallPresent(lua, 'mason')
    expectSetupCallPresent(lua, 'telescope')
    expectSetupCallPresent(lua, 'cmp')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8.4 Disabled plugin
  // ─────────────────────────────────────────────────────────────────────────

  it('8.4 disabled plugin is absent from vim.pack.add and has no setup call', async () => {
    const schemas = [
      makeSchema({
        id: 'enabled-plugin',
        pluginName: 'Enabled Plugin',
        pluginRepo: 'https://github.com/owner/enabled-plugin',
        setup: { requirePath: 'enabled_plugin' },
      }),
      makeSchema({
        id: 'disabled-plugin',
        pluginName: 'Disabled Plugin',
        pluginRepo: 'https://github.com/owner/disabled-plugin',
        setup: { requirePath: 'disabled_plugin' },
      }),
    ]

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({ schemaId: 'enabled-plugin', enabled: true }),
        makeInstalledPlugin({ schemaId: 'disabled-plugin', enabled: false }),
      ],
      schemas,
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Enabled plugin present
    expectPackAddContains(lua, 'https://github.com/owner/enabled-plugin')
    expectSetupCallPresent(lua, 'enabled_plugin')

    // Disabled plugin absent
    expect(lua).not.toContain('https://github.com/owner/disabled-plugin')
    expectSetupCallAbsent(lua, 'disabled_plugin')

    // metadata: only the enabled plugin counted
    expect(result.metadata.pluginsConfigured).toBe(1)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8.5 Co-installed linked plugins (dependency field present)
  // ─────────────────────────────────────────────────────────────────────────

  it('8.5 co-installed dependency-linked plugins both appear; ordering is alphabetical by pluginName', async () => {
    // plenary.nvim is a dependency of telescope.nvim
    const plenarySchema = makeSchema({
      id: 'plenary-nvim',
      pluginName: 'plenary.nvim',
      pluginRepo: 'https://github.com/nvim-lua/plenary.nvim',
      setup: { requirePath: 'plenary' },
    })

    const telescopeSchema = makeSchema({
      id: 'telescope-nvim',
      pluginName: 'telescope.nvim',
      pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
      setup: { requirePath: 'telescope' },
      dependencies: ['plenary-nvim'],
    })

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({ schemaId: 'plenary-nvim' }),
        makeInstalledPlugin({ schemaId: 'telescope-nvim' }),
      ],
      schemas: [plenarySchema, telescopeSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Both repos present in pack block
    expectPackAddContains(lua, 'https://github.com/nvim-lua/plenary.nvim')
    expectPackAddContains(
      lua,
      'https://github.com/nvim-telescope/telescope.nvim',
    )

    // Both setup calls emitted
    expectSetupCallPresent(lua, 'plenary')
    expectSetupCallPresent(lua, 'telescope')

    // Alphabetical by pluginName: "plenary.nvim" < "telescope.nvim"
    const plenaryRepoIdx = lua.indexOf(
      'src = "https://github.com/nvim-lua/plenary.nvim"',
    )
    const telescopeRepoIdx = lua.indexOf(
      'src = "https://github.com/nvim-telescope/telescope.nvim"',
    )
    expect(
      plenaryRepoIdx,
      'plenary.nvim should appear before telescope.nvim (alphabetical by pluginName)',
    ).toBeLessThan(telescopeRepoIdx)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8.6 Colorscheme plugin
  // ─────────────────────────────────────────────────────────────────────────

  it('8.6 colorscheme plugin appears in vim.pack.add, has no setup call, and colorscheme section uses pcall', async () => {
    // tokyonight-storm is a real entry in the catalog (vimColorscheme: "tokyonight-storm")
    // Schema ID must start with "theme--" to trigger the themePluginIds filter.
    // Using setup metadata intentionally to prove the filter suppresses it.
    const themeSchema = makeSchema({
      id: 'theme--tokyonight.nvim',
      pluginName: 'tokyonight.nvim',
      pluginRepo: 'https://github.com/folke/tokyonight.nvim',
      setup: { requirePath: 'tokyonight' }, // intentionally present; must be suppressed
    })

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({ schemaId: 'theme--tokyonight.nvim' }),
      ],
      schemas: [themeSchema],
      activeScheme: 'tokyonight-storm',
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Theme plugin repo present in vim.pack.add
    expectPackAddContains(lua, 'https://github.com/folke/tokyonight.nvim')

    // Setup call MUST be absent even though schema declares setup metadata
    // (the themePluginIds filter suppresses it)
    expectSetupCallAbsent(lua, 'tokyonight')

    // Colorscheme section present with correct pcall pattern
    expect(lua).toContain(
      'local ok, err = pcall(vim.cmd.colorscheme, "tokyonight-storm")',
    )

    // Plugin section appears before colorscheme section
    const pluginSectionIdx = lua.indexOf('vim.pack.add({')
    const colorschemeSectionIdx = lua.indexOf(
      'pcall(vim.cmd.colorscheme, "tokyonight-storm")',
    )
    expect(
      pluginSectionIdx,
      'vim.pack.add block should appear before colorscheme pcall',
    ).toBeLessThan(colorschemeSectionIdx)

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13.4 Plugin with deeply nested config (Telescope with pickers)
  // ─────────────────────────────────────────────────────────────────────────

  it('13.4 telescope.nvim with deeply nested config (defaults + pickers) unfolds dot-notation keys', async () => {
    const telescopeSchema = makeSchema({
      id: 'telescope-nvim',
      pluginName: 'telescope.nvim',
      pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
      setup: { requirePath: 'telescope' },
      options: [
        {
          key: 'defaults.layout_strategy',
          type: 'string' as const,
          label: 'Layout Strategy',
        },
        {
          key: 'defaults.layout_config.width',
          type: 'number' as const,
          label: 'Width',
        },
        {
          key: 'defaults.layout_config.height',
          type: 'number' as const,
          label: 'Height',
        },
        {
          key: 'defaults.prompt_prefix',
          type: 'string' as const,
          label: 'Prompt Prefix',
          default: '> ',
        },
        {
          key: 'pickers.find_files.theme',
          type: 'string' as const,
          label: 'Find Files Theme',
        },
        {
          key: 'pickers.live_grep.additional_args',
          type: 'array' as const,
          label: 'Live Grep Args',
          items: { itemType: 'string' as const },
        },
      ],
    })

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'telescope-nvim',
          config: {
            'defaults.layout_strategy': 'horizontal',
            'defaults.layout_config.width': 0.8,
            'defaults.layout_config.height': 0.9,
            'pickers.find_files.theme': 'dropdown',
            'pickers.live_grep.additional_args': [
              '--hidden',
              '--glob',
              '!.git',
            ],
          },
        }),
      ],
      schemas: [telescopeSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Setup call present
    expectSetupCallPresent(lua, 'telescope')

    // Nested keys unflattened (not emitted as literal "defaults.layout_strategy")
    expect(lua).not.toContain('"defaults.layout_strategy"')
    expect(lua).toContain('layout_strategy = "horizontal"')

    // 3-level deep: defaults.layout_config.{width,height}
    expect(lua).toContain('width = 0.8')
    expect(lua).toContain('height = 0.9')

    // Schema default applied even though not in user config
    expect(lua).toContain('prompt_prefix = "> "')

    // Pickers nested config
    expect(lua).toContain('theme = "dropdown"')

    // Array value in nested config
    expect(lua).toContain('"--hidden"')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13.5 Empty plugin config — schema defaults only
  // ─────────────────────────────────────────────────────────────────────────

  it('13.5 empty plugin config uses schema defaults (not empty setup call)', async () => {
    const autopairsSchema = makeSchema({
      id: 'nvim-autopairs',
      pluginName: 'nvim-autopairs',
      pluginRepo: 'https://github.com/windwp/nvim-autopairs',
      setup: { requirePath: 'nvim-autopairs' },
      options: [
        {
          key: 'check_ts',
          type: 'boolean' as const,
          label: 'Check Treesitter',
          default: false,
        },
        {
          key: 'disable_filetype',
          type: 'array' as const,
          label: 'Disabled Filetypes',
          items: { itemType: 'string' as const },
          default: ['TelescopePrompt'],
        },
      ],
    })

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'nvim-autopairs',
          config: {}, // user changed nothing
        }),
      ],
      schemas: [autopairsSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    expectSetupCallPresent(lua, 'nvim-autopairs')

    // Schema default: boolean false must appear explicitly
    expect(lua).toContain('check_ts = false')

    // Schema default: array default applied
    expect(lua).toContain('"TelescopePrompt"')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13.6 Schema source precedence — project schema overrides builtin
  // ─────────────────────────────────────────────────────────────────────────

  it('13.6 project-local schema overrides builtin schema with same ID (last-write-wins via Map)', async () => {
    // Builtin schema: setup requires the current root public module, no preSetup, no options
    const builtinSchema: PluginSchema = {
      id: 'nvim-treesitter',
      pluginName: 'nvim-treesitter',
      pluginRepo: 'https://github.com/nvim-treesitter/nvim-treesitter',
      version: '1.0.0',
      options: [],
      functions: [],
      setup: { requirePath: 'nvim-treesitter' },
    }

    // Project-local schema: same ID, adds an option and a preSetup comment
    const projectSchema: PluginSchema = {
      id: 'nvim-treesitter', // same ID → overrides builtinSchema
      pluginName: 'nvim-treesitter',
      pluginRepo: 'https://github.com/nvim-treesitter/nvim-treesitter',
      version: '2.0.0',
      options: [
        {
          key: 'auto_install',
          type: 'boolean' as const,
          label: 'Auto Install',
          default: true,
        },
      ],
      functions: [],
      setup: {
        requirePath: 'nvim-treesitter.configs',
        preSetup: '-- Custom treesitter pre-setup',
      },
    }

    // Precedence contract: builtin first, project second → project wins (last-write-wins in Map)
    const resolvedSchemas: ResolvedSchema[] = [
      { schema: builtinSchema, source: 'builtin' },
      { schema: projectSchema, source: 'project' },
    ]

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

    ;(listGraphs as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(loadInstalledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'loaded',
      plugins: [
        { schemaId: 'nvim-treesitter', enabled: true, config: {}, addedAt: 1 },
      ],
    })
    ;(loadAllSchemas as ReturnType<typeof vi.fn>).mockResolvedValue(
      resolvedSchemas,
    )
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

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    // Exactly ONE setup call from the project override (no duplicate from builtinSchema)
    const setupCount = (
      lua.match(/require\("nvim-treesitter\.configs"\)\.setup\(/g) ?? []
    ).length
    expect(
      setupCount,
      'Expected exactly one nvim-treesitter.configs setup call (project schema wins)',
    ).toBe(1)

    // Project schema option present
    expect(lua).toContain('auto_install = true')

    // Project schema preSetup comment present
    expect(lua).toContain('-- Custom treesitter pre-setup')
    expectSetupCallAbsent(lua, 'nvim-treesitter')

    assertBlocksBalanced(lua)
    await assertLuaSyntaxValid(lua)
  })

  it('13.7 emits nested typed picker.sources config for aliased schema', async () => {
    const schema = makeSchema({
      id: 'snacks-nvim',
      pluginName: 'snacks.nvim',
      pluginRepo: 'folke/snacks.nvim',
      setup: { requirePath: 'snacks' },
      options: [
        {
          key: 'picker.enabled',
          label: 'Enable Picker',
          type: 'boolean',
          default: false,
        },
        {
          key: 'picker.sourcesRaw',
          emitKey: 'picker.sources',
          label: 'Raw',
          type: 'lua',
          default: '{}',
        },
        {
          key: 'picker.sources.files.hidden',
          label: 'Files Hidden',
          type: 'boolean',
          default: false,
        },
        {
          key: 'picker.sources.files.formatters.file.truncate',
          label: 'Files Truncate',
          type: 'select',
          options: [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
          ],
        },
        {
          key: 'picker.sources.files.layout.preset',
          label: 'Files Layout Preset',
          type: 'select',
          options: [
            { value: 'ivy', label: 'Ivy' },
            { value: 'dropdown', label: 'Dropdown' },
          ],
        },
        {
          key: 'picker.sources.grep.hidden',
          label: 'Grep Hidden',
          type: 'boolean',
          default: false,
        },
        {
          key: 'picker.sources.explorer.tree',
          label: 'Explorer Tree',
          type: 'boolean',
          default: true,
        },
        {
          key: 'picker.sources.buffers.modified',
          label: 'Buffers Modified',
          type: 'boolean',
          default: false,
        },
        {
          key: 'picker.sources.files.exclude',
          label: 'Files Exclude',
          type: 'array',
          items: { itemType: 'string' },
        },
      ],
    })

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'snacks-nvim',
          config: {
            'picker.enabled': true,
            'picker.sources.files.hidden': true,
            'picker.sources.files.formatters.file.truncate': 'center',
            'picker.sources.files.layout.preset': 'ivy',
            'picker.sources.grep.hidden': true,
            'picker.sources.explorer.tree': false,
            'picker.sources.buffers.modified': true,
          },
        }),
      ],
      schemas: [schema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    expect(result.success).toBe(true)
    const lua = result.initLua ?? ''

    expect(lua).toContain('sources = {')
    expect(lua).toContain('files = {')
    expect(lua).toContain('hidden = true')
    expect(lua).toContain('formatters = {')
    expect(lua).toContain('file = { truncate = "center" }')
    expect(lua).toContain('layout = { preset = "ivy" }')
    expect(lua).toContain('grep = { hidden = true }')
    expect(lua).toContain('explorer = { tree = false }')
    expect(lua).toContain('buffers = { modified = true }')
    expect(lua).not.toContain('exclude = {}')
    expect(lua).not.toContain('sourcesRaw')
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('Prefer source-local truncate settings.'),
      ),
    ).toBe(false)
  })

  it('13.8 omits global Snacks truncate by default', async () => {
    const snacksSchema = snacksSchemaJson as PluginSchema

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: snacksSchema.id,
          config: {
            'picker.enabled': true,
          },
        }),
      ],
      schemas: [snacksSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    const lua = result.initLua ?? ''
    expect(lua).not.toContain('truncate = "center"')
  })

  it('13.9 warns when global Snacks truncate is explicitly set', async () => {
    const snacksSchema = snacksSchemaJson as PluginSchema

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: snacksSchema.id,
          config: {
            'picker.enabled': true,
            'picker.formatters.file.truncate': 'center',
          },
        }),
      ],
      schemas: [snacksSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })

    assertNoErrorDiagnostics(result)
    const lua = result.initLua ?? ''
    expect(lua).toContain('truncate = "center"')
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === 'warning' &&
          diagnostic.message.includes(
            'Global picker filename truncation applies to all picker sources',
          ),
      ),
    ).toBe(true)
  })

  it('13.10 formatter-nvim wildcard emits formatter.filetypes.any', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema
    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: {
            presets: [{ filetype: '*', preset: 'remove_trailing_whitespace' }],
          },
        }),
      ],
      schemas: [formatterSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const lua = result.initLua ?? ''
    expect(lua).toContain('any = {')
    expect(lua).toContain(
      'require("formatter.filetypes.any").remove_trailing_whitespace',
    )
    expect(lua).not.toContain('formatter.filetypes.*')
  })

  it('13.11 formatter-nvim raw filetype overrides rows with warning', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema
    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: {
            presets: [{ filetype: 'lua', preset: 'stylua' }],
            filetype: '{ lua = { require("formatter.filetypes.lua").stylua } }',
          },
        }),
      ],
      schemas: [formatterSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const warning = result.diagnostics.find((d) =>
      d.message.includes('overrides'),
    )
    expect(warning?.severity).toBe('warning')
  })

  it('13.12 formatter-nvim schema overrides can rename mapping-table keys without core branches', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema
    const override = JSON.parse(JSON.stringify(formatterSchema)) as PluginSchema
    const presetsOption = override.options.find(
      (option) => option.key === 'presets',
    )
    override.options = override.options.filter(
      (option) => option.key !== 'presets',
    )
    if (presetsOption) {
      override.options.push({ ...presetsOption, key: 'formatters' })
    }

    const otherSchema = makeSchema({
      id: 'nvim-treesitter',
      pluginName: 'nvim-treesitter',
      pluginRepo: 'https://github.com/nvim-treesitter/nvim-treesitter',
      setup: { requirePath: 'nvim-treesitter' },
    })

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: {
            formatters: [{ filetype: 'lua', preset: 'stylua' }],
          },
        }),
        makeInstalledPlugin({ schemaId: 'nvim-treesitter' }),
      ],
      schemas: [override, otherSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const lua = result.initLua ?? ''
    expect(lua).toContain('require("formatter.filetypes.lua").stylua')
    expect(lua).toContain('require("formatter").setup(')
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(false)
  })

  it('13.11 formatter-nvim warns on competing formatters while still emitting both', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: {
            presets: [
              { filetype: 'typescript', preset: 'prettierd' },
              { filetype: 'typescript', preset: 'biome' },
            ],
          },
        }),
      ],
      schemas: [formatterSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const lua = result.initLua ?? ''

    const warning = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.severity === 'warning' &&
        diagnostic.message.includes('multiple competing formatter presets'),
    )

    expect(warning).toBeDefined()
    expect(lua).toContain('require("formatter.filetypes.typescript").prettierd')
    expect(lua).toContain('require("formatter.filetypes.typescript").biome')
    expect(
      result.diagnostics.find((d) => d.severity === 'error'),
    ).toBeUndefined()
  })

  it('13.12 formatter-nvim keeps valid rows when malformed rows are present', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: {
            presets: [
              { filetype: 'typescript', preset: 'prettierd' },
              { filetype: 'rust', preset: 'rustfmt' },
              { filetype: 'lua' },
              'lol-not-a-row',
            ],
          },
        }),
      ],
      schemas: [formatterSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const lua = result.initLua ?? ''

    expect(lua).toContain('require("formatter.filetypes.typescript").prettierd')
    expect(lua).toContain('require("formatter.filetypes.rust").rustfmt')
    expect(lua).not.toContain('formatter.filetypes.lua')
    expect(
      result.diagnostics.find((d) => d.severity === 'error'),
    ).toBeUndefined()
  })

  it('13.13 formatter-nvim emits no filetype map when all provided rows are sanitized out', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: { presets: [{ filetype: 'lua' }, { preset: 'stylua' }] },
        }),
      ],
      schemas: [formatterSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const lua = result.initLua ?? ''

    expect(lua).not.toContain('require("formatter.filetypes.')
    expect(lua).not.toContain('filetype = {')
    expect(
      result.diagnostics.find((d) => d.severity === 'error'),
    ).toBeUndefined()
  })

  it('13.13b formatter-nvim emits no filetype map when non-string-only input is sanitized out', async () => {
    const formatterSchema = (await import('@/schemas/formatter-nvim.json'))
      .default as PluginSchema

    await setupPluginFixture({
      installedPlugins: [
        makeInstalledPlugin({
          schemaId: 'formatter-nvim',
          config: { presets: [42, true] },
        }),
      ],
      schemas: [formatterSchema],
    })

    const result = await generateInitLuaOrchestrator('/test/project', {
      targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
      projectPath: '/test/project',
    })
    const lua = result.initLua ?? ''

    expect(lua).not.toContain('require("formatter.filetypes.')
    expect(lua).not.toContain('filetype = {')
    expect(
      result.diagnostics.find((d) => d.severity === 'error'),
    ).toBeUndefined()
  })
})
