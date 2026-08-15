import { describe, expect, it } from 'vitest'
import type { PluginSchema, ResolvedSchema } from '@/shared/types'
import {
  buildFunctionCatalog,
  deriveLabelFromFunctionName,
  findFunctionByKey,
  getFunctionCategoryCounts,
  getFunctionsByCategory,
  getPopularFunctions,
  searchFunctions,
} from './function-catalog-builder'
import { API_FUNCTION_CATALOG } from './neovim/api-functions'
import { DIAGNOSTIC_FUNCTION_CATALOG } from './neovim/diagnostic-functions'
import { CORE_FUNCTION_TEMPLATES } from './neovim/function-templates'
import { NEOVIM_FUNCTION_CATALOG } from './neovim/functions'
import { LSP_FUNCTION_CATALOG } from './neovim/lsp-functions'
import { TREESITTER_FUNCTION_CATALOG } from './neovim/treesitter-functions'

// ============================================
// Catalog size constants
// ============================================

const CORE_BASE_COUNT =
  NEOVIM_FUNCTION_CATALOG.length +
  API_FUNCTION_CATALOG.length +
  LSP_FUNCTION_CATALOG.length +
  DIAGNOSTIC_FUNCTION_CATALOG.length +
  TREESITTER_FUNCTION_CATALOG.length

const TEMPLATE_COUNT = CORE_FUNCTION_TEMPLATES.length

const TOTAL_CORE_COUNT = CORE_BASE_COUNT + TEMPLATE_COUNT

// 15 core categories (from CORE_CATEGORY_ORDER)
const CORE_CATEGORY_COUNT = 15

// ============================================
// Test Helpers
// ============================================

function makePluginSchema(overrides: Partial<PluginSchema> = {}): PluginSchema {
  return {
    id: 'test-plugin',
    pluginName: 'Test Plugin',
    pluginRepo: 'https://github.com/test/test-plugin',
    version: '1.0.0',
    options: [],
    functions: [
      {
        name: 'find_files',
        description: 'Find files in the project',
        params: [{ name: 'opts', type: 'table', optional: true }],
        returns: 'void',
        luaCall: "require('test-plugin').find_files($params)",
      },
    ],
    ...overrides,
  }
}

function makeResolvedSchema(schema: PluginSchema): ResolvedSchema {
  return { schema, source: 'builtin' }
}

// ============================================
// Tests
// ============================================

