export type ExCommandCategory =
  | 'file' // write, update, edit, source
  | 'navigation' // quit, bdelete, tabnew, bnext, bprevious, close
  | 'display' // colorscheme, nohlsearch, redraw, spell
  | 'diagnostics' // checkhealth
  | 'search' // grep, vimgrep, substitute, global
  | 'advanced' // lua, set, command, normal
  | 'quickfix' // copen, cnext, cprev, cclose
  | 'loclist' // lopen, lnext, lprev, lclose
  | 'history' // undo, redo, earlier
  | 'folding' // foldopen, foldclose
  | 'marks' // marks, delmarks

export interface CommandParameter {
  name: string
  placeholder: string
  description: string
}

export interface NeovimExCommandCatalogEntry {
  name: string
  category: ExCommandCategory
  template: string
  description: string
  example: string
  sourceDoc: string
  params?: CommandParameter[]
  /** User-friendly label shown in dropdown (e.g., "Save file") */
  label: string
  /** Plain English explanation for beginners */
  whatItDoes: string
  /** Optional advanced technical note */
  technicalNote?: string
  /** Whether this is a commonly-used command */
  isPopular?: boolean
}

export const EX_COMMAND_CATEGORY_LABELS: Record<ExCommandCategory, string> = {
  file: 'File',
  navigation: 'Navigation',
  display: 'Display',
  diagnostics: 'Diagnostics',
  search: 'Search',
  advanced: 'Advanced',
  quickfix: 'Quickfix List',
  loclist: 'Location List',
  history: 'History',
  folding: 'Folding',
  marks: 'Marks',
}

