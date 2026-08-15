import { describe, expect, it } from 'vitest'
import { assertLuaSyntaxValid } from '@/features/lua-generator/__tests__/utils/lua-assert'
import { generatePluginSection } from '@/features/lua-generator/sections/plugin-section'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '@/features/lua-generator/types'
import treesitterSchema from '@/schemas/treesitter.json'
import type { PluginConfigValue, PluginSchema } from '@/shared/types'
import {
  extractTreesitterSetupLua,
  runTreesitterSetupHarness,
} from './treesitter-lua-harness'

const schema = treesitterSchema as PluginSchema

const OBSOLETE_STARTUP_PATTERNS = [
  "get_installed('parsers')",
  'get_available',
  'require("nvim-treesitter")',
  "require('nvim-treesitter')",
  'treesitter.setup(',
  'treesitter.install(',
  'treesitter.update(',
  'nvim-treesitter.configs',
  'ensure_installed',
  'ignore_install',
] as const

function generateTreesitterLua(
  config: Record<string, PluginConfigValue> = {},
): string {
  const resolved: ResolvedPluginForGeneration = {
    plugin: {
      id: 'treesitter',
      schemaId: 'nvim-treesitter',
      enabled: true,
      config,
    },
    schema,
  }

  const input: PluginSectionInput = {
    resolvedPlugins: [resolved],
    themePluginIds: new Set(),
  }

  return generatePluginSection(input).code.join('\n')
}

function extractTreesitterBlock(lua: string): string {
  const marker = '-- nvim-treesitter'
  const start = lua.indexOf(marker)
  if (start === -1) {
    throw new Error('generated Lua is missing nvim-treesitter setup block')
  }
  return lua.slice(start)
}

async function runHarness(
  config: Record<string, PluginConfigValue>,
  options: {
    readonly filetype?: string
    readonly languageResolve?:
      | { readonly kind: 'resolved'; readonly lang: string }
      | { readonly kind: 'nil' }
      | { readonly kind: 'throw' }
    readonly startBehavior?: 'success' | 'throw'
  } = {},
) {
  const generatedLua = generateTreesitterLua(config)
  const setupLua = extractTreesitterSetupLua(generatedLua)
  return runTreesitterSetupHarness({
    setupLua,
    filetype: options.filetype ?? 'lua',
    languageResolve: options.languageResolve ?? {
      kind: 'resolved',
      lang: 'lua',
    },
    startBehavior: options.startBehavior ?? 'success',
  })
}

describe('built-in treesitter schema', () => {
  it('pins main branch install target and lua-template renderer', () => {
    expect(schema.pack?.version).toEqual({ mode: 'ref', value: 'main' })
    expect(schema.setup?.render?.kind).toBe('lua-template')
  })

  it('does not expose removed or legacy module options', () => {
    const keys = schema.options.map((option) => option.key)
    expect(keys).not.toContain('ensure_installed')
    expect(keys).not.toContain('ignore_install')
    expect(keys).not.toContain('auto_install')
    expect(keys).not.toContain('sync_install')
    expect(keys).not.toContain('indent.enable')
    expect(keys).not.toContain('incremental_selection.enable')
    expect(keys).not.toContain('highlight.additional_vim_regex_highlighting')
  })

  it('generates core FileType highlighting without root nvim-treesitter APIs', () => {
    const lua = generateTreesitterLua()
    const block = extractTreesitterBlock(lua)

    expect(lua).toContain('version = "main"')
    expect(block).toContain("nvim_create_autocmd('FileType'")
    expect(block).toContain('vim.treesitter.language.get_lang')
    expect(block).toContain('pcall(vim.treesitter.start, args.buf, lang)')
    expect(block).toContain('VinelaNvimTreesitterHighlight')

    for (const pattern of OBSOLETE_STARTUP_PATTERNS) {
      expect(block).not.toContain(pattern)
    }
  })

  it('does not emit obsolete stored keys removed from the schema', () => {
    const lua = generateTreesitterLua({
      ensure_installed: ['lua', 'python'],
      ignore_install: ['javascript'],
      'highlight.enable': true,
      'highlight.disable': ['rust'],
    })
    const block = extractTreesitterBlock(lua)

    expect(block).not.toContain('ensure_installed')
    expect(block).not.toContain('ignore_install')
    expect(block).toContain('highlight = {')
    expect(block).toContain('disable = { "rust" }')
  })

  it('passes Lua syntax validation for generated output', async () => {
    await assertLuaSyntaxValid(generateTreesitterLua())
  })

  describe('FileType highlighting harness', () => {
    it('does not register highlighting when highlight.enable is false', async () => {
      const result = await runHarness({ 'highlight.enable': false })

      expect(result.startCalls).toEqual([])
      expect(result.callbackThrew).toBe(false)
    })

    it('starts highlighting for a resolved parser language alias', async () => {
      const result = await runHarness(
        { 'highlight.enable': true },
        {
          filetype: 'cpp',
          languageResolve: { kind: 'resolved', lang: 'c' },
        },
      )

      expect(result.startCalls).toEqual([{ buf: 1, lang: 'c' }])
      expect(result.callbackThrew).toBe(false)
    })

    it('skips highlighting when the resolved language is disabled', async () => {
      const result = await runHarness(
        {
          'highlight.enable': true,
          'highlight.disable': ['lua'],
        },
        {
          filetype: 'lua',
          languageResolve: { kind: 'resolved', lang: 'lua' },
        },
      )

      expect(result.startCalls).toEqual([])
      expect(result.callbackThrew).toBe(false)
    })

    it('swallows nil language resolution without propagating', async () => {
      const result = await runHarness(
        { 'highlight.enable': true },
        { languageResolve: { kind: 'nil' } },
      )

      expect(result.startCalls).toEqual([])
      expect(result.callbackThrew).toBe(false)
    })

    it('swallows thrown language resolution without propagating', async () => {
      const result = await runHarness(
        { 'highlight.enable': true },
        { languageResolve: { kind: 'throw' } },
      )

      expect(result.startCalls).toEqual([])
      expect(result.callbackThrew).toBe(false)
    })

    it('swallows thrown vim.treesitter.start without propagating', async () => {
      const result = await runHarness(
        { 'highlight.enable': true },
        { startBehavior: 'throw' },
      )

      expect(result.startCalls).toEqual([])
      expect(result.callbackThrew).toBe(false)
    })
  })
})
