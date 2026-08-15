/**
 * Neovim Options Catalog
 *
 * A comprehensive catalog of 67 Neovim options with beginner-friendly
 * labels, descriptions, and metadata. Used by both the settings page
 * and graph editor for consistent option configuration.
 */

import type {
  NeovimOptionCategory,
  NeovimOptionDefinition,
} from '@/shared/types/neovim-options'

// ============================================
// Helper for creating list defaults
// ============================================

function listDefault(value: string): readonly string[] {
  return value === '' ? [] : value.split(',').filter((s) => s.length > 0)
}

// ============================================
// Keymaps Category (1 option - leader key)
// ============================================

/**
 * Special marker for the leader key option.
 * This option uses vim.g.mapleader instead of vim.opt.
 */
export const LEADER_KEY_OPTION_NAME = 'mapleader'

const KEYMAPS_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: LEADER_KEY_OPTION_NAME,
    label: 'Leader Key',
    whatItDoes:
      'The key that starts most of your custom shortcuts. Press this key first, then other keys to trigger actions.',
    whenToUse:
      'Set this to a comfortable key like Space. Most modern configs use Space as the leader key.',
    technicalNote:
      'Sets vim.g.mapleader. Must be set before any keymaps that use <leader>. Using <leader> in shortcuts makes them portable.',
    category: 'keymaps',
    valueType: 'string',
    defaultValue: '\\', // Vim's default is backslash
    defaultSource: 'Vim default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['leader', 'mapleader', 'prefix key', 'shortcut prefix'],
  },
]

// ============================================
// Line Numbers Category (2 options)
// ============================================

const LINE_NUMBER_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'number',
    label: 'Show line numbers',
    whatItDoes: 'Displays the line number at the start of each line.',
    whenToUse:
      "Turn this on if you want to see which line you're on, useful for navigating and discussing code.",
    technicalNote:
      'When both number and relativenumber are on, the current line shows absolute number while others show relative.',
    category: 'line-numbers',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
  },
  {
    name: 'relativenumber',
    label: 'Show relative line numbers',
    whatItDoes: 'Shows how many lines away each line is from your cursor.',
    whenToUse:
      'Great for quickly jumping up or down a specific number of lines (like `5j` to go down 5 lines).',
    technicalNote:
      'Combine with number for hybrid line numbers. Useful for motions like 10j, 5k.',
    category: 'line-numbers',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['relative numbers', 'rnu'],
  },
]

// ============================================
// Visual Appearance Category (18 options)
// ============================================