export const NEOVIM_EX_COMMAND_CATALOG: readonly NeovimExCommandCatalogEntry[] =
  [
    // File category
    {
      name: 'write',
      label: 'Save file',
      category: 'file',
      template: ':write',
      description: 'Write the current buffer to disk.',
      whatItDoes:
        'Saves your current file to disk, just like Ctrl+S in other editors.',
      technicalNote:
        'Writes to the file path shown in the buffer. Use :saveas for a new name.',
      example: ':write',
      sourceDoc: ':help :write',
      isPopular: true,
    },
    {
      name: 'update',
      label: 'Save if changed',
      category: 'file',
      template: ':update',
      description: 'Write only when the buffer changed.',
      whatItDoes:
        'Saves the file only if you made changes. Avoids unnecessary disk writes.',
      example: ':update',
      sourceDoc: ':help :update',
    },
    {
      name: 'edit',
      label: 'Open file',
      category: 'file',
      template: ':edit {file}',
      description: 'Edit a file path.',
      whatItDoes:
        'Opens a file for editing. You can type the full path or use tab completion.',
      example: ':edit ~/.config/nvim/init.lua',
      sourceDoc: ':help :edit',
      params: [
        {
          name: 'file',
          placeholder: '/path/to/file',
          description: 'File path to edit',
        },
      ],
    },
    {
      name: 'saveas',
      label: 'Save as new file',
      category: 'file',
      template: ':saveas {file}',
      description: 'Save the current buffer with a new name.',
      whatItDoes:
        'Saves your current file with a different name, like "Save As" in other apps.',
      example: ':saveas ~/newfile.lua',
      sourceDoc: ':help :saveas',
      params: [
        {
          name: 'file',
          placeholder: '/path/to/file',
          description: 'New file path',
        },
      ],
    },
    {
      name: 'wall',
      label: 'Save all files',
      category: 'file',
      template: ':wall',
      description: 'Write all changed buffers.',
      whatItDoes: 'Saves all open files that have unsaved changes at once.',
      example: ':wall',
      sourceDoc: ':help :wall',
      isPopular: true,
    },
    {
      name: 'source',
      label: 'Run config file',
      category: 'file',
      template: ':source {file}',
      description: 'Execute Ex commands from a file.',
      whatItDoes:
        'Runs a Vim/Lua config file. Useful for reloading your config without restarting.',
      technicalNote: 'Use $MYVIMRC to source your main config file.',
      example: ':source $MYVIMRC',
      sourceDoc: ':help :source',
      params: [
        {
          name: 'file',
          placeholder: '$MYVIMRC',
          description: 'Script file to source',
        },
      ],
    },
    // Navigation category
    {
      name: 'quit',
      label: 'Close window (exits if last)',
      category: 'navigation',
      template: ':quit',
      description: 'Quit the current window.',
      whatItDoes:
        "Closes the current window. If it's the last window, exits Neovim.",
      technicalNote:
        'Use :quit! to force close without saving. Use :qall to quit all windows.',
      example: ':quit',
      sourceDoc: ':help :quit',
      isPopular: true,
    },
    {
      name: 'qall',
      label: 'Quit Neovim',
      category: 'navigation',
      template: ':qall',
      description: 'Quit all windows and exit Neovim.',
      whatItDoes: 'Closes all windows and exits Neovim completely.',
      example: ':qall',
      sourceDoc: ':help :qall',
      isPopular: true,
    },
    {
      name: 'bdelete',
      label: 'Close buffer (file in memory)',
      category: 'navigation',
      template: ':bdelete {buf}',
      description: 'Unload a buffer and delete it from the buffer list.',
      whatItDoes:
        'Closes a file from memory. The window stays open with another buffer.',
      technicalNote:
        'Use % for current buffer. Buffer numbers shown in :ls output.',
      example: ':bdelete 3',
      sourceDoc: ':help :bdelete',
      params: [
        {
          name: 'buf',
          placeholder: 'buffer number',
          description: 'Buffer number (or % for current)',
        },
      ],
    },
    {
      name: 'bnext',
      label: 'Next buffer',
      category: 'navigation',
      template: ':bnext {count}',
      description: 'Go to the next buffer in the buffer list.',
      whatItDoes: 'Switches to the next open file in your buffer list.',
      example: ':bnext',
      sourceDoc: ':help :bnext',
      params: [
        {
          name: 'count',
          placeholder: '1',
          description: 'Number of buffers to skip',
        },
      ],
    },
    {
      name: 'bprevious',
      label: 'Previous buffer',
      category: 'navigation',
      template: ':bprevious {count}',
      description: 'Go to the previous buffer in the buffer list.',
      whatItDoes: 'Switches to the previous open file in your buffer list.',
      example: ':bprevious',
      sourceDoc: ':help :bprevious',
      params: [
        {
          name: 'count',
          placeholder: '1',
          description: 'Number of buffers to skip',
        },
      ],
    },
    {
      name: 'buffer',
      label: 'Go to buffer',
      category: 'navigation',
      template: ':buffer {n}',
      description: 'Switch to buffer number n.',
      whatItDoes:
        'Jumps directly to a specific open file by its buffer number.',
      example: ':buffer 5',
      sourceDoc: ':help :buffer',
      params: [{ name: 'n', placeholder: '1', description: 'Buffer number' }],
    },
    {
      name: 'tabnew',
      label: 'New tab',
      category: 'navigation',
      template: ':tabnew {file}',
      description: 'Open a new tab page.',
      whatItDoes: 'Opens a new tab, optionally with a specific file.',
      example: ':tabnew ~/.config/nvim/init.lua',
      sourceDoc: ':help :tabnew',
      params: [
        {
          name: 'file',
          placeholder: '',
          description: 'Optional file to open in new tab',
        },
      ],
    },
    {
      name: 'tabclose',
      label: 'Close tab',
      category: 'navigation',
      template: ':tabclose',
      description: 'Close the current tab page.',
      whatItDoes: 'Closes the current tab and all its windows.',
      example: ':tabclose',
      sourceDoc: ':help :tabclose',
    },
    {
      name: 'tabnext',
      label: 'Next tab',
      category: 'navigation',
      template: ':tabnext {n}',
      description: 'Go to next tab (or tab n).',
      whatItDoes:
        'Switches to the next tab, or jumps to a specific tab number.',
      example: ':tabnext',
      sourceDoc: ':help :tabnext',
      params: [
        { name: 'n', placeholder: '', description: 'Optional tab number' },
      ],
    },
    {
      name: 'tabmove',
      label: 'Move tab',
      category: 'navigation',
      template: ':tabmove {n}',
      description: 'Move the current tab page to position n.',
      whatItDoes:
        'Reorders your tabs by moving the current one to a new position.',
      example: ':tabmove 0',
      sourceDoc: ':help :tabmove',
      params: [
        {
          name: 'n',
          placeholder: '0',
          description: 'Target position (0 = first)',
        },
      ],
    },
    {
      name: 'close',
      label: 'Close split (keeps buffer)',
      category: 'navigation',
      template: ':close',
      description: 'Close the current window.',
      whatItDoes:
        'Closes the current split window without affecting other windows.',
      example: ':close',
      sourceDoc: ':help :close',
    },
    {
      name: 'vsplit',
      label: 'Split vertically',
      category: 'navigation',
      template: ':vsplit {file}',
      description: 'Split window vertically.',
      whatItDoes:
        'Creates a new window to the side of the current one. Optionally opens a file in it.',
      technicalNote: 'Use Ctrl+W then h/l to move between vertical splits.',
      example: ':vsplit',
      sourceDoc: ':help :vsplit',
      isPopular: true,
      params: [
        {
          name: 'file',
          placeholder: '',
          description: 'Optional file to open in new split',
        },
      ],
    },
    {
      name: 'split',
      label: 'Split horizontally',
      category: 'navigation',
      template: ':split {file}',
      description: 'Split window horizontally.',
      whatItDoes:
        'Creates a new window above or below the current one. Optionally opens a file in it.',
      technicalNote: 'Use Ctrl+W then j/k to move between horizontal splits.',
      example: ':split',
      sourceDoc: ':help :split',
      isPopular: true,
      params: [
        {
          name: 'file',
          placeholder: '',
          description: 'Optional file to open in new split',
        },
      ],
    },
    {
      name: 'only',
      label: 'Close other windows',
      category: 'navigation',
      template: ':only',
      description: 'Close all other windows.',
      whatItDoes:
        'Closes all windows except the current one. Quick way to focus on one file.',
      example: ':only',
      sourceDoc: ':help :only',
    },
    // Display category
    {
      name: 'colorscheme',
      label: 'Change theme',
      category: 'display',
      template: ':colorscheme {name}',
      description: 'Load a colorscheme.',
      whatItDoes:
        'Changes the color theme of Neovim. Try different themes to find one you like!',
      technicalNote: 'Use :colorscheme <Tab> to see available themes.',
      example: ':colorscheme slate',
      sourceDoc: ':help :colorscheme',
      isPopular: true,
      params: [
        {
          name: 'name',
          placeholder: 'habamax',
          description: 'Colorscheme name',
        },
      ],
    },
    {
      name: 'nohlsearch',
      label: 'Clear search highlight',
      category: 'display',
      template: ':nohlsearch',
      description: 'Clear search highlight matches.',
      whatItDoes:
        'Removes the yellow highlighting from your last search results.',
      technicalNote:
        'Often mapped to a key like <Esc><Esc> or <leader>h for quick access.',
      example: ':nohlsearch',
      sourceDoc: ':help :nohlsearch',
      isPopular: true,
    },
    {
      name: 'redraw',
      label: 'Refresh screen',
      category: 'display',
      template: ':redraw',
      description: 'Force a screen redraw.',
      whatItDoes:
        'Refreshes the screen display. Useful if something looks glitchy.',
      example: ':redraw!',
      sourceDoc: ':help :redraw',
    },
    {
      name: 'syntax',
      label: 'Toggle syntax colors',
      category: 'display',
      template: ':syntax {state}',
      description: 'Enable or disable syntax highlighting.',
      whatItDoes: 'Turns code coloring on or off. Usually you want this on.',
      example: ':syntax on',
      sourceDoc: ':help :syntax',
      params: [
        { name: 'state', placeholder: 'on/off', description: 'on or off' },
      ],
    },
    {
      name: 'highlight',
      label: 'Show highlight group',
      category: 'display',
      template: ':highlight {group}',
      description: 'Show highlight group definition.',
      whatItDoes:
        'Shows how a specific color group is defined. Useful for theme customization.',
      example: ':highlight Normal',
      sourceDoc: ':help :highlight',
      params: [
        {
          name: 'group',
          placeholder: 'Normal',
          description: 'Highlight group name',
        },
      ],
    },
    {
      name: 'spell_on',
      label: 'Enable spell check',
      category: 'display',
      template: ':set spell',
      description: 'Turn on spell checking.',
      whatItDoes:
        'Turns on spell checking for the current file. Misspelled words will be highlighted.',
      technicalNote: 'Use ]s and [s to jump between misspelled words.',
      example: ':set spell',
      sourceDoc: ':help :set spell',
    },
    {
      name: 'spell_off',
      label: 'Disable spell check',
      category: 'display',
      template: ':set nospell',
      description: 'Turn off spell checking.',
      whatItDoes: 'Turns off spell checking for the current file.',
      example: ':set nospell',
      sourceDoc: ':help :set spell',
    },
    // Diagnostics category
    {
      name: 'checkhealth',
      label: 'Run diagnostics',
      category: 'diagnostics',
      template: ':checkhealth {plugin}',
      description: 'Run built-in diagnostics.',
      whatItDoes:
        'Checks if Neovim and your plugins are set up correctly. Great for troubleshooting!',
      example: ':checkhealth',
      sourceDoc: ':help :checkhealth',
      params: [
        {
          name: 'plugin',
          placeholder: '',
          description: 'Optional plugin name',
        },
      ],
    },
    // Quickfix category
    {
      name: 'copen',
      label: 'Open quickfix list',
      category: 'quickfix',
      template: ':copen',
      description: 'Open the quickfix window.',
      whatItDoes:
        'Opens a window showing all search results, compiler errors, or LSP diagnostics. Click any item to jump to it.',
      technicalNote:
        'The quickfix list is global. Use :lopen for window-local location list.',
      example: ':copen',
      sourceDoc: ':help :copen',
      isPopular: true,
    },
    {
      name: 'cclose',
      label: 'Close quickfix list',
      category: 'quickfix',
      template: ':cclose',
      description: 'Close the quickfix window.',
      whatItDoes: 'Closes the quickfix window if it is open.',
      example: ':cclose',
      sourceDoc: ':help :cclose',
    },
    {
      name: 'cnext',
      label: 'Next quickfix item',
      category: 'quickfix',
      template: ':cnext',
      description: 'Go to the next item in the quickfix list.',
      whatItDoes:
        'Jumps to the next search result or error. Great for stepping through all matches.',
      technicalNote: 'Use :cnext! to also jump to items in other files.',
      example: ':cnext',
      sourceDoc: ':help :cnext',
      isPopular: true,
    },
    {
      name: 'cprevious',
      label: 'Previous quickfix item',
      category: 'quickfix',
      template: ':cprevious',
      description: 'Go to the previous item in the quickfix list.',
      whatItDoes: 'Jumps to the previous search result or error.',
      example: ':cprevious',
      sourceDoc: ':help :cprevious',
    },
    {
      name: 'cfirst',
      label: 'First quickfix item',
      category: 'quickfix',
      template: ':cfirst',
      description: 'Go to the first item in the quickfix list.',
      whatItDoes: 'Jumps to the first search result or error in the list.',
      example: ':cfirst',
      sourceDoc: ':help :cfirst',
    },
    {
      name: 'clast',
      label: 'Last quickfix item',
      category: 'quickfix',
      template: ':clast',
      description: 'Go to the last item in the quickfix list.',
      whatItDoes: 'Jumps to the last search result or error in the list.',
      example: ':clast',
      sourceDoc: ':help :clast',
    },
    // Location List category
    {
      name: 'lopen',
      label: 'Open location list',
      category: 'loclist',
      template: ':lopen',
      description: 'Open the location list window.',
      whatItDoes:
        'Opens the location list window for the current window. Used by LSP features and some plugins.',
      example: ':lopen',
      sourceDoc: ':help :lopen',
    },
    {
      name: 'lclose',
      label: 'Close location list',
      category: 'loclist',
      template: ':lclose',
      description: 'Close the location list window.',
      whatItDoes: 'Closes the location list window if it is open.',
      example: ':lclose',
      sourceDoc: ':help :lclose',
    },
    {
      name: 'lnext',
      label: 'Next location item',
      category: 'loclist',
      template: ':lnext',
      description: 'Go to the next item in the location list.',
      whatItDoes: 'Jumps to the next item in the window-local location list.',
      example: ':lnext',
      sourceDoc: ':help :lnext',
    },
    {
      name: 'lprevious',
      label: 'Previous location item',
      category: 'loclist',
      template: ':lprevious',
      description: 'Go to the previous item in the location list.',
      whatItDoes:
        'Jumps to the previous item in the window-local location list.',
      example: ':lprevious',
      sourceDoc: ':help :lprevious',
    },
    // History category
    {
      name: 'undo',
      label: 'Undo',
      category: 'history',
      template: ':undo',
      description: 'Undo the last change.',
      whatItDoes:
        'Reverses your last edit. Keep pressing to undo more changes.',
      technicalNote:
        'Neovim has unlimited undo. Use :earlier for time-based undo.',
      example: ':undo',
      sourceDoc: ':help :undo',
      isPopular: true,
    },
    {
      name: 'redo',
      label: 'Redo',
      category: 'history',
      template: ':redo',
      description: 'Redo the last undone change.',
      whatItDoes: 'Restores a change you just undid.',
      example: ':redo',
      sourceDoc: ':help :redo',
      isPopular: true,
    },
    {
      name: 'earlier',
      label: 'Earlier state',
      category: 'history',
      template: ':earlier {time}',
      description: 'Go to an earlier text state.',
      whatItDoes:
        'Revert the file to how it looked some time ago. Example: :earlier 5m goes back 5 minutes.',
      technicalNote: 'Accepts time (5m, 1h) or change count (10).',
      example: ':earlier 5m',
      sourceDoc: ':help :earlier',
      params: [
        {
          name: 'time',
          placeholder: '5m',
          description: 'Time (5m, 1h) or change count',
        },
      ],
    },
    // Marks category
    {
      name: 'marks',
      label: 'Show marks',
      category: 'marks',
      template: ':marks',
      description: 'Display all marks.',
      whatItDoes:
        'Shows all the marks you have set and their positions in the file.',
      example: ':marks',
      sourceDoc: ':help :marks',
    },
    {
      name: 'delmarks',
      label: 'Delete marks',
      category: 'marks',
      template: ':delmarks {marks}',
      description: 'Delete specified marks.',
      whatItDoes:
        'Deletes the specified marks. Use :delmarks a b c to delete marks a, b, and c.',
      example: ':delmarks a',
      sourceDoc: ':help :delmarks',
      params: [
        {
          name: 'marks',
          placeholder: 'a b c',
          description: 'Marks to delete (space-separated)',
        },
      ],
    },
    // Search category
    {
      name: 'grep',
      label: 'Search in files',
      category: 'search',
      template: ':grep {pattern} {files}',
      description: 'Run external grep and jump to first match.',
      whatItDoes:
        'Searches for text across multiple files using your system grep.',
      technicalNote:
        'Results go to quickfix list. Use :copen to see all matches.',
      example: ':grep foo *.lua',
      sourceDoc: ':help :grep',
      params: [
        {
          name: 'pattern',
          placeholder: 'pattern',
          description: 'Search pattern',
        },
        { name: 'files', placeholder: '*', description: 'File glob pattern' },
      ],
    },
    {
      name: 'vimgrep',
      label: 'Vim search in files',
      category: 'search',
      template: ':vimgrep {pattern} {files}',
      description: 'Search using Vim regex and jump to first match.',
      whatItDoes: 'Searches for text across files using Vim-style patterns.',
      technicalNote:
        'Slower than :grep but uses Vim regex. Results in quickfix list.',
      example: ':vimgrep /foo/ *.lua',
      sourceDoc: ':help :vimgrep',
      params: [
        {
          name: 'pattern',
          placeholder: '/pattern/',
          description: 'Vim regex pattern',
        },
        {
          name: 'files',
          placeholder: '**/*',
          description: 'File glob pattern',
        },
      ],
    },
    {
      name: 'substitute',
      label: 'Find and replace',
      category: 'search',
      template: ':%s/{pattern}/{replacement}/{flags}',
      description: 'Substitute pattern with replacement.',
      whatItDoes:
        'Finds and replaces text in the current file. Like find-replace in other editors.',
      technicalNote: 'Flags: g=all occurrences, c=confirm each, i=ignore case.',
      example: ':%s/foo/bar/g',
      sourceDoc: ':help :substitute',
      params: [
        {
          name: 'pattern',
          placeholder: 'old',
          description: 'Pattern to search',
        },
        {
          name: 'replacement',
          placeholder: 'new',
          description: 'Replacement text',
        },
        {
          name: 'flags',
          placeholder: 'g',
          description: 'Flags (g=global, c=confirm, i=ignore case)',
        },
      ],
    },
    {
      name: 'global',
      label: 'Run on matching lines',
      category: 'search',
      template: ':g/{pattern}/{command}',
      description: 'Execute command on lines matching pattern.',
      whatItDoes:
        'Runs a command on every line that matches a pattern. Very powerful!',
      technicalNote: 'Example: :g/^$/d deletes all empty lines.',
      example: ':g/^$/d',
      sourceDoc: ':help :global',
      params: [
        {
          name: 'pattern',
          placeholder: 'pattern',
          description: 'Line matching pattern',
        },
        {
          name: 'command',
          placeholder: 'd',
          description: 'Command to execute',
        },
      ],
    },
    // Advanced category
    {
      name: 'set',
      label: 'Change setting',
      category: 'advanced',
      template: ':set {option}',
      description: 'Set an option value.',
      whatItDoes:
        'Changes a Neovim setting. Use the Set Option node for a friendlier UI.',
      example: ':set relativenumber',
      sourceDoc: ':help :set',
      params: [
        {
          name: 'option',
          placeholder: 'number',
          description: 'Option name and value',
        },
      ],
    },
    {
      name: 'lua',
      label: 'Run Lua code',
      category: 'advanced',
      template: ':lua {code}',
      description: 'Run a Lua snippet.',
      whatItDoes:
        'Executes Lua code directly. For advanced users and scripting.',
      example: ':lua vim.notify("done")',
      sourceDoc: ':help :lua',
      params: [
        {
          name: 'code',
          placeholder: 'print("hello")',
          description: 'Lua code to execute',
        },
      ],
    },
    {
      name: 'command',
      label: 'Create command',
      category: 'advanced',
      template: ':command {name} {action}',
      description: 'Create a user-defined command.',
      whatItDoes:
        'Creates a custom command you can run later. For power users.',
      example: ':command W write',
      sourceDoc: ':help :command',
      params: [
        { name: 'name', placeholder: 'MyCmd', description: 'Command name' },
        {
          name: 'action',
          placeholder: 'echo "hi"',
          description: 'Command action',
        },
      ],
    },
    {
      name: 'normal',
      label: 'Run normal keys',
      category: 'advanced',
      template: ':normal {commands}',
      description: 'Execute Normal mode commands.',
      whatItDoes: 'Simulates pressing keys in normal mode. Useful in scripts.',
      example: ':normal ggVG',
      sourceDoc: ':help :normal',
      params: [
        {
          name: 'commands',
          placeholder: 'gg',
          description: 'Normal mode commands',
        },
      ],
    },
    {
      name: 'silent',
      label: 'Run silently',
      category: 'advanced',
      template: ':silent {command}',
      description: 'Execute a command silently (suppress messages).',
      whatItDoes: 'Runs a command without showing any messages or prompts.',
      example: ':silent !make',
      sourceDoc: ':help :silent',
      params: [
        {
          name: 'command',
          placeholder: 'echo "quiet"',
          description: 'Command to execute silently',
        },
      ],
    },
    {
      name: 'help',
      label: 'Open help',
      category: 'advanced',
      template: ':help {subject}',
      description: 'Open help for subject.',
      whatItDoes:
        "Opens Neovim's built-in help documentation. Great for learning!",
      example: ':help buffers',
      sourceDoc: ':help :help',
      params: [
        { name: 'subject', placeholder: 'topic', description: 'Help topic' },
      ],
    },
  ]

