import type { VimFunctionCatalogEntry } from './functions'

/**
 * vim.diagnostic.* functions.
 */
export const DIAGNOSTIC_FUNCTION_CATALOG = [
  {
    name: 'diagnostic_open_float',
    label: 'Show Diagnostic Popup',
    signature: 'vim.diagnostic.open_float([{opts}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'void',
    category: 'diagnostic',
    notes: 'Shows diagnostics in a floating window.',
    sourceDoc: ':help vim.diagnostic.open_float()',
    luaCallOverride: 'vim.diagnostic.open_float($params)',
    whatItDoes:
      'Opens a floating window showing the diagnostic message(s) at the current cursor position.',
    isPopular: true,
    aliases: ['show error', 'diagnostic popup', 'error details', 'hover error'],
    argumentHints: [
      {
        index: 0,
        name: 'opts',
        description: 'Options table (scope, bufnr, severity, etc.).',
        example: '{}',
      },
    ],
  },
  {
    name: 'diagnostic_goto_next',
    label: 'Go to Next Diagnostic',
    signature: 'vim.diagnostic.goto_next([{opts}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'void',
    category: 'diagnostic',
    notes: 'Moves the cursor to the next diagnostic in the buffer.',
    sourceDoc: ':help vim.diagnostic.goto_next()',
    luaCallOverride: 'vim.diagnostic.goto_next($params)',
    whatItDoes:
      'Moves the cursor to the next error, warning, or diagnostic in the current buffer.',
    isPopular: true,
    aliases: ['next error', 'next warning', 'next diagnostic', ']d'],
    argumentHints: [
      {
        index: 0,
        name: 'opts',
        description: 'Options table (severity filter, wrap, etc.).',
        example: '{}',
      },
    ],
  },
  {
    name: 'diagnostic_goto_prev',
    label: 'Go to Previous Diagnostic',
    signature: 'vim.diagnostic.goto_prev([{opts}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'void',
    category: 'diagnostic',
    notes: 'Moves the cursor to the previous diagnostic in the buffer.',
    sourceDoc: ':help vim.diagnostic.goto_prev()',
    luaCallOverride: 'vim.diagnostic.goto_prev($params)',
    whatItDoes:
      'Moves the cursor to the previous error, warning, or diagnostic in the current buffer.',
    isPopular: true,
    aliases: [
      'previous error',
      'previous warning',
      'previous diagnostic',
      '[d',
    ],
    argumentHints: [
      {
        index: 0,
        name: 'opts',
        description: 'Options table (severity filter, wrap, etc.).',
        example: '{}',
      },
    ],
  },
  {
    name: 'diagnostic_get',
    label: 'Get Diagnostics',
    signature: 'vim.diagnostic.get([{bufnr}[, {opts}]])',
    minArgs: 0,
    maxArgs: 2,
    returnType: 'table',
    category: 'diagnostic',
    notes: 'Returns a list of diagnostics for a buffer.',
    sourceDoc: ':help vim.diagnostic.get()',
    luaCallOverride: 'vim.diagnostic.get($params)',
    whatItDoes:
      'Returns a list of all diagnostic objects for a buffer (or all buffers if no bufnr given).',
    aliases: ['get errors', 'list diagnostics', 'diagnostic list'],
    argumentHints: [
      {
        index: 0,
        name: 'bufnr',
        description: 'Buffer number (nil for all buffers).',
        example: '0',
      },
      {
        index: 1,
        name: 'opts',
        description: 'Options table (severity filter, namespace, etc.).',
        example: '{}',
      },
    ],
  },
  {
    name: 'diagnostic_setloclist',
    label: 'Send to Location List',
    signature: 'vim.diagnostic.setloclist([{opts}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'void',
    category: 'diagnostic',
    notes: 'Adds buffer diagnostics to the location list.',
    sourceDoc: ':help vim.diagnostic.setloclist()',
    luaCallOverride: 'vim.diagnostic.setloclist($params)',
    whatItDoes:
      'Sends all diagnostics for the current buffer to the location list so you can navigate them with :lnext/:lprev.',
    aliases: ['location list', 'loclist', 'diagnostic list'],
    argumentHints: [
      {
        index: 0,
        name: 'opts',
        description: 'Options table (open, title, severity, etc.).',
        example: '{}',
      },
    ],
  },
  {
    name: 'diagnostic_enable',
    label: 'Enable Diagnostics',
    signature: 'vim.diagnostic.enable([{bufnr}[, {filter}]])',
    minArgs: 0,
    maxArgs: 2,
    returnType: 'void',
    category: 'diagnostic',
    notes: 'Enables diagnostics for a buffer or globally.',
    sourceDoc: ':help vim.diagnostic.enable()',
    luaCallOverride: 'vim.diagnostic.enable($params)',
    whatItDoes:
      'Enables diagnostic display for a buffer or globally. Pass true/false to toggle.',
    aliases: ['enable diagnostics', 'show diagnostics', 'toggle diagnostics'],
    argumentHints: [
      {
        index: 0,
        name: 'bufnr',
        description:
          'Buffer number (nil for global). Pass true/false to enable/disable.',
        example: '0',
      },
    ],
  },
  {
    name: 'diagnostic_is_enabled',
    label: 'Check if Enabled',
    signature: 'vim.diagnostic.is_enabled([{filter}])',
    minArgs: 0,
    maxArgs: 1,
    returnType: 'boolean',
    category: 'diagnostic',
    notes: 'Returns true if diagnostics are enabled.',
    sourceDoc: ':help vim.diagnostic.is_enabled()',
    luaCallOverride: 'vim.diagnostic.is_enabled($params)',
    whatItDoes:
      'Checks whether diagnostics are currently enabled (globally or for a specific buffer/namespace).',
    aliases: ['diagnostics enabled', 'check diagnostics'],
    argumentHints: [
      {
        index: 0,
        name: 'filter',
        description: 'Optional filter table (bufnr, ns_id).',
        example: '{}',
      },
    ],
  },
] as const satisfies readonly VimFunctionCatalogEntry[]
