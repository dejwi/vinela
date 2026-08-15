import type { RunFunctionDefaultValue } from '@/shared/types'
import type { CoreFunctionTemplateDefinition } from '../function-catalog-types'

// Helper constructors for discriminated union default values
const scalar = (value: string | number | boolean): RunFunctionDefaultValue => ({
  kind: 'scalar',
  value,
})

const lua = (expr: string): RunFunctionDefaultValue => ({
  kind: 'lua',
  lua: expr,
})

export const CORE_FUNCTION_TEMPLATES = [
  // ============================================
  // FEATURE DETECTION TEMPLATES
  // ============================================
  {
    key: 'check-neovim-version',
    baseFunctionName: 'has',
    label: 'Check Neovim Version',
    shortDescription: 'Check if running Neovim 0.10 or newer',
    whatItDoes:
      'Checks whether the current Neovim version meets a minimum requirement. Useful for gating features that need newer versions.',
    defaults: { feature: scalar('nvim-0.10') },
    aliases: ['version check', 'minimum version', 'nvim version'],
    isPopular: true,
  },
  {
    key: 'check-clipboard',
    baseFunctionName: 'has',
    label: 'Check Clipboard Support',
    shortDescription: 'Check if system clipboard is available',
    whatItDoes:
      "Checks if Neovim can access the system clipboard. If not, clipboard-related keymaps won't work.",
    defaults: { feature: scalar('clipboard') },
    aliases: ['clipboard check', 'system clipboard'],
  },

  // ============================================
  // PATH TEMPLATES
  // ============================================
  {
    key: 'get-config-path',
    baseFunctionName: 'stdpath',
    label: 'Get Config Directory',
    shortDescription: 'Get Neovim config directory path (~/.config/nvim)',
    whatItDoes:
      'Returns the path to your Neovim configuration directory. This is where init.lua and other config files live.',
    defaults: { what: scalar('config') },
    aliases: ['config directory', 'nvim config', 'init.lua path'],
    isPopular: true,
  },
  {
    key: 'get-data-path',
    baseFunctionName: 'stdpath',
    label: 'Get Data Directory',
    shortDescription: 'Get Neovim data directory path (~/.local/share/nvim)',
    whatItDoes:
      "Returns the path to Neovim's data directory where plugins and persistent data are stored.",
    defaults: { what: scalar('data') },
    aliases: ['data directory', 'plugin directory', 'share nvim'],
  },
  {
    key: 'get-cache-path',
    baseFunctionName: 'stdpath',
    label: 'Get Cache Directory',
    shortDescription: 'Get Neovim cache directory path (~/.cache/nvim)',
    whatItDoes:
      "Returns the path to Neovim's cache directory for temporary files and caches.",
    defaults: { what: scalar('cache') },
    aliases: ['cache directory', 'temp directory'],
  },
  {
    key: 'get-current-file',
    baseFunctionName: 'expand',
    label: 'Get Current File Path',
    shortDescription: 'Get the full path of the current file',
    whatItDoes:
      'Returns the absolute path to the file you currently have open.',
    defaults: { expr: scalar('%:p') },
    aliases: ['current file', 'file path', 'buffer path'],
    isPopular: true,
  },
  {
    key: 'get-current-filename',
    baseFunctionName: 'expand',
    label: 'Get Current Filename',
    shortDescription:
      'Get just the filename of the current file (no directory)',
    whatItDoes:
      'Returns only the filename (like "init.lua") without the directory path.',
    defaults: { expr: scalar('%:t') },
    aliases: ['filename only', 'file name', 'basename'],
  },
  {
    key: 'get-current-directory',
    baseFunctionName: 'expand',
    label: 'Get Current File Directory',
    shortDescription: 'Get the directory containing the current file',
    whatItDoes:
      'Returns the directory path of the file you currently have open.',
    defaults: { expr: scalar('%:p:h') },
    aliases: ['current directory', 'file directory', 'parent dir'],
  },

  // ============================================
  // SYSTEM TEMPLATES
  // ============================================
  {
    key: 'check-git-repo',
    baseFunctionName: 'system',
    label: 'Check if Git Repository',
    shortDescription: 'Check if the current directory is inside a Git repo',
    whatItDoes:
      'Runs a quick check to determine if the current working directory is inside a Git repository.',
    defaults: {
      command: scalar('git rev-parse --is-inside-work-tree 2>/dev/null'),
    },
    aliases: ['git check', 'is git', 'git repo'],
    isPopular: true,
  },
  {
    key: 'check-program-installed',
    baseFunctionName: 'executable',
    label: 'Check if Program Installed',
    shortDescription: 'Check if a program is available on the system PATH',
    whatItDoes:
      'Checks whether a program (like "rg", "node", or "python") is installed and available on your system. Useful for conditional feature setup.',
    defaults: {},
    aliases: ['program check', 'installed check', 'which'],
    isPopular: true,
  },

  // ============================================
  // NOTIFICATION TEMPLATES
  // ============================================
  {
    key: 'show-info',
    baseFunctionName: 'vim_notify',
    label: 'Show Info Message',
    shortDescription: 'Display an informational notification',
    whatItDoes:
      'Shows a blue/neutral notification message to the user. Great for status updates or confirmation messages.',
    defaults: { level: lua('vim.log.levels.INFO') },
    aliases: ['info notification', 'message', 'info'],
    isPopular: true,
  },
  {
    key: 'show-warning',
    baseFunctionName: 'vim_notify',
    label: 'Show Warning Message',
    shortDescription: 'Display a warning notification',
    whatItDoes:
      'Shows a yellow/orange warning notification to alert the user about something that might need attention.',
    defaults: { level: lua('vim.log.levels.WARN') },
    aliases: ['warning notification', 'warn'],
  },
  {
    key: 'show-error',
    baseFunctionName: 'vim_notify',
    label: 'Show Error Message',
    shortDescription: 'Display an error notification',
    whatItDoes:
      'Shows a red error notification to alert the user about a problem or failure.',
    defaults: { level: lua('vim.log.levels.ERROR') },
    aliases: ['error notification', 'error message'],
  },

  // ============================================
  // HIGHLIGHT TEMPLATES
  // ============================================
  {
    key: 'highlight-on-yank-default',
    baseFunctionName: 'highlight_on_yank',
    label: 'Highlight Yanked Text',
    shortDescription: 'Flash copied text with IncSearch highlight for 200ms',
    whatItDoes:
      'Briefly flashes text after you copy (yank) it using the IncSearch highlight group. This is the most common Neovim "quality of life" setting.',
    defaults: {
      higroup: scalar('IncSearch'),
      timeout: scalar(200),
    },
    aliases: ['yank flash', 'copy feedback', 'highlight yank', 'TextYankPost'],
    isPopular: true,
  },
] as const satisfies readonly CoreFunctionTemplateDefinition[]