export const NEOVIM_EX_COMMAND_NAMES: readonly string[] =
  NEOVIM_EX_COMMAND_CATALOG.map((entry) => entry.name)

const exCommandByName = new Map<string, NeovimExCommandCatalogEntry>(
  NEOVIM_EX_COMMAND_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]),
)

function normalizeExCommandName(rawValue: string): string | null {
  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    return null
  }

  const withoutColon = trimmed.startsWith(':') ? trimmed.slice(1) : trimmed
  const [commandName] = withoutColon.split(/\s+/, 1)
  return commandName ? commandName.toLowerCase() : null
}

export function getNeovimExCommand(
  rawValue: string,
): NeovimExCommandCatalogEntry | null {
  const normalizedName = normalizeExCommandName(rawValue)
  if (!normalizedName) {
    return null
  }
  return exCommandByName.get(normalizedName) ?? null
}

export function groupExCommandsByCategory(
  entries: readonly NeovimExCommandCatalogEntry[],
): Map<ExCommandCategory, NeovimExCommandCatalogEntry[]> {
  const groups = new Map<ExCommandCategory, NeovimExCommandCatalogEntry[]>()
  for (const entry of entries) {
    const existing = groups.get(entry.category)
    if (existing) {
      existing.push(entry)
      continue
    }
    groups.set(entry.category, [entry])
  }
  return groups
}