describe('buildFunctionCatalog', () => {
  it('returns all core entries (base + templates) and 15 core categories when no plugins', () => {
    const catalog = buildFunctionCatalog([])
    expect(catalog.entries).toHaveLength(TOTAL_CORE_COUNT)
    expect(catalog.categories).toHaveLength(CORE_CATEGORY_COUNT)
  })

  it('has at least 70 total core entries', () => {
    const catalog = buildFunctionCatalog([])
    expect(catalog.entries.length).toBeGreaterThanOrEqual(70)
  })

  it('all core base entry keys follow core:<name> format', () => {
    const catalog = buildFunctionCatalog([])
    const coreEntries = catalog.entries.filter((e) => e.key.startsWith('core:'))
    expect(coreEntries.length).toBe(CORE_BASE_COUNT)
    for (const entry of coreEntries) {
      expect(entry.key).toMatch(/^core:/)
      expect(entry.isPlugin).toBe(false)
    }
  })

  it('template entries follow template:<key> format', () => {
    const catalog = buildFunctionCatalog([])
    const templateEntries = catalog.entries.filter((e) =>
      e.key.startsWith('template:'),
    )
    expect(templateEntries.length).toBe(TEMPLATE_COUNT)
    for (const entry of templateEntries) {
      expect(entry.isTemplate).toBe(true)
      expect(entry.baseFunctionKey).toBeDefined()
      expect(entry.templateDefaults).toBeDefined()
    }
  })

  it('template entries inherit params, luaCall, returns from base function', () => {
    const catalog = buildFunctionCatalog([])
    const configTemplate = findFunctionByKey(
      catalog,
      'template:get-config-path',
    )
    const stdpathBase = findFunctionByKey(catalog, 'core:stdpath')

    expect(configTemplate).toBeDefined()
    expect(stdpathBase).toBeDefined()
    expect(configTemplate?.luaCall).toBe(stdpathBase?.luaCall)
    expect(configTemplate?.params).toEqual(stdpathBase?.params)
    expect(configTemplate?.returns).toBe(stdpathBase?.returns)
  })

  it('template defaults are pre-filled correctly', () => {
    const catalog = buildFunctionCatalog([])
    const configTemplate = findFunctionByKey(
      catalog,
      'template:get-config-path',
    )
    expect(configTemplate?.templateDefaults?.['what']).toEqual({
      kind: 'scalar',
      value: 'config',
    })
  })

  it('template with lua default has correct shape', () => {
    const catalog = buildFunctionCatalog([])
    const showInfo = findFunctionByKey(catalog, 'template:show-info')
    expect(showInfo?.templateDefaults?.['level']).toEqual({
      kind: 'lua',
      lua: 'vim.log.levels.INFO',
    })
  })

  it('all core category keys follow core:<slug> format', () => {
    const catalog = buildFunctionCatalog([])
    const coreCategories = catalog.categories.filter((c) =>
      c.key.startsWith('core:'),
    )
    expect(coreCategories.length).toBe(CORE_CATEGORY_COUNT)
    for (const cat of coreCategories) {
      expect(cat.key).toMatch(/^core:/)
    }
  })

  it('category ordering matches CORE_CATEGORY_ORDER (lsp first)', () => {
    const catalog = buildFunctionCatalog([])
    const coreCategories = catalog.categories.filter((c) =>
      c.key.startsWith('core:'),
    )
    expect(coreCategories[0]?.key).toBe('core:lsp')
    expect(coreCategories[1]?.key).toBe('core:diagnostic')
  })

  it('plugin entries use plugin:<id>:<name> key format', () => {
    const schema = makePluginSchema()
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const pluginEntries = catalog.entries.filter((e) => e.isPlugin)
    expect(pluginEntries).toHaveLength(1)
    expect(pluginEntries[0]?.key).toBe('plugin:test-plugin:find_files')
  })

  it('plugin categories use plugin:<id>:all key format', () => {
    const schema = makePluginSchema()
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const pluginCats = catalog.categories.filter((c) =>
      c.key.startsWith('plugin:'),
    )
    expect(pluginCats).toHaveLength(1)
    expect(pluginCats[0]?.key).toBe('plugin:test-plugin:all')
  })

  it('plugin entries have isPlugin: true and functionSource.type === plugin', () => {
    const schema = makePluginSchema()
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const pluginEntries = catalog.entries.filter((e) => e.isPlugin)
    for (const entry of pluginEntries) {
      expect(entry.isPlugin).toBe(true)
      expect(entry.functionSource.type).toBe('plugin')
    }
  })

  it('core entries have isPlugin: false and functionSource.type === core', () => {
    const catalog = buildFunctionCatalog([])
    const coreEntries = catalog.entries.filter((e) => !e.isPlugin)
    for (const entry of coreEntries) {
      expect(entry.isPlugin).toBe(false)
      expect(entry.functionSource.type).toBe('core')
    }
  })

  it('plugin with no functions produces no plugin categories or entries', () => {
    const schema = makePluginSchema({ functions: [] })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    expect(catalog.entries).toHaveLength(TOTAL_CORE_COUNT) // only core
    expect(catalog.categories).toHaveLength(CORE_CATEGORY_COUNT) // only core
  })

  it('multiple plugins accumulate entries and categories', () => {
    const schema1 = makePluginSchema({ id: 'plugin-a', pluginName: 'Plugin A' })
    const schema2 = makePluginSchema({ id: 'plugin-b', pluginName: 'Plugin B' })
    const catalog = buildFunctionCatalog([
      makeResolvedSchema(schema1),
      makeResolvedSchema(schema2),
    ])
    expect(catalog.entries).toHaveLength(TOTAL_CORE_COUNT + 2) // core + 2 plugin
    expect(catalog.categories).toHaveLength(CORE_CATEGORY_COUNT + 2) // core + 2 plugin
  })

  it('marks all params optional when minArgs is 0', () => {
    const catalog = buildFunctionCatalog([])
    const getcwd = findFunctionByKey(catalog, 'core:getcwd')

    expect(getcwd).toBeDefined()
    expect(getcwd?.params.map((param) => param.optional)).toEqual([true, true])
  })

  it('keeps required params required when minArgs is greater than 0', () => {
    const catalog = buildFunctionCatalog([])
    const expand = findFunctionByKey(catalog, 'core:expand')

    expect(expand).toBeDefined()
    expect(expand?.params.map((param) => param.optional)).toEqual([
      false,
      true,
      true,
    ])
  })

  it('core entries use friendly labels (not raw function names)', () => {
    const catalog = buildFunctionCatalog([])
    const hasEntry = findFunctionByKey(catalog, 'core:has')
    expect(hasEntry?.label).toBe('Check Feature Support')

    const stdpathEntry = findFunctionByKey(catalog, 'core:stdpath')
    expect(stdpathEntry?.label).toBe('Get Standard Path')
  })

  it('core entries have whatItDoes field', () => {
    const catalog = buildFunctionCatalog([])
    const hasEntry = findFunctionByKey(catalog, 'core:has')
    expect(hasEntry?.whatItDoes).toBeDefined()
    expect(typeof hasEntry?.whatItDoes).toBe('string')
  })

  it('luaCallOverride is respected for non-vim.fn functions', () => {
    const catalog = buildFunctionCatalog([])
    const notifyEntry = findFunctionByKey(catalog, 'core:vim_notify')
    expect(notifyEntry?.luaCall).toBe('vim.notify($params)')
  })

  it('advancedOnly functions are present but marked', () => {
    const catalog = buildFunctionCatalog([])

    // Build expected advanced-only keys from core source arrays
    const coreSources = [
      ...NEOVIM_FUNCTION_CATALOG,
      ...API_FUNCTION_CATALOG,
      ...LSP_FUNCTION_CATALOG,
      ...DIAGNOSTIC_FUNCTION_CATALOG,
      ...TREESITTER_FUNCTION_CATALOG,
    ]
    const expectedAdvancedCoreKeys = coreSources
      .filter((fn) => (fn as { advancedOnly?: boolean }).advancedOnly === true)
      .map((fn) => `core:${fn.name}`)

    // If there are advanced-only functions, assert they are present and marked
    // (The catalog may have zero advanced-only functions - that's valid)
    for (const key of expectedAdvancedCoreKeys) {
      const entry = findFunctionByKey(catalog, key)
      expect(entry).toBeDefined()
      expect(entry?.advancedOnly).toBe(true)
    }
  })

  it('plugin entries use fn.label when provided, auto-derived when not', () => {
    const schema = makePluginSchema({
      functions: [
        {
          name: 'find_files',
          label: 'Find Files',
          description: 'Find files',
          params: [],
          returns: 'void',
          luaCall: "require('test').find_files()",
        },
        {
          name: 'live_grep',
          description: 'Live grep',
          params: [],
          returns: 'void',
          luaCall: "require('test').live_grep()",
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const findFiles = findFunctionByKey(
      catalog,
      'plugin:test-plugin:find_files',
    )
    const liveGrep = findFunctionByKey(catalog, 'plugin:test-plugin:live_grep')

    expect(findFiles?.label).toBe('Find Files') // explicit label
    expect(liveGrep?.label).toBe('Live Grep') // auto-derived
  })

  it('plugin functionTemplates are built with correct keys and defaults', () => {
    const schema = makePluginSchema({
      functions: [
        {
          name: 'find_files',
          description: 'Find files',
          params: [{ name: 'cwd', type: 'string', optional: true }],
          returns: 'void',
          luaCall: "require('test').find_files($params)",
        },
      ],
      functionTemplates: [
        {
          key: 'find-lua-files',
          baseFunctionName: 'find_files',
          label: 'Find Lua Files',
          shortDescription: 'Search for Lua files only',
          defaults: { cwd: { kind: 'scalar', value: '.' } },
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const tmplEntry = findFunctionByKey(
      catalog,
      'plugin:test-plugin:template:find-lua-files',
    )

    expect(tmplEntry).toBeDefined()
    expect(tmplEntry?.isTemplate).toBe(true)
    expect(tmplEntry?.label).toBe('Find Lua Files')
    expect(tmplEntry?.baseFunctionKey).toBe('plugin:test-plugin:find_files')
    expect(tmplEntry?.templateDefaults?.['cwd']).toEqual({
      kind: 'scalar',
      value: '.',
    })
  })
})

describe('searchFunctions', () => {
  it('returns all entries for empty query', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, '')
    expect(results).toHaveLength(catalog.entries.length)
  })

  it('matches on friendly label', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'Check Feature Support')
    expect(results.some((e) => e.key === 'core:has')).toBe(true)
  })

  it('matches on shortDescription', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'wildcards')
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches on signature', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'nosuf')
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches on categoryLabel', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'Paths')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((e) => e.categoryLabel.includes('Paths'))).toBe(true)
  })

  it('matches on aliases', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'version check')
    expect(results.some((e) => e.key === 'core:has')).toBe(true)
  })

  it('matches on whatItDoes', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'system clipboard')
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches on entry key', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'core:has')
    expect(results.some((e) => e.key === 'core:has')).toBe(true)
  })

  it('is case-insensitive', () => {
    const catalog = buildFunctionCatalog([])
    const lower = searchFunctions(catalog, 'expand')
    const upper = searchFunctions(catalog, 'EXPAND')
    expect(lower.length).toBe(upper.length)
  })

  it('returns empty array for no matches', () => {
    const catalog = buildFunctionCatalog([])
    const results = searchFunctions(catalog, 'zzz_no_match_xyz')
    expect(results).toHaveLength(0)
  })
})