const VISUAL_APPEARANCE_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'cursorline',
    label: 'Highlight current line',
    whatItDoes:
      'Adds a subtle background highlight to the line your cursor is on.',
    whenToUse:
      "Helps you quickly spot where you're editing, especially in long files.",
    category: 'visual-appearance',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: false,
  },
  {
    name: 'cursorcolumn',
    label: 'Highlight current column',
    whatItDoes:
      'Adds a vertical highlight through the column your cursor is in.',
    whenToUse:
      'Useful for aligning text or code vertically. Most people leave this off.',
    category: 'visual-appearance',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'signcolumn',
    label: 'Sign column visibility',
    whatItDoes:
      'Controls the column on the left that shows icons (errors, git changes, breakpoints).',
    whenToUse:
      'Set to "Always show" if you use plugins that show icons, prevents layout jumping.',
    technicalNote:
      'The sign column is where LSP diagnostics, git signs, and other indicators appear.',
    category: 'visual-appearance',
    valueType: 'string',
    defaultValue: 'auto',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    choices: [
      {
        value: 'auto',
        label: 'Show when needed',
        description: 'Only appears when there are signs to show',
      },
      {
        value: 'yes',
        label: 'Always show',
        description: 'Always visible, prevents layout shifting',
      },
      {
        value: 'no',
        label: 'Never show',
        description: 'Hidden, gives more space for text',
      },
      {
        value: 'number',
        label: 'Use line number column',
        description: 'Shows signs in the line number column',
      },
    ],
  },
  {
    name: 'colorcolumn',
    label: 'Line length guide',
    whatItDoes: 'Shows a vertical line at a specific column (like 80 or 120).',
    whenToUse:
      'Helps you keep lines under a certain length for code style guidelines.',
    technicalNote:
      'You can set multiple columns like "80,120" for multiple guides.',
    category: 'visual-appearance',
    valueType: 'string',
    defaultValue: '',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'termguicolors',
    label: 'Use full colors',
    whatItDoes:
      'Enables 24-bit color support for richer, more accurate colors.',
    whenToUse: 'Turn this on for modern color schemes to look correct.',
    technicalNote:
      'Required for most themes to display correctly. Checks if your terminal supports true color.',
    category: 'visual-appearance',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['true color', '24-bit color', 'tgc'],
  },
  {
    name: 'background',
    label: 'Color scheme hint',
    whatItDoes:
      'Tells Neovim whether your terminal background is dark or light.',
    whenToUse:
      'Set this to match your terminal so colors are chosen appropriately.',
    category: 'visual-appearance',
    valueType: 'string',
    defaultValue: 'dark',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: false,
    choices: [
      {
        value: 'dark',
        label: 'Dark background',
        description: 'Optimizes colors for dark terminals',
      },
      {
        value: 'light',
        label: 'Light background',
        description: 'Optimizes colors for light terminals',
      },
    ],
  },
  {
    name: 'winborder',
    label: 'Floating window borders',
    whatItDoes: 'Sets the default border style for popup windows.',
    whenToUse:
      'Add borders to make floating windows (like hover docs) easier to see.',
    category: 'visual-appearance',
    valueType: 'string',
    defaultValue: '',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
    choices: [
      {
        value: '',
        label: 'No border',
        description: 'Clean look, no borders',
      },
      {
        value: 'single',
        label: 'Single line',
        description: 'Simple single-line border',
      },
      {
        value: 'double',
        label: 'Double line',
        description: 'Thicker double-line border',
      },
      {
        value: 'rounded',
        label: 'Rounded corners',
        description: 'Modern look with rounded corners',
      },
      {
        value: 'solid',
        label: 'Solid',
        description: 'Filled border style',
      },
      {
        value: 'shadow',
        label: 'Shadow',
        description: 'Drop shadow effect',
      },
    ],
  },
  {
    name: 'showmode',
    label: 'Show mode indicator',
    whatItDoes:
      'Displays text like "-- INSERT --" at the bottom when you change modes.',
    whenToUse: 'Turn off if your statusline plugin already shows the mode.',
    category: 'visual-appearance',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'showcmd',
    label: 'Show partial commands',
    whatItDoes:
      'Shows incomplete commands as you type them (like `d` waiting for a motion).',
    whenToUse: 'Helpful for learning, but can be turned off once comfortable.',
    category: 'visual-appearance',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'cmdheight',
    label: 'Command area height',
    whatItDoes: 'How many lines tall the command area at the bottom is.',
    whenToUse:
      'Increase if you want to see longer messages without pressing Enter.',
    category: 'visual-appearance',
    valueType: 'number',
    defaultValue: 1,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 10,
  },
  {
    name: 'laststatus',
    label: 'Status line visibility',
    whatItDoes:
      'Controls when the status line is shown (never, only with splits, always).',
    whenToUse: 'Usually leave at "always" (2) unless you want a minimal look.',
    technicalNote: '0 = never, 1 = with multiple windows, 2 = always',
    category: 'visual-appearance',
    valueType: 'number',
    defaultValue: 2,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 3,
  },
  {
    name: 'showtabline',
    label: 'Tab bar visibility',
    whatItDoes:
      'Controls when the tab bar is shown (never, when multiple tabs, always).',
    whenToUse: 'Set based on whether you use tabs and want to always see them.',
    technicalNote: '0 = never, 1 = with multiple tabs, 2 = always',
    category: 'visual-appearance',
    valueType: 'number',
    defaultValue: 1,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 2,
  },
  {
    name: 'winblend',
    label: 'Floating window transparency',
    whatItDoes:
      'Controls how transparent floating windows appear. Lower values are more opaque.',
    whenToUse:
      'Set to a value between 10-30 for subtle transparency on floating windows.',
    technicalNote: 'Range: 0-100. 0 = opaque, 100 = fully transparent.',
    category: 'visual-appearance',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 100,
    searchAliases: [
      'floating transparency',
      'popup transparency',
      'window blend',
    ],
  },
  {
    name: 'pumblend',
    label: 'Popup menu transparency',
    whatItDoes: 'Controls how transparent the completion popup menu appears.',
    whenToUse:
      'Set to a value between 10-30 for subtle transparency on completion menus.',
    technicalNote:
      'Range: 0-100. 0 = opaque, 100 = fully transparent. Affects the popup menu (pum) used for completions.',
    category: 'visual-appearance',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 100,
    searchAliases: [
      'completion transparency',
      'menu transparency',
      'popup blend',
    ],
  },
  {
    name: 'conceallevel',
    label: 'Text conceal level',
    whatItDoes:
      'Determines how much concealed text is hidden. Concealed text is markup like bold markers in Markdown.',
    whenToUse:
      'Set to 2 in Markdown files to hide formatting characters like ** for bold.',
    technicalNote:
      'Range: 0-3. 0 = show all, 1 = hide short ones, 2 = hide most, 3 = hide all.',
    category: 'visual-appearance',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
    min: 0,
    max: 3,
    searchAliases: ['hide markup', 'conceal text', 'markdown formatting'],
  },
  {
    name: 'title',
    label: 'Show window title',
    whatItDoes: 'Sets the terminal window title to show the current filename.',
    whenToUse:
      'Turn on if your terminal supports window titles and you want to see which file is open.',
    technicalNote:
      'The titlestring option controls the format. By default shows "filename [+][help] - VIM".',
    category: 'visual-appearance',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    searchAliases: ['window title', 'terminal title', 'tab title'],
  },
  {
    name: 'shortmess',
    label: 'Short message flags',
    whatItDoes:
      'Controls which messages are shortened or suppressed. Reduces visual clutter.',
    whenToUse:
      'Customize to reduce message noise. Common to add "I" to hide intro message.',
    technicalNote:
      'Each letter controls a different message type. See :help shortmess for full list.',
    category: 'visual-appearance',
    valueType: 'string',
    defaultValue: 'filnxtToOF',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    searchAliases: ['short messages', 'message flags', 'quiet messages'],
  },
  {
    name: 'fillchars',
    label: 'UI fill characters',
    whatItDoes:
      'Defines characters used for filling UI elements like fold lines, diff markers, and vertical splits.',
    whenToUse:
      'Customize to match your preferred style. Common to use thin lines for splits.',
    technicalNote:
      'Format: "key:char,key:char". Keys: vert, fold, diff, msgsep, eob, foldopen, foldsep, foldclose.',
    category: 'visual-appearance',
    valueType: 'string',
    defaultValue: '',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    searchAliases: ['fill chars', 'separator chars', 'fold chars', 'UI chars'],
  },
]

