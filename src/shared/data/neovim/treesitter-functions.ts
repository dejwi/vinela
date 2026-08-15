import type { VimFunctionCatalogEntry } from './functions'

/**
 * vim.treesitter.* functions.
 */
export const TREESITTER_FUNCTION_CATALOG = [
  {
    name: 'treesitter_start',
    label: 'Enable Treesitter Highlighting',
    signature: 'vim.treesitter.start([{bufnr}[, {lang}]])',
    minArgs: 0,
    maxArgs: 2,
    returnType: 'void',
    category: 'treesitter',
    notes: 'Starts treesitter highlighting for a buffer.',
    sourceDoc: ':help vim.treesitter.start()',
    luaCallOverride: 'vim.treesitter.start($params)',
    whatItDoes:
      'Enables treesitter-based syntax highlighting for a buffer. Optionally specify the language.',
    aliases: ['treesitter highlight', 'enable treesitter', 'syntax highlight'],
    argumentHints: [
      {
        index: 0,
        name: 'bufnr',
        description: 'Buffer number (nil for current buffer).',
        example: '0',
      },
      {
        index: 1,
        name: 'lang',
        description: 'Language name (auto-detected if omitted).',
        example: 'lua',
      },
    ],
  },
  {
    name: 'treesitter_stop',
    label: 'Disable Treesitter',
    signature: 'vim.treesitter.stop([{bufnr}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'void',
    category: 'treesitter',
    notes: 'Stops treesitter highlighting for a buffer.',
    sourceDoc: ':help vim.treesitter.stop()',
    luaCallOverride: 'vim.treesitter.stop($params)',
    whatItDoes: 'Disables treesitter-based syntax highlighting for a buffer.',
    aliases: ['disable treesitter', 'stop treesitter'],
    argumentHints: [
      {
        index: 0,
        name: 'bufnr',
        description: 'Buffer number (nil for current buffer).',
        example: '0',
      },
    ],
  },
  {
    name: 'treesitter_inspect_tree',
    label: 'Inspect Syntax Tree',
    signature: 'vim.treesitter.inspect_tree([{opts}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'void',
    category: 'treesitter',
    notes:
      'Opens a window showing the treesitter syntax tree for the current buffer.',
    sourceDoc: ':help vim.treesitter.inspect_tree()',
    luaCallOverride: 'vim.treesitter.inspect_tree($params)',
    whatItDoes:
      'Opens a split window showing the treesitter parse tree for the current buffer. Useful for debugging syntax issues.',
    aliases: ['inspect tree', 'syntax tree', 'parse tree', 'debug treesitter'],
    argumentHints: [
      {
        index: 0,
        name: 'opts',
        description: 'Options table (bufnr, lang, command, etc.).',
        example: '{}',
      },
    ],
  },
] as const satisfies readonly VimFunctionCatalogEntry[]