describe('findFunctionByKey', () => {
  it('returns correct entry for valid key', () => {
    const catalog = buildFunctionCatalog([])
    const entry = findFunctionByKey(catalog, 'core:expand')
    expect(entry).toBeDefined()
    expect(entry?.label).toBe('Expand File Path') // friendly label
  })

  it('returns undefined for unknown key', () => {
    const catalog = buildFunctionCatalog([])
    const entry = findFunctionByKey(catalog, 'core:nonexistent')
    expect(entry).toBeUndefined()
  })

  it('finds plugin entries by key', () => {
    const schema = makePluginSchema()
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(catalog, 'plugin:test-plugin:find_files')
    expect(entry).toBeDefined()
    expect(entry?.isPlugin).toBe(true)
  })

  it('finds template entries by key', () => {
    const catalog = buildFunctionCatalog([])
    const entry = findFunctionByKey(catalog, 'template:get-config-path')
    expect(entry).toBeDefined()
    expect(entry?.isTemplate).toBe(true)
    expect(entry?.label).toBe('Get Config Directory')
  })
})

describe('getFunctionCategoryCounts', () => {
  it('produces accurate counts for core catalog', () => {
    const catalog = buildFunctionCatalog([])
    const counts = getFunctionCategoryCounts(catalog)
    // All entries should be distributed across categories
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(TOTAL_CORE_COUNT)
  })

  it('includes plugin category counts', () => {
    const schema = makePluginSchema()
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const counts = getFunctionCategoryCounts(catalog)
    expect(counts['plugin:test-plugin:all']).toBe(1)
  })
})