// ============================================
// Text Wrapping Category (5 options)
// ============================================

const TEXT_WRAPPING_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'wrap',
    label: 'Wrap long lines',
    whatItDoes:
      'When a line is too long, shows it wrapped onto multiple screen lines.',
    whenToUse:
      'Turn on for prose/markdown, turn off for code where you want to scroll horizontally.',
    category: 'text-wrapping',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'linebreak',
    label: 'Wrap at word boundaries',
    whatItDoes: 'When wrapping, breaks at word boundaries instead of mid-word.',
    whenToUse: 'Turn on with wrap to avoid words being split awkwardly.',
    category: 'text-wrapping',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: true,
    dependencies: [
      {
        optionName: 'wrap',
        requiredValue: true,
        hint: "Requires 'Wrap long lines' to be enabled to have any effect",
      },
    ],
  },
  {
    name: 'breakindent',
    label: 'Indent wrapped lines',
    whatItDoes: 'Wrapped lines keep the same indentation as the original line.',
    whenToUse:
      'Makes wrapped code much easier to read by preserving visual structure.',
    category: 'text-wrapping',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: true,
    dependencies: [
      {
        optionName: 'wrap',
        requiredValue: true,
        hint: "Requires 'Wrap long lines' to be enabled to have any effect",
      },
    ],
  },
  {
    name: 'list',
    label: 'Show invisible characters',
    whatItDoes:
      'Displays symbols for tabs, trailing spaces, and other whitespace.',
    whenToUse: 'Turn on to spot unwanted whitespace or see exact indentation.',
    category: 'text-wrapping',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'listchars',
    label: 'Invisible character symbols',
    whatItDoes:
      'Defines which symbols to use for tabs, spaces, etc. when "Show invisible characters" is on.',
    whenToUse:
      'Customize to your preference, common to show tabs and trailing spaces.',
    technicalNote: 'Common values: tab:▸ ,trail:·,extends:⟩,precedes:⟨,nbsp:␣',
    category: 'text-wrapping',
    valueType: 'string',
    defaultValue: 'tab:> ,trail:-,nbsp:+',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    dependencies: [
      {
        optionName: 'list',
        requiredValue: true,
        hint: "Requires 'Show invisible characters' to be enabled to see the symbols",
      },
    ],
  },
]

// ============================================
// Indentation Category (12 options)
// ============================================

