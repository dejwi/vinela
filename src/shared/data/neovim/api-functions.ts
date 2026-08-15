import type { VimFunctionCatalogEntry } from './functions'

/**
 * vim.api.* and vim.* utility functions.
 * All entries use luaCallOverride since they are not vim.fn.* functions.
 */
export const API_FUNCTION_CATALOG = [
  // ============================================
  // Buffer Operations
  // ============================================
  {
    name: 'nvim_get_current_buf',
    label: 'Get Current Buffer',
    signature: 'nvim_get_current_buf()',
    minArgs: 0,
    maxArgs: 0,
    returnType: 'buffer',
    category: 'buffer',
    notes: 'Returns the handle of the current buffer.',
    sourceDoc: ':help nvim_get_current_buf()',
    luaCallOverride: 'vim.api.nvim_get_current_buf()',
    whatItDoes:
      'Returns a handle (number) for the currently active buffer. Use this to pass to other buffer API functions.',
    isPopular: true,
    aliases: ['current buffer', 'buffer handle', 'active buffer'],
  },
  {
    name: 'nvim_buf_get_name',
    label: 'Get Buffer Filename',
    signature: 'nvim_buf_get_name({buffer})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    category: 'buffer',
    notes: 'Returns the full file name of a buffer.',
    sourceDoc: ':help nvim_buf_get_name()',
    luaCallOverride: 'vim.api.nvim_buf_get_name($params)',
    whatItDoes:
      'Returns the full file path of a buffer. Pass 0 for the current buffer.',
    isPopular: true,
    aliases: ['buffer name', 'buffer path', 'file name'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle (0 for current buffer).',
        example: '0',
      },
    ],
  },
  {
    name: 'nvim_buf_get_lines',
    label: 'Get Buffer Lines',
    signature:
      'nvim_buf_get_lines({buffer}, {start}, {end}, {strict_indexing})',
    minArgs: 4,
    maxArgs: 4,
    returnType: 'string[]',
    category: 'buffer',
    notes: 'Returns a range of lines from a buffer as a list of strings.',
    sourceDoc: ':help nvim_buf_get_lines()',
    luaCallOverride: 'vim.api.nvim_buf_get_lines($params)',
    whatItDoes:
      'Gets a range of lines from a buffer. Lines are 0-indexed. Use -1 as end to get all lines.',
    aliases: ['read lines', 'buffer content', 'get text'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle (0 for current buffer).',
        example: '0',
      },
      {
        index: 1,
        name: 'start',
        description: 'First line index (0-based, inclusive).',
        example: '0',
      },
      {
        index: 2,
        name: 'end',
        description:
          'Last line index (0-based, exclusive). Use -1 for end of buffer.',
        example: '-1',
      },
      {
        index: 3,
        name: 'strict_indexing',
        description: 'Whether out-of-bounds should be an error.',
        example: 'false',
      },
    ],
  },
  {
    name: 'nvim_buf_set_lines',
    label: 'Set Buffer Lines',
    signature:
      'nvim_buf_set_lines({buffer}, {start}, {end}, {strict_indexing}, {replacement})',
    minArgs: 5,
    maxArgs: 5,
    returnType: 'void',
    category: 'buffer',
    notes: 'Replaces a range of lines in a buffer.',
    sourceDoc: ':help nvim_buf_set_lines()',
    luaCallOverride: 'vim.api.nvim_buf_set_lines($params)',
    whatItDoes:
      'Replaces a range of lines in a buffer with new content. Can insert, delete, or replace lines.',
    aliases: ['write lines', 'set text', 'replace lines'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle (0 for current buffer).',
        example: '0',
      },
      {
        index: 1,
        name: 'start',
        description: 'First line index (0-based, inclusive).',
        example: '0',
      },
      {
        index: 2,
        name: 'end',
        description:
          'Last line index (0-based, exclusive). Use -1 for end of buffer.',
        example: '-1',
      },
      {
        index: 3,
        name: 'strict_indexing',
        description: 'Whether out-of-bounds should be an error.',
        example: 'false',
      },
      {
        index: 4,
        name: 'replacement',
        description: 'List of replacement lines.',
        example: '{}',
      },
    ],
  },
  {
    name: 'nvim_buf_line_count',
    label: 'Get Line Count',
    signature: 'nvim_buf_line_count({buffer})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    category: 'buffer',
    notes: 'Returns the number of lines in a buffer.',
    sourceDoc: ':help nvim_buf_line_count()',
    luaCallOverride: 'vim.api.nvim_buf_line_count($params)',
    whatItDoes: 'Returns the total number of lines in a buffer.',
    aliases: ['line count', 'buffer size', 'number of lines'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle (0 for current buffer).',
        example: '0',
      },
    ],
  },
  {
    name: 'nvim_buf_is_valid',
    label: 'Check if Buffer Valid',
    signature: 'nvim_buf_is_valid({buffer})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'boolean',
    category: 'buffer',
    notes: 'Returns true if the buffer is valid.',
    sourceDoc: ':help nvim_buf_is_valid()',
    luaCallOverride: 'vim.api.nvim_buf_is_valid($params)',
    whatItDoes:
      'Checks whether a buffer handle is still valid (the buffer exists and has not been deleted).',
    aliases: ['buffer valid', 'check buffer'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle to check.',
        example: '1',
      },
    ],
  },
  {
    name: 'nvim_buf_is_loaded',
    label: 'Check if Buffer Loaded',
    signature: 'nvim_buf_is_loaded({buffer})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'boolean',
    category: 'buffer',
    notes: 'Returns true if the buffer is loaded into memory.',
    sourceDoc: ':help nvim_buf_is_loaded()',
    luaCallOverride: 'vim.api.nvim_buf_is_loaded($params)',
    whatItDoes:
      'Checks whether a buffer is currently loaded into memory (its content is accessible).',
    aliases: ['buffer loaded', 'is loaded'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle to check.',
        example: '1',
      },
    ],
  },
  {
    name: 'nvim_list_bufs',
    label: 'List All Buffers',
    signature: 'nvim_list_bufs()',
    minArgs: 0,
    maxArgs: 0,
    returnType: 'number[]',
    category: 'buffer',
    notes: 'Returns a list of all buffer handles.',
    sourceDoc: ':help nvim_list_bufs()',
    luaCallOverride: 'vim.api.nvim_list_bufs()',
    whatItDoes:
      'Returns a list of handles for all buffers (including hidden and unlisted ones).',
    aliases: ['all buffers', 'buffer list'],
  },
  {
    name: 'nvim_create_buf',
    label: 'Create New Buffer',
    signature: 'nvim_create_buf({listed}, {scratch})',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'buffer',
    category: 'buffer',
    notes: 'Creates a new empty buffer.',
    sourceDoc: ':help nvim_create_buf()',
    luaCallOverride: 'vim.api.nvim_create_buf($params)',
    whatItDoes:
      'Creates a new empty buffer. Set listed=false and scratch=true for a temporary scratch buffer.',
    aliases: ['new buffer', 'create buffer', 'scratch buffer'],
    argumentHints: [
      {
        index: 0,
        name: 'listed',
        description: 'Whether the buffer appears in the buffer list.',
        example: 'false',
      },
      {
        index: 1,
        name: 'scratch',
        description:
          'Whether the buffer is a scratch buffer (no file, no undo).',
        example: 'true',
      },
    ],
  },
  {
    name: 'nvim_buf_delete',
    label: 'Delete Buffer',
    signature: 'nvim_buf_delete({buffer}, {opts})',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'void',
    category: 'buffer',
    notes: 'Deletes a buffer and its associated data.',
    sourceDoc: ':help nvim_buf_delete()',
    luaCallOverride: 'vim.api.nvim_buf_delete($params)',
    whatItDoes:
      'Deletes a buffer. Pass {force=true} in opts to force-delete even if modified.',
    aliases: ['close buffer', 'remove buffer', 'delete buffer'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle to delete.',
        example: '1',
      },
      {
        index: 1,
        name: 'opts',
        description: 'Options table. Use {force=true} to force deletion.',
        example: '{}',
      },
    ],
  },
  {
    name: 'nvim_set_current_buf',
    label: 'Switch to Buffer',
    signature: 'nvim_set_current_buf({buffer})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'void',
    category: 'buffer',
    notes: 'Sets the current buffer in the current window.',
    sourceDoc: ':help nvim_set_current_buf()',
    luaCallOverride: 'vim.api.nvim_set_current_buf($params)',
    whatItDoes: 'Switches the current window to display the specified buffer.',
    aliases: ['switch buffer', 'open buffer', 'go to buffer'],
    argumentHints: [
      {
        index: 0,
        name: 'buffer',
        description: 'Buffer handle to switch to.',
        example: '1',
      },
    ],
  },

  // ============================================
  // Window & Layout
  // ============================================
  {
    name: 'nvim_get_current_win',
    label: 'Get Current Window',
    signature: 'nvim_get_current_win()',
    minArgs: 0,
    maxArgs: 0,
    returnType: 'window',
    category: 'window',
    notes: 'Returns the handle of the current window.',
    sourceDoc: ':help nvim_get_current_win()',
    luaCallOverride: 'vim.api.nvim_get_current_win()',
    whatItDoes: 'Returns a handle (number) for the currently focused window.',
    aliases: ['current window', 'window handle', 'active window'],
  },
  {
    name: 'nvim_win_get_cursor',
    label: 'Get Cursor Position',
    signature: 'nvim_win_get_cursor({window})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number[]',
    category: 'window',
    notes:
      'Returns the cursor position as {row, col} (1-based row, 0-based col).',
    sourceDoc: ':help nvim_win_get_cursor()',
    luaCallOverride: 'vim.api.nvim_win_get_cursor($params)',
    whatItDoes:
      'Returns the cursor position in a window as {row, col}. Row is 1-based, column is 0-based.',
    isPopular: true,
    aliases: ['cursor position', 'cursor location', 'line column'],
    argumentHints: [
      {
        index: 0,
        name: 'window',
        description: 'Window handle (0 for current window).',
        example: '0',
      },
    ],
  },
  {
    name: 'nvim_win_set_cursor',
    label: 'Set Cursor Position',
    signature: 'nvim_win_set_cursor({window}, {pos})',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'void',
    category: 'window',
    notes: 'Sets the cursor position in a window.',
    sourceDoc: ':help nvim_win_set_cursor()',
    luaCallOverride: 'vim.api.nvim_win_set_cursor($params)',
    whatItDoes:
      'Moves the cursor to a specific position in a window. Position is {row, col} where row is 1-based.',
    aliases: ['move cursor', 'jump to line', 'set position'],
    argumentHints: [
      {
        index: 0,
        name: 'window',
        description: 'Window handle (0 for current window).',
        example: '0',
      },
      {
        index: 1,
        name: 'pos',
        description:
          'Cursor position as {row, col} (row is 1-based, col is 0-based).',
        example: '{1, 0}',
      },
    ],
  },
  {
    name: 'nvim_win_get_width',
    label: 'Get Window Width',
    signature: 'nvim_win_get_width({window})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    category: 'window',
    notes: 'Returns the width of a window in columns.',
    sourceDoc: ':help nvim_win_get_width()',
    luaCallOverride: 'vim.api.nvim_win_get_width($params)',
    whatItDoes: 'Returns the width of a window in columns.',
    aliases: ['window width', 'columns'],
    argumentHints: [
      {
        index: 0,
        name: 'window',
        description: 'Window handle (0 for current window).',
        example: '0',
      },
    ],
  },
  {
    name: 'nvim_win_get_height',
    label: 'Get Window Height',
    signature: 'nvim_win_get_height({window})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number',
    category: 'window',
    notes: 'Returns the height of a window in rows.',
    sourceDoc: ':help nvim_win_get_height()',
    luaCallOverride: 'vim.api.nvim_win_get_height($params)',
    whatItDoes: 'Returns the height of a window in rows.',
    aliases: ['window height', 'rows'],
    argumentHints: [
      {
        index: 0,
        name: 'window',
        description: 'Window handle (0 for current window).',
        example: '0',
      },
    ],
  },
  {
    name: 'nvim_list_wins',
    label: 'List All Windows',
    signature: 'nvim_list_wins()',
    minArgs: 0,
    maxArgs: 0,
    returnType: 'number[]',
    category: 'window',
    notes: 'Returns a list of all window handles in the current tabpage.',
    sourceDoc: ':help nvim_list_wins()',
    luaCallOverride: 'vim.api.nvim_list_wins()',
    whatItDoes:
      'Returns a list of handles for all windows in the current tab page.',
    aliases: ['all windows', 'window list'],
  },
  {
    name: 'nvim_win_close',
    label: 'Close Window',
    signature: 'nvim_win_close({window}, {force})',
    minArgs: 2,
    maxArgs: 2,
    returnType: 'void',
    category: 'window',
    notes: 'Closes a window.',
    sourceDoc: ':help nvim_win_close()',
    luaCallOverride: 'vim.api.nvim_win_close($params)',
    whatItDoes:
      'Closes a window. Set force=true to close even if it contains a modified buffer.',
    aliases: ['close window', 'hide window'],
    argumentHints: [
      {
        index: 0,
        name: 'window',
        description: 'Window handle to close.',
        example: '0',
      },
      {
        index: 1,
        name: 'force',
        description: 'Force close even if buffer is modified.',
        example: 'false',
      },
    ],
  },

  // ============================================
  // Notifications & Output
  // ============================================
  {
    name: 'vim_notify',
    label: 'Show Notification',
    signature: 'vim.notify({msg}[, {level}[, {opts}]])',
    minArgs: 1,
    maxArgs: 3,
    returnType: 'void',
    category: 'notify',
    notes: 'Displays a notification message to the user.',
    sourceDoc: ':help vim.notify()',
    luaCallOverride: 'vim.notify($params)',
    whatItDoes:
      'Shows a notification message to the user. The level controls the severity (INFO, WARN, ERROR, etc.).',
    isPopular: true,
    aliases: ['notification', 'message', 'alert', 'popup'],
    argumentHints: [
      {
        index: 0,
        name: 'message',
        description: 'The notification message text.',
        example: 'Hello from Neovim!',
      },
      {
        index: 1,
        name: 'level',
        description: 'Log level for the notification.',
        allowedValues: [
          'vim.log.levels.INFO',
          'vim.log.levels.WARN',
          'vim.log.levels.ERROR',
          'vim.log.levels.DEBUG',
          'vim.log.levels.TRACE',
        ],
        example: 'vim.log.levels.INFO',
      },
      {
        index: 2,
        name: 'opts',
        description: 'Optional table of options (title, icon, etc.).',
        example: '{}',
      },
    ],
  },
  {
    name: 'vim_notify_once',
    label: 'Show Once',
    signature: 'vim.notify_once({msg}[, {level}[, {opts}]])',
    minArgs: 1,
    maxArgs: 3,
    returnType: 'boolean',
    category: 'notify',
    notes: 'Displays a notification only once per session.',
    sourceDoc: ':help vim.notify_once()',
    luaCallOverride: 'vim.notify_once($params)',
    whatItDoes:
      'Shows a notification message, but only once per Neovim session. Subsequent calls with the same message are silently ignored.',
    aliases: ['notify once', 'one-time message'],
    argumentHints: [
      {
        index: 0,
        name: 'message',
        description: 'The notification message text.',
        example: 'Plugin loaded!',
      },
      {
        index: 1,
        name: 'level',
        description: 'Log level for the notification.',
        allowedValues: [
          'vim.log.levels.INFO',
          'vim.log.levels.WARN',
          'vim.log.levels.ERROR',
          'vim.log.levels.DEBUG',
          'vim.log.levels.TRACE',
        ],
        example: 'vim.log.levels.INFO',
      },
    ],
  },
  {
    name: 'vim_print',
    label: 'Print Value',
    signature: 'vim.print({...})',
    minArgs: 1,
    maxArgs: 'unbounded',
    returnType: 'void',
    category: 'notify',
    notes:
      'Prints values to the Neovim message area, similar to print() but Neovim-aware.',
    sourceDoc: ':help vim.print()',
    luaCallOverride: 'vim.print($params)',
    whatItDoes:
      'Prints one or more values to the Neovim message area. Tables are pretty-printed. Useful for debugging.',
    aliases: ['print', 'debug print', 'output'],
    argumentHints: [
      {
        index: 0,
        name: 'value',
        description: 'Value to print (any type, tables are pretty-printed).',
        example: 'vim.o',
      },
    ],
  },
  {
    name: 'vim_inspect',
    label: 'Inspect Value',
    signature: 'vim.inspect({object}[, {options}])',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'string',
    category: 'notify',
    notes: 'Returns a human-readable string representation of a Lua value.',
    sourceDoc: ':help vim.inspect()',
    luaCallOverride: 'vim.inspect($params)',
    whatItDoes:
      'Converts any Lua value (including tables) to a human-readable string. Useful for debugging complex data structures.',
    aliases: ['inspect', 'pretty print', 'serialize', 'debug'],
    argumentHints: [
      {
        index: 0,
        name: 'object',
        description: 'The Lua value to inspect.',
        example: 'vim.o',
      },
    ],
  },

  // ============================================
  // Highlight
  // ============================================
  {
    name: 'highlight_on_yank',
    label: 'Highlight on Yank',
    signature: 'vim.highlight.on_yank([{opts}])',
    minArgs: 0,
    maxArgs: 4,
    returnType: 'void',
    category: 'ui',
    notes: 'Briefly highlights yanked text after copying.',
    sourceDoc: ':help vim.highlight.on_yank()',
    luaCallOverride: 'vim.highlight.on_yank($params)',
    whatItDoes:
      'Briefly highlights text after you yank (copy) it, giving visual feedback about what was copied. This is one of the most popular Neovim configuration snippets.',
    isPopular: true,
    aliases: [
      'yank highlight',
      'copy highlight',
      'visual feedback',
      'flash yank',
    ],
    paramsStyle: 'named-table',
    argumentHints: [
      {
        index: 0,
        name: 'higroup',
        type: 'string',
        description:
          'The highlight group used to color the yanked text. Controls what color/style the flash effect uses. Common choices: IncSearch (yellow/orange), Visual (selection blue), Search (search match color).',
        example: 'IncSearch',
        allowedValues: [
          'IncSearch',
          'Visual',
          'Search',
          'Substitute',
          'CursorLine',
        ],
        allowedValueDescriptions: {
          IncSearch:
            'Yellow/orange flash — matches the incremental search highlight color',
          Visual:
            'Selection blue — uses the same color as visual mode selection',
          Search:
            'Search match color — uses the same highlight as search results',
          Substitute:
            'Substitution preview color — uses the :substitute preview highlight',
          CursorLine:
            'Cursor line highlight — subtle, uses the current line background color',
        },
      },
      {
        index: 1,
        name: 'timeout',
        type: 'number',
        description:
          'How long the highlight stays visible, in milliseconds. Lower values (100-150) give a quick flash, higher values (300-500) keep it visible longer. Default is 150ms if not set.',
        example: '200',
      },
      {
        index: 2,
        name: 'on_macro',
        type: 'boolean',
        description:
          'Whether to show the highlight when running macros (recorded key sequences). Disable this if macro playback feels slow due to repeated highlighting.',
        example: 'false',
      },
      {
        index: 3,
        name: 'on_visual',
        type: 'boolean',
        description:
          'Whether to show the highlight when yanking from visual mode (selected text). Some users disable this since the visual selection already shows what was selected.',
        example: 'true',
      },
    ],
  },
] as const satisfies readonly VimFunctionCatalogEntry[]