describe('getFunctionsByCategory', () => {
  it('returns entries for a valid category key', () => {
    const catalog = buildFunctionCatalog([])
    const pathEntries = getFunctionsByCategory(catalog, 'core:path')
    expect(pathEntries.length).toBeGreaterThan(0)
    expect(pathEntries.every((e) => e.categoryKey === 'core:path')).toBe(true)
  })

  it('returns entries for new lsp category', () => {
    const catalog = buildFunctionCatalog([])
    const lspEntries = getFunctionsByCategory(catalog, 'core:lsp')
    expect(lspEntries.length).toBeGreaterThan(0)
  })

  it('returns entries for new diagnostic category', () => {
    const catalog = buildFunctionCatalog([])
    const diagEntries = getFunctionsByCategory(catalog, 'core:diagnostic')
    expect(diagEntries.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown category', () => {
    const catalog = buildFunctionCatalog([])
    const entries = getFunctionsByCategory(catalog, 'core:nonexistent')
    expect(entries).toHaveLength(0)
  })
})

describe('getPopularFunctions', () => {
  it('returns only entries with isPopular: true and advancedOnly !== true', () => {
    const catalog = buildFunctionCatalog([])
    const popular = getPopularFunctions(catalog)
    expect(popular.length).toBeGreaterThanOrEqual(3)
    for (const entry of popular) {
      expect(entry.isPopular).toBe(true)
      expect(entry.advancedOnly).not.toBe(true)
    }
  })

  it('excludes advancedOnly functions', () => {
    const catalog = buildFunctionCatalog([])
    const popular = getPopularFunctions(catalog)

    // Build expected advanced-only keys from core source arrays
    const coreSources = [
      ...NEOVIM_FUNCTION_CATALOG,
      ...API_FUNCTION_CATALOG,
      ...LSP_FUNCTION_CATALOG,
      ...DIAGNOSTIC_FUNCTION_CATALOG,
      ...TREESITTER_FUNCTION_CATALOG,
    ]
    const expectedAdvancedCoreKeys = coreSources
      .filter((fn) => (fn as { advancedOnly?: boolean }).advancedOnly === true)
      .map((fn) => `core:${fn.name}`)

    // Assert that no expected advanced-only keys appear in popular
    for (const key of expectedAdvancedCoreKeys) {
      const advancedInPopular = popular.find((e) => e.key === key)
      expect(advancedInPopular).toBeUndefined()
    }
  })

  it('includes popular templates', () => {
    const catalog = buildFunctionCatalog([])
    const popular = getPopularFunctions(catalog)
    const configTemplate = popular.find(
      (e) => e.key === 'template:get-config-path',
    )
    expect(configTemplate).toBeDefined()
  })
})

describe('Category label stability', () => {
  it('category keys are stable regardless of label values', () => {
    const catalog = buildFunctionCatalog([])
    // Keys must follow the core:<slug> pattern
    const pathCat = catalog.categories.find((c) => c.key === 'core:path')
    expect(pathCat).toBeDefined()
    // The label can change but the key must not
    expect(pathCat?.key).toBe('core:path')
  })

  it('lsp category is present with correct key', () => {
    const catalog = buildFunctionCatalog([])
    const lspCat = catalog.categories.find((c) => c.key === 'core:lsp')
    expect(lspCat).toBeDefined()
    expect(lspCat?.label).toBe('Language Server (LSP)')
  })
})

describe('deriveLabelFromFunctionName', () => {
  it('converts snake_case to Title Case', () => {
    expect(deriveLabelFromFunctionName('find_files')).toBe('Find Files')
    expect(deriveLabelFromFunctionName('live_grep')).toBe('Live Grep')
    expect(deriveLabelFromFunctionName('git_commits')).toBe('Git Commits')
  })

  it('handles single word names', () => {
    expect(deriveLabelFromFunctionName('oldfiles')).toBe('Oldfiles')
    expect(deriveLabelFromFunctionName('buffers')).toBe('Buffers')
  })
})

describe('plugin display formatting (luaCall-derived signature & sourceDoc)', () => {
  it('renders signature from luaCall when there are no $params placeholders', () => {
    const schema = makePluginSchema({
      id: 'fixture-zero',
      pluginName: 'Fixture Zero',
      functions: [
        {
          name: 'explorer_open',
          description: 'Open the file explorer',
          params: [],
          returns: 'void',
          luaCall: 'Snacks.explorer()',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(
      catalog,
      'plugin:fixture-zero:explorer_open',
    )
    expect(entry).toBeDefined()
    expect(entry?.signature).toBe('Snacks.explorer()')
    expect(entry?.signature).not.toContain('explorer_open')
  })

  it('rewrites $params.<name> to bare name in displayed signature', () => {
    const schema = makePluginSchema({
      id: 'fixture-dotted',
      pluginName: 'Fixture Dotted',
      functions: [
        {
          name: 'explorer_reveal',
          description: 'Reveal a file in the explorer',
          params: [
            { name: 'file', type: 'string', optional: true },
            { name: 'buf', type: 'number', optional: true },
          ],
          returns: 'void',
          luaCall:
            'Snacks.explorer.reveal({ file = $params.file, buf = $params.buf })',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(
      catalog,
      'plugin:fixture-dotted:explorer_reveal',
    )
    expect(entry?.signature).toBe(
      'Snacks.explorer.reveal({ file = file, buf = buf })',
    )
    expect(entry?.signature).not.toContain('$params')
  })

  it('rewrites bare $params to "..." in displayed signature', () => {
    const schema = makePluginSchema({
      id: 'fixture-splat',
      pluginName: 'Fixture Splat',
      functions: [
        {
          name: 'gh_reactions',
          description: 'Show GH reactions',
          params: [{ name: 'opts', type: 'table', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.picker.gh_reactions($params)',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(
      catalog,
      'plugin:fixture-splat:gh_reactions',
    )
    expect(entry?.signature).toBe('Snacks.picker.gh_reactions(...)')
    expect(entry?.signature).not.toContain('$params')
  })

  it('uses authored sourceDoc verbatim when it is a non-blank string', () => {
    const schema = makePluginSchema({
      id: 'fixture-authored',
      pluginName: 'Fixture Authored',
      functions: [
        {
          name: 'explorer_open',
          description: 'Open explorer',
          params: [],
          returns: 'void',
          luaCall: 'Snacks.explorer()',
          sourceDoc:
            'https://github.com/folke/snacks.nvim/blob/main/docs/explorer.md',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(
      catalog,
      'plugin:fixture-authored:explorer_open',
    )
    expect(entry?.sourceDoc).toBe(
      'https://github.com/folke/snacks.nvim/blob/main/docs/explorer.md',
    )
  })

  it('falls back to display-formatted luaCall when sourceDoc is missing', () => {
    const schema = makePluginSchema({
      id: 'fixture-fallback',
      pluginName: 'Fixture Fallback',
      functions: [
        {
          name: 'explorer_open',
          description: 'Open explorer',
          params: [],
          returns: 'void',
          luaCall: 'Snacks.explorer()',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(
      catalog,
      'plugin:fixture-fallback:explorer_open',
    )
    expect(entry?.sourceDoc).toBe('Snacks.explorer()')
    expect(entry?.sourceDoc).not.toBe(':help explorer_open')
    expect(entry?.sourceDoc).not.toMatch(/^:help\b/)
  })

  it.each([
    ['empty string', ''],
    ['single space', ' '],
    ['tab + newline', '\t\n'],
    ['multiple spaces', '   '],
  ])('treats %s sourceDoc as missing and falls back to display-formatted luaCall', (_label, blank) => {
    const schema = makePluginSchema({
      id: 'fixture-blank',
      pluginName: 'Fixture Blank',
      functions: [
        {
          name: 'explorer_open',
          description: 'Open explorer',
          params: [],
          returns: 'void',
          luaCall: 'Snacks.explorer()',
          sourceDoc: blank,
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(
      catalog,
      'plugin:fixture-blank:explorer_open',
    )
    expect(entry?.sourceDoc).toBe('Snacks.explorer()')
    expect(entry?.sourceDoc.trim().length).toBeGreaterThan(0)
  })

  it('search by internal function name still finds the entry (matched via entry.key)', () => {
    const schema = makePluginSchema({
      id: 'fixture-search',
      pluginName: 'Fixture Search',
      functions: [
        {
          name: 'explorer_open',
          description: 'Open explorer',
          params: [],
          returns: 'void',
          luaCall: 'Snacks.explorer()',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const results = searchFunctions(catalog, 'explorer_open')
    expect(results.map((r) => r.key)).toContain(
      'plugin:fixture-search:explorer_open',
    )
  })

  it('no plugin entry produces fabricated `:help <internal_name>` or snake_case signature', () => {
    const schema = makePluginSchema({
      id: 'fixture-guard',
      pluginName: 'Fixture Guard',
      functions: [
        {
          name: 'lazygit_log_file',
          description: 'Lazygit file log',
          params: [],
          returns: 'void',
          luaCall: 'Snacks.lazygit.log_file()',
        },
        {
          name: 'terminal_toggle',
          description: 'Toggle terminal',
          params: [{ name: 'cmd', type: 'string', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.terminal.toggle($params.cmd)',
        },
        {
          name: 'gh_reactions',
          description: 'Show reactions',
          params: [{ name: 'opts', type: 'table', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.picker.gh_reactions($params)',
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const pluginEntries = catalog.entries.filter((e) => e.isPlugin)
    expect(pluginEntries.length).toBe(3)
    for (const entry of pluginEntries) {
      expect(entry.sourceDoc).not.toMatch(/^:help\s+[a-z_][a-z0-9_]*$/)
      expect(entry.signature).not.toMatch(/^[a-z_][a-z0-9_]*\(/)
    }
  })

  it('renders multi-statement luaCall verbatim except for $params rewrites', () => {
    const luaCall =
      "local v = $params.variant or 'dark'; " +
      "if v == 'dark' then vim.o.background = 'dark' " +
      "else vim.o.background = 'light' end; " +
      "vim.cmd('colorscheme ' .. v)"
    const schema = makePluginSchema({
      id: 'fixture-multistmt',
      pluginName: 'Fixture Multi-Statement',
      functions: [
        {
          name: 'apply',
          description: 'Apply a colorscheme variant',
          params: [{ name: 'variant', type: 'string', optional: true }],
          returns: 'void',
          luaCall,
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const entry = findFunctionByKey(catalog, 'plugin:fixture-multistmt:apply')
    expect(entry?.signature).toBe(
      "local v = variant or 'dark'; " +
        "if v == 'dark' then vim.o.background = 'dark' " +
        "else vim.o.background = 'light' end; " +
        "vim.cmd('colorscheme ' .. v)",
    )
    expect(entry?.signature).not.toContain('$params')
    expect(entry?.signature).toContain('local v = variant')
  })

  it('plugin function templates inherit luaCall-derived signature/sourceDoc from base', () => {
    const schema = makePluginSchema({
      id: 'fixture-tmpl',
      pluginName: 'Fixture Template',
      functions: [
        {
          name: 'find_files',
          description: 'Find files',
          params: [{ name: 'opts', type: 'table', optional: true }],
          returns: 'void',
          luaCall: "require('fixture-tmpl').find_files($params)",
        },
      ],
      functionTemplates: [
        {
          key: 'find-config-files',
          baseFunctionName: 'find_files',
          label: 'Find Config Files',
          shortDescription: 'Pre-filtered to ~/.config',
          defaults: {
            opts: { kind: 'lua', lua: "{ cwd = vim.fn.stdpath('config') }" },
          },
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])

    const baseEntry = findFunctionByKey(
      catalog,
      'plugin:fixture-tmpl:find_files',
    )
    const templateEntry = findFunctionByKey(
      catalog,
      'plugin:fixture-tmpl:template:find-config-files',
    )

    expect(baseEntry).toBeDefined()
    expect(templateEntry).toBeDefined()
    expect(templateEntry?.isTemplate).toBe(true)

    const expectedSignature = "require('fixture-tmpl').find_files(...)"
    expect(baseEntry?.signature).toBe(expectedSignature)
    expect(templateEntry?.signature).toBe(expectedSignature)
    expect(templateEntry?.signature).not.toContain('find_files(opts)')
    expect(templateEntry?.signature).not.toContain(':help find_files')

    expect(baseEntry?.sourceDoc).toBe(expectedSignature)
    expect(templateEntry?.sourceDoc).toBe(expectedSignature)
    expect(templateEntry?.sourceDoc).not.toMatch(/^:help\b/)
  })

  it('plugin function templates inherit an authored sourceDoc from the base function', () => {
    const schema = makePluginSchema({
      id: 'fixture-tmpl-doc',
      pluginName: 'Fixture Template Doc',
      functions: [
        {
          name: 'find_files',
          description: 'Find files',
          params: [{ name: 'opts', type: 'table', optional: true }],
          returns: 'void',
          luaCall: "require('fixture-tmpl-doc').find_files($params)",
          sourceDoc: 'https://example.invalid/docs/find_files',
        },
      ],
      functionTemplates: [
        {
          key: 'find-config-files',
          baseFunctionName: 'find_files',
          label: 'Find Config Files',
          shortDescription: 'Pre-filtered',
          defaults: {},
        },
      ],
    })
    const catalog = buildFunctionCatalog([makeResolvedSchema(schema)])
    const templateEntry = findFunctionByKey(
      catalog,
      'plugin:fixture-tmpl-doc:template:find-config-files',
    )
    expect(templateEntry?.sourceDoc).toBe(
      'https://example.invalid/docs/find_files',
    )
  })
})