const INDENTATION_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'expandtab',
    label: 'Use spaces instead of tabs',
    whatItDoes: 'Pressing Tab inserts spaces instead of a tab character.',
    whenToUse:
      "Most modern projects prefer spaces. Check your project's style guide.",
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['spaces', 'tabs vs spaces'],
  },
  {
    name: 'tabstop',
    label: 'Tab display width',
    whatItDoes: 'How wide a tab character appears (in spaces).',
    whenToUse: "Set to match your project's style (commonly 2 or 4).",
    category: 'indentation',
    valueType: 'number',
    defaultValue: 8,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    min: 1,
    max: 9999,
    searchAliases: ['tabs', 'tab width', 'tab size'],
  },
  {
    name: 'shiftwidth',
    label: 'Indent size',
    whatItDoes:
      'How many spaces to use when indenting with >> or automatic indentation.',
    whenToUse: 'Usually set this to match your tab width for consistency.',
    category: 'indentation',
    valueType: 'number',
    defaultValue: 8,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    min: 0,
    max: 9999,
    searchAliases: ['indent', 'indentation'],
  },
  {
    name: 'softtabstop',
    label: 'Tab key behavior',
    whatItDoes:
      'How many spaces the Tab key inserts/removes. Set to -1 to match shiftwidth.',
    whenToUse: 'Set to match shiftwidth for consistent behavior.',
    technicalNote:
      'Value of 0 means use tabstop value. Value of -1 means use shiftwidth (recommended).',
    category: 'indentation',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
    min: -1,
    max: 9999,
  },
  {
    name: 'smarttab',
    label: 'Smart tab in leading whitespace',
    whatItDoes: 'Tab key uses indent size at line start, tab width elsewhere.',
    whenToUse: 'Usually leave on for intuitive behavior.',
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'autoindent',
    label: 'Copy indent from previous line',
    whatItDoes: 'New lines start with the same indentation as the line above.',
    whenToUse: 'Almost always want this on for any kind of coding.',
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: true,
  },
  {
    name: 'smartindent',
    label: 'Smart code indentation',
    whatItDoes:
      'Automatically adjusts indent for code structures (like after `{`).',
    whenToUse:
      'Good for C-style languages, but many use treesitter/LSP instead now.',
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
  },
  {
    name: 'copyindent',
    label: 'Preserve indent characters',
    whatItDoes:
      'When auto-indenting, copies the exact whitespace characters used above.',
    whenToUse: 'Turn on if you want to preserve mixed tabs/spaces exactly.',
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'preserveindent',
    label: 'Keep indent structure on changes',
    whatItDoes:
      'When changing indent, tries to keep existing whitespace structure.',
    whenToUse: 'Rarely needed, for special formatting requirements.',
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'shiftround',
    label: 'Round indents to multiple',
    whatItDoes:
      'Indent operations round to the nearest multiple of indent size.',
    whenToUse: 'Keeps indentation clean and consistent.',
    category: 'indentation',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'textwidth',
    label: 'Auto-wrap text width',
    whatItDoes:
      'Automatically wraps text when lines exceed this length (0 = disabled).',
    whenToUse:
      'Set for prose writing or if your style guide requires line length limits.',
    category: 'indentation',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 9999,
  },
  {
    name: 'formatoptions',
    label: 'Auto-formatting rules',
    whatItDoes:
      'Controls automatic formatting behaviors (comments, paragraphs, etc.).',
    whenToUse: 'Advanced: customize how Neovim auto-formats text.',
    technicalNote:
      'Each character enables a specific auto-format behavior. See :help fo-table.',
    category: 'indentation',
    valueType: 'char-list',
    defaultValue: listDefault('tcqj'),
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    choices: [
      {
        value: 't',
        label: 'Auto-wrap text',
        description: 'Automatically wrap text at textwidth',
      },
      {
        value: 'c',
        label: 'Auto-wrap comments',
        description: 'Automatically wrap comments at textwidth',
      },
      {
        value: 'q',
        label: 'Allow formatting with gq',
        description: 'Enable gq command for formatting',
      },
      {
        value: 'j',
        label: 'Remove comment leader when joining',
        description: 'Smart comment joining',
      },
      {
        value: 'r',
        label: 'Continue comments on Enter',
        description: 'Auto-insert comment leader on new line',
      },
      {
        value: 'o',
        label: 'Continue comments on o/O',
        description: 'Auto-insert comment leader with o/O',
      },
      {
        value: 'n',
        label: 'Recognize numbered lists',
        description: 'Format numbered lists properly',
      },
      {
        value: 'a',
        label: 'Auto-format paragraphs',
        description: 'Reformat paragraph on any change',
      },
    ],
  },
]

// ============================================
// Search Category (8 options)
// ============================================

const SEARCH_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'ignorecase',
    label: 'Ignore case in searches',
    whatItDoes: 'Searches match regardless of uppercase/lowercase.',
    whenToUse:
      'Turn on for more flexible searching, combine with "Smart case" below.',
    category: 'search',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['case insensitive', 'case sensitive'],
  },
  {
    name: 'smartcase',
    label: 'Smart case sensitivity',
    whatItDoes:
      'If your search has uppercase letters, it becomes case-sensitive.',
    whenToUse: 'Use with "Ignore case" for best of both worlds.',
    category: 'search',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    dependencies: [
      {
        optionName: 'ignorecase',
        requiredValue: true,
        hint: "Requires 'Ignore case in searches' to be enabled to work",
      },
    ],
  },
  {
    name: 'hlsearch',
    label: 'Highlight all matches',
    whatItDoes: 'Keeps all search matches highlighted until you clear them.',
    whenToUse: 'Useful to see all occurrences, use :noh to clear highlights.',
    category: 'search',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'incsearch',
    label: 'Show matches while typing',
    whatItDoes: 'Highlights matches as you type your search pattern.',
    whenToUse: 'Almost always want this on for immediate feedback.',
    category: 'search',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: true,
  },
  {
    name: 'inccommand',
    label: 'Live substitution preview',
    whatItDoes: 'Shows a preview of substitutions as you type the command.',
    whenToUse: 'Great for seeing exactly what will change before confirming.',
    category: 'search',
    valueType: 'string',
    defaultValue: 'nosplit',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    choices: [
      {
        value: 'nosplit',
        label: 'Preview in place',
        description: 'Shows preview in the buffer itself',
      },
      {
        value: 'split',
        label: 'Preview in split window',
        description: 'Shows preview in a separate split',
      },
      {
        value: '',
        label: 'No preview',
        description: 'Disables live preview',
      },
    ],
  },
  {
    name: 'wrapscan',
    label: 'Wrap around when searching',
    whatItDoes:
      'Search continues from the start when it reaches the end of the file.',
    whenToUse:
      'Usually leave on, turn off if you want searches to stop at file boundaries.',
    category: 'search',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'scrolloff',
    label: 'Vertical scroll margin',
    whatItDoes: 'Keeps this many lines visible above and below your cursor.',
    whenToUse: 'Set to 5-10 to always see context around your cursor.',
    category: 'search',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    min: 0,
    max: 999,
    searchAliases: ['scroll margin', 'cursor margin'],
  },
  {
    name: 'sidescrolloff',
    label: 'Horizontal scroll margin',
    whatItDoes:
      'Keeps this many columns visible to the left and right of your cursor.',
    whenToUse: 'Useful when wrap is off and you scroll horizontally.',
    category: 'search',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 999,
  },
]