// ============================================
// Unified Ex Command List (includes plugin commands)
// ============================================

import type { InstalledPlugin, ResolvedSchema } from '@/shared/types'

export interface UnifiedExCommand {
  /** Unique key for React rendering: 'builtin:write' or 'plugin:telescope-nvim:Telescope' */
  key: string
  /** Command name (e.g. 'write', 'Telescope') */
  name: string
  /** Description */
  description: string
  /** Template (e.g. ':write', ':Telescope find_files') */
  template: string
  /** Example */
  example: string
  /** Help reference */
  sourceDoc: string
  /** Source: 'builtin' or plugin name */
  source: string
  /** Optional parameters for template substitution */
  params?: CommandParameter[]
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Plugin command extraction with validation — complexity inherent in processing variable schema data
function collectPluginExCommands(
  schemas: readonly ResolvedSchema[],
  enabledSchemaIds: Set<string>,
): UnifiedExCommand[] {
  const result: UnifiedExCommand[] = []

  for (const { schema } of schemas) {
    if (!enabledSchemaIds.has(schema.id)) continue
    if (!schema.exCommands || schema.exCommands.length === 0) continue

    for (const cmd of schema.exCommands) {
      // Defensive: skip commands with missing required fields
      if (
        typeof cmd.name !== 'string' ||
        cmd.name === '' ||
        typeof cmd.description !== 'string' ||
        typeof cmd.template !== 'string' ||
        typeof cmd.example !== 'string' ||
        typeof cmd.sourceDoc !== 'string'
      ) {
        continue
      }

      const unified: UnifiedExCommand = {
        key: `plugin:${schema.id}:${cmd.name}`,
        name: cmd.name,
        description: cmd.description,
        template: cmd.template,
        example: cmd.example,
        sourceDoc: cmd.sourceDoc,
        source: schema.pluginName,
      }

      // Defensive: only map params if it's actually an array of valid objects
      if (Array.isArray(cmd.params) && cmd.params.length > 0) {
        const validParams: CommandParameter[] = []
        for (const p of cmd.params) {
          if (
            typeof p === 'object' &&
            p !== null &&
            typeof p.name === 'string' &&
            typeof p.placeholder === 'string' &&
            typeof p.description === 'string'
          ) {
            validParams.push({
              name: p.name,
              placeholder: p.placeholder,
              description: p.description,
            })
          }
        }
        if (validParams.length > 0) {
          unified.params = validParams
        }
      }

      result.push(unified)
    }
  }

  return result
}

export function buildUnifiedExCommandList(
  schemas: readonly ResolvedSchema[],
  installedPlugins: readonly InstalledPlugin[],
): UnifiedExCommand[] {
  const result: UnifiedExCommand[] = []

  // 1. Add all built-in commands
  for (const entry of NEOVIM_EX_COMMAND_CATALOG) {
    const unifiedCmd: UnifiedExCommand = {
      key: `builtin:${entry.name}`,
      name: entry.name,
      description: entry.description,
      template: entry.template,
      example: entry.example,
      sourceDoc: entry.sourceDoc,
      source: 'builtin',
    }
    if (entry.params !== undefined && entry.params.length > 0) {
      unifiedCmd.params = entry.params
    }
    result.push(unifiedCmd)
  }

  // 2. Add plugin Ex commands
  const enabledSchemaIds = new Set(
    installedPlugins.filter((p) => p.enabled).map((p) => p.schemaId),
  )
  result.push(...collectPluginExCommands(schemas, enabledSchemaIds))

  return result
}

// ============================================
// Command Parameter Resolution
// ============================================

/**
 * Resolves a command template by substituting {param} placeholders with values.
 * Missing or empty param values result in the placeholder being removed.
 * @param template - The command template with {param} placeholders
 * @param paramValues - Record mapping param names to their values
 * @returns The resolved command string
 */
export function resolveCommandTemplate(
  template: string,
  paramValues: Readonly<Record<string, string>>,
): string {
  return template
    .replace(/\{(\w+)\}/g, (_match, paramName) => {
      const value = paramValues[paramName]
      return value !== undefined && value.length > 0 ? value : ''
    })
    .trim()
}

/**
 * Checks if a command has parameters defined.
 * @param command - The unified command to check
 * @returns true if the command has params array with at least one item
 */
export function hasCommandParams(
  command: UnifiedExCommand | undefined | null,
): boolean {
  return (
    command !== undefined &&
    command !== null &&
    command.params !== undefined &&
    command.params.length > 0
  )
}