// ============================================
// File Handling Category (8 options)
// ============================================

const FILE_HANDLING_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'undofile',
    label: 'Persistent undo history',
    whatItDoes:
      'Saves undo history to disk so you can undo changes even after closing.',
    whenToUse:
      'Highly recommended - lets you undo changes from previous sessions.',
    technicalNote:
      'Undo files are stored in a central location (usually ~/.local/state/nvim/undo/)',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['persistent undo', 'undo history'],
  },
  {
    name: 'undolevels',
    label: 'Undo history depth',
    whatItDoes: 'How many changes to remember in the undo tree.',
    whenToUse:
      'Default is usually fine, increase if you want more undo history.',
    category: 'file-handling',
    valueType: 'number',
    defaultValue: 1000,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 1,
    max: 100000,
  },
  {
    name: 'swapfile',
    label: 'Use swap files',
    whatItDoes: 'Creates temporary files for crash recovery.',
    whenToUse: 'Leave on for safety, turn off if swap files cause issues.',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'backup',
    label: 'Keep backup files',
    whatItDoes: 'Keeps a backup copy after saving a file.',
    whenToUse:
      'Usually not needed with version control, can clutter directories.',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'writebackup',
    label: 'Backup while saving',
    whatItDoes: 'Creates a temporary backup during the save process.',
    whenToUse: 'Safety feature, usually leave on.',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'autoread',
    label: 'Auto-reload changed files',
    whatItDoes: 'Automatically reloads files that changed outside Neovim.',
    whenToUse: 'Useful when external tools modify files you have open.',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: true,
  },
  {
    name: 'autowrite',
    label: 'Auto-save on commands',
    whatItDoes:
      'Automatically saves when running certain commands or switching files.',
    whenToUse:
      'Convenient but can be surprising. Consider explicit saves instead.',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'hidden',
    label: 'Allow unsaved background files',
    whatItDoes:
      'Lets you switch away from files with unsaved changes without saving.',
    whenToUse: 'Almost always want this on for smooth buffer switching.',
    technicalNote:
      'Without this, Neovim forces you to save or discard changes before switching buffers.',
    category: 'file-handling',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: true,
    searchAliases: ['unsaved buffers', 'buffer switching'],
  },
]

// ============================================
// Windows and Splits Category (4 options)
// ============================================

const WINDOWS_SPLITS_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'splitright',
    label: 'New splits open right',
    whatItDoes:
      'Vertical splits (:vsplit) open to the right of the current window.',
    whenToUse: 'More intuitive for most people than the default (left).',
    category: 'windows-splits',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['vsplit', 'vertical split'],
  },
  {
    name: 'splitbelow',
    label: 'New splits open below',
    whatItDoes: 'Horizontal splits (:split) open below the current window.',
    whenToUse: 'More intuitive for most people than the default (above).',
    category: 'windows-splits',
    valueType: 'boolean',
    defaultValue: false,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['hsplit', 'horizontal split'],
  },
  {
    name: 'mouse',
    label: 'Mouse support',
    whatItDoes: 'Enables mouse for clicking, selecting, and scrolling.',
    whenToUse: 'Turn on if you want to use your mouse in Neovim.',
    category: 'windows-splits',
    valueType: 'string',
    defaultValue: 'nvi',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: false,
    isCommunityRecommended: false,
    choices: [
      {
        value: '',
        label: 'Disabled',
        description: 'No mouse support',
      },
      {
        value: 'n',
        label: 'Normal mode only',
        description: 'Mouse works only in normal mode',
      },
      {
        value: 'v',
        label: 'Visual mode only',
        description: 'Mouse works only in visual mode',
      },
      {
        value: 'i',
        label: 'Insert mode only',
        description: 'Mouse works only in insert mode',
      },
      {
        value: 'a',
        label: 'All modes',
        description: 'Mouse works everywhere',
      },
      {
        value: 'nvi',
        label: 'Normal, Visual, Insert',
        description: 'Mouse works in most modes (default)',
      },
    ],
  },
  {
    name: 'virtualedit',
    label: 'Cursor beyond text',
    whatItDoes: "Allows cursor to move where there's no actual text.",
    whenToUse: 'Useful for editing tables or ASCII art. Most leave this off.',
    category: 'windows-splits',
    valueType: 'string',
    defaultValue: '',
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    choices: [
      {
        value: '',
        label: 'Disabled',
        description: 'Cursor stays on actual text',
      },
      {
        value: 'block',
        label: 'Visual block mode',
        description: 'Virtual editing in visual block only',
      },
      {
        value: 'insert',
        label: 'Insert mode',
        description: 'Virtual editing in insert mode',
      },
      {
        value: 'all',
        label: 'Everywhere',
        description: 'Virtual editing in all modes',
      },
      {
        value: 'onemore',
        label: 'One past end',
        description: 'Allow cursor one position past line end',
      },
    ],
  },
]

// ============================================
// Completion Category (5 options)
// ============================================

const COMPLETION_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'completeopt',
    label: 'Completion menu behavior',
    whatItDoes: 'Controls how the autocomplete popup menu works.',
    whenToUse: 'Customize for your completion plugin (nvim-cmp, etc.).',
    technicalNote:
      'Multiple values can be combined. See :help completeopt for details.',
    category: 'completion',
    valueType: 'string-list',
    defaultValue: listDefault('menu,popup'),
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
    choices: [
      {
        value: 'menu',
        label: 'Show menu',
        description: 'Show popup menu with completions',
      },
      {
        value: 'menuone',
        label: 'Show menu even for one match',
        description: 'Show menu even with single match',
      },
      {
        value: 'noinsert',
        label: "Don't auto-insert",
        description: "Don't insert until you select",
      },
      {
        value: 'noselect',
        label: "Don't auto-select",
        description: "Don't pre-select first item",
      },
      {
        value: 'preview',
        label: 'Show preview',
        description: 'Show extra info in preview window',
      },
      {
        value: 'popup',
        label: 'Use popup for preview',
        description: 'Show preview in popup instead of split',
      },
    ],
  },
  {
    name: 'pumheight',
    label: 'Completion menu max height',
    whatItDoes:
      'Maximum number of items shown in the completion popup (0 = unlimited).',
    whenToUse: 'Set to 10-15 to prevent the menu from taking over your screen.',
    category: 'completion',
    valueType: 'number',
    defaultValue: 0,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    min: 0,
    max: 999,
  },
  {
    name: 'wildmenu',
    label: 'Command completion menu',
    whatItDoes: 'Shows a visual menu when tab-completing commands.',
    whenToUse: 'Usually leave on for better command-line completion.',
    category: 'completion',
    valueType: 'boolean',
    defaultValue: true,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
  {
    name: 'wildmode',
    label: 'Command completion style',
    whatItDoes: 'How command-line completion behaves when you press Tab.',
    whenToUse: 'Customize the completion sequence to your preference.',
    technicalNote:
      'This option is order-sensitive. The values define a sequence: first Tab uses first value, etc.',
    category: 'completion',
    valueType: 'string-list',
    defaultValue: listDefault('full'),
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    isOrderSensitive: true,
    choices: [
      {
        value: 'full',
        label: 'Complete fully',
        description: 'Complete to full match, cycle through options',
      },
      {
        value: 'longest',
        label: 'Complete to longest common',
        description: 'Complete only the common part',
      },
      {
        value: 'longest:full',
        label: 'Longest, then full',
        description: 'First longest common, then full on next Tab',
      },
      {
        value: 'list',
        label: 'List all matches',
        description: 'Show all matches in a list',
      },
      {
        value: 'list:full',
        label: 'List, then full',
        description: 'Show list, then complete fully',
      },
      {
        value: 'list:longest',
        label: 'List, then longest',
        description: 'Show list, then complete to longest',
      },
    ],
  },
  {
    name: 'wildignore',
    label: 'Completion ignore patterns',
    whatItDoes:
      'File patterns to ignore in file completion (like *.pyc, node_modules).',
    whenToUse: 'Add patterns for files you never want to open.',
    category: 'completion',
    valueType: 'string-list',
    defaultValue: listDefault(''),
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
  },
]

// ============================================
// Clipboard and System Category (2 options)
// ============================================

const CLIPBOARD_SYSTEM_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'clipboard',
    label: 'System clipboard integration',
    whatItDoes: "Connects Neovim's copy/paste to your system clipboard.",
    whenToUse:
      'Set to "unnamedplus" to copy/paste with your system like other apps.',
    category: 'clipboard-system',
    valueType: 'string-list',
    defaultValue: listDefault(''),
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'basic',
    isPopular: true,
    isCommunityRecommended: true,
    searchAliases: ['copy paste', 'system clipboard', 'yank'],
    choices: [
      {
        value: '',
        label: 'Neovim only',
        description: 'Copy/paste stays within Neovim',
      },
      {
        value: 'unnamed',
        label: 'Use * register',
        description: 'Sync with system selection (middle-click paste on Linux)',
      },
      {
        value: 'unnamedplus',
        label: 'Use + register',
        description: 'Sync with system clipboard (Ctrl+C/V style)',
      },
    ],
  },
  {
    name: 'whichwrap',
    label: 'Keys that wrap to next line',
    whatItDoes:
      'Which movement keys can move from end of line to start of next.',
    whenToUse: 'Customize if you want arrow keys or h/l to wrap across lines.',
    category: 'clipboard-system',
    valueType: 'char-list',
    defaultValue: listDefault('b,s'),
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: false,
    choices: [
      {
        value: 'b',
        label: 'Backspace',
        description: 'Backspace wraps to previous line',
      },
      {
        value: 's',
        label: 'Space',
        description: 'Space wraps to next line',
      },
      {
        value: 'h',
        label: 'h key',
        description: 'h wraps to previous line',
      },
      {
        value: 'l',
        label: 'l key',
        description: 'l wraps to next line',
      },
      {
        value: '<',
        label: 'Left arrow (normal)',
        description: 'Left arrow wraps in normal mode',
      },
      {
        value: '>',
        label: 'Right arrow (normal)',
        description: 'Right arrow wraps in normal mode',
      },
      {
        value: '[',
        label: 'Left arrow (insert)',
        description: 'Left arrow wraps in insert mode',
      },
      {
        value: ']',
        label: 'Right arrow (insert)',
        description: 'Right arrow wraps in insert mode',
      },
      {
        value: '~',
        label: 'Tilde',
        description: '~ (change case) wraps to next line',
      },
    ],
  },
]

// ============================================
// Performance Category (2 options)
// ============================================

const PERFORMANCE_OPTIONS: NeovimOptionDefinition[] = [
  {
    name: 'updatetime',
    label: 'Idle delay (ms)',
    whatItDoes:
      'How long Neovim waits before triggering idle events (like showing hover info).',
    whenToUse: 'Lower values (250-300) make plugins feel more responsive.',
    technicalNote:
      'Affects CursorHold events, swap file writes, and many plugin features.',
    category: 'performance',
    valueType: 'number',
    defaultValue: 4000,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
    min: 1,
    max: 999999,
    searchAliases: ['cursor hold', 'hover delay', 'idle'],
  },
  {
    name: 'timeoutlen',
    label: 'Key sequence timeout (ms)',
    whatItDoes:
      'How long Neovim waits for you to complete a multi-key shortcut.',
    whenToUse: 'Lower if you type fast, higher if you need more time.',
    technicalNote:
      'If you have a shortcut like <leader>ff, this is how long Neovim waits after <leader> for the next key.',
    category: 'performance',
    valueType: 'number',
    defaultValue: 1000,
    defaultSource: 'Neovim 0.10+ default',
    complexity: 'advanced',
    isPopular: false,
    isCommunityRecommended: true,
    min: 1,
    max: 99999,
    searchAliases: ['key timeout', 'mapping timeout', 'leader timeout'],
  },
]

// ============================================
// Complete Catalog
// ============================================

export const NEOVIM_OPTIONS_CATALOG: readonly NeovimOptionDefinition[] = [
  ...KEYMAPS_OPTIONS,
  ...LINE_NUMBER_OPTIONS,
  ...VISUAL_APPEARANCE_OPTIONS,
  ...TEXT_WRAPPING_OPTIONS,
  ...INDENTATION_OPTIONS,
  ...SEARCH_OPTIONS,
  ...FILE_HANDLING_OPTIONS,
  ...WINDOWS_SPLITS_OPTIONS,
  ...COMPLETION_OPTIONS,
  ...CLIPBOARD_SYSTEM_OPTIONS,
  ...PERFORMANCE_OPTIONS,
] as const

// ============================================
// Catalog Accessors
// ============================================

const optionsByName = new Map<string, NeovimOptionDefinition>(
  NEOVIM_OPTIONS_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]),
)

const optionsByCategory = new Map<
  NeovimOptionCategory,
  NeovimOptionDefinition[]
>()

for (const option of NEOVIM_OPTIONS_CATALOG) {
  const existing = optionsByCategory.get(option.category) ?? []
  existing.push(option)
  optionsByCategory.set(option.category, existing)
}

/**
 * Get an option definition by name.
 */
export function getOptionDefinition(
  name: string,
): NeovimOptionDefinition | null {
  const normalized = name.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }
  return optionsByName.get(normalized) ?? null
}

/**
 * Get all options in a category.
 */
export function getOptionsByCategory(
  category: NeovimOptionCategory,
): readonly NeovimOptionDefinition[] {
  return optionsByCategory.get(category) ?? []
}

/**
 * Get all categories with their display labels.
 */
export const CATEGORY_LABELS: Record<NeovimOptionCategory, string> = {
  keymaps: 'Keymaps',
  'line-numbers': 'Line Numbers',
  'visual-appearance': 'Visual Appearance',
  'text-wrapping': 'Text Wrapping',
  indentation: 'Indentation',
  search: 'Search',
  'file-handling': 'File Handling',
  'windows-splits': 'Windows and Splits',
  completion: 'Completion',
  'clipboard-system': 'Clipboard and System',
  performance: 'Performance',
}

/**
 * Get all category IDs in display order.
 */
export const CATEGORY_ORDER: readonly NeovimOptionCategory[] = [
  'keymaps',
  'line-numbers',
  'visual-appearance',
  'text-wrapping',
  'indentation',
  'search',
  'file-handling',
  'windows-splits',
  'completion',
  'clipboard-system',
  'performance',
]

/**
 * Get popular options (the 17 shown in default view).
 */
export function getPopularOptions(): readonly NeovimOptionDefinition[] {
  return NEOVIM_OPTIONS_CATALOG.filter((opt) => opt.isPopular)
}

/**
 * Get basic options (complexity: basic).
 */
export function getBasicOptions(): readonly NeovimOptionDefinition[] {
  return NEOVIM_OPTIONS_CATALOG.filter((opt) => opt.complexity === 'basic')
}

/**
 * Get advanced options (complexity: advanced).
 */
export function getAdvancedOptions(): readonly NeovimOptionDefinition[] {
  return NEOVIM_OPTIONS_CATALOG.filter((opt) => opt.complexity === 'advanced')
}

/**
 * Search options by name, label, or aliases.
 */
export function searchOptions(
  query: string,
): readonly NeovimOptionDefinition[] {
  const normalized = query.trim().toLowerCase()
  if (normalized.length === 0) {
    return NEOVIM_OPTIONS_CATALOG
  }

  return NEOVIM_OPTIONS_CATALOG.filter((opt) => {
    // Search by name
    if (opt.name.toLowerCase().includes(normalized)) {
      return true
    }
    // Search by label
    if (opt.label.toLowerCase().includes(normalized)) {
      return true
    }
    // Search by aliases
    if (
      opt.searchAliases?.some((alias) =>
        alias.toLowerCase().includes(normalized),
      )
    ) {
      return true
    }
    // Search by whatItDoes
    if (opt.whatItDoes.toLowerCase().includes(normalized)) {
      return true
    }
    return false
  })
}

/**
 * Get the default value for an option in stored format.
 */
export function getDefaultStoredValue(
  option: NeovimOptionDefinition,
): import('@/shared/types/neovim-options').NeovimOptionStoredValue {
  const { valueType } = option
  const defaultValue = option.defaultValue

  switch (valueType) {
    case 'boolean':
      return { valueType: 'boolean', value: defaultValue as boolean }
    case 'number':
      return { valueType: 'number', value: defaultValue as number }
    case 'string':
      return { valueType: 'string', value: defaultValue as string }
    case 'string-list':
    case 'char-list':
      return {
        valueType,
        value: Array.isArray(defaultValue) ? [...defaultValue] : [],
      }
    default: {
      // Exhaustive check - should never reach here
      const _exhaustive: never = valueType
      throw new Error(`Unknown value type: ${_exhaustive as string}`)
    }
  }
}

/**
 * Check if two stored values are equal.
 */
export function areStoredValuesEqual(
  a: import('@/shared/types/neovim-options').NeovimOptionStoredValue,
  b: import('@/shared/types/neovim-options').NeovimOptionStoredValue,
): boolean {
  if (a.valueType !== b.valueType) {
    return false
  }

  if (a.valueType === 'boolean' && b.valueType === 'boolean') {
    return a.value === b.value
  }

  if (a.valueType === 'number' && b.valueType === 'number') {
    return a.value === b.value
  }

  if (a.valueType === 'string' && b.valueType === 'string') {
    return a.value === b.value
  }

  if (
    (a.valueType === 'string-list' || a.valueType === 'char-list') &&
    (b.valueType === 'string-list' || b.valueType === 'char-list')
  ) {
    if (a.value.length !== b.value.length) {
      return false
    }
    return a.value.every((v, i) => v === b.value[i])
  }

  return false
}

/**
 * Check if a stored value matches the default for an option.
 */
export function isDefaultValue(
  option: NeovimOptionDefinition,
  storedValue: import('@/shared/types/neovim-options').NeovimOptionStoredValue,
): boolean {
  const defaultValue = getDefaultStoredValue(option)
  return areStoredValuesEqual(defaultValue, storedValue)
}
