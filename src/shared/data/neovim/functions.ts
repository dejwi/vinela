import type { PortDataType } from '@/shared/types'
import type { CoreCategorySlug } from '../function-catalog-types'

export interface VimFunctionArgumentHint {
  index: number
  name: string
  description?: string
  example?: string
  allowedValues?: readonly string[]
  /** Per-value descriptions for allowedValues. Keys must match allowedValues entries. */
  allowedValueDescriptions?: Readonly<Record<string, string>> | undefined
  /** The data type of this parameter. When omitted, defaults to 'any' in the builder. */
  type?: PortDataType | undefined
}

export interface VimFunctionCatalogEntry {
  name: string
  /** User-friendly display name, e.g. "Check Feature Support" */
  label: string
  signature: string
  minArgs: number
  maxArgs: number | 'unbounded'
  returnType: string
  /** Category slug — imported from function-catalog-types.ts */
  category: CoreCategorySlug
  notes: string
  sourceDoc: string
  argumentHints?: readonly VimFunctionArgumentHint[]
  /** Beginner-friendly explanation (REQUIRED for all entries) */
  whatItDoes: string
  /** Technical note for advanced users */
  technicalNote?: string | undefined
  /** Show in Popular view */
  isPopular?: boolean | undefined
  /** Search aliases */
  aliases?: readonly string[] | undefined
  /** Override the default `vim.fn.{name}($params)` pattern */
  luaCallOverride?: string | undefined
  /**
   * How parameters are passed to the function:
   * - 'positional' (default): fn(arg1, arg2, arg3)
   * - 'named-table': fn({ key1 = val1, key2 = val2 })
   *
   * Use 'named-table' for functions that accept a single options table
   * but where we've broken the table into individual UI parameters
   * for better user experience.
   */
  paramsStyle?: 'positional' | 'named-table' | undefined
  /** Hide from basic/popular views (e.g., callback-heavy functions) */
  advancedOnly?: boolean | undefined
  /** Neovim version gate (e.g., 'nvim-0.10') */
  requires?: string | undefined
  /** Beginner-friendly explanation of what the return value represents */
  returnDescription?: string | undefined
}

export const STD_PATH_VALUES = [
  'cache',
  'config',
  'config_dirs',
  'data',
  'data_dirs',
  'log',
  'run',
  'state',
] as const

export const NEOVIM_FUNCTION_CATALOG = [
  {
    name: 'has',
    label: 'Check Feature Support',
    signature: 'has({feature})',
    minArgs: 1,
    maxArgs: 1,
    returnType: '0 | 1',
    category: 'feature',
    notes:
      'Checks whether Neovim supports a feature string (version, OS, provider, capability).',
    sourceDoc: ':help has()',
    whatItDoes:
      'Checks whether your version of Neovim supports a specific feature, like a minimum version number or clipboard support.',
    technicalNote:
      'Returns 1 if the feature is supported, 0 otherwise. Feature strings include version tokens (nvim-0.10), OS detection (win32, mac), and capability checks.',
    returnDescription: 'Returns 1 if the feature is supported, 0 otherwise.',
    isPopular: true,
    aliases: ['feature check', 'supports', 'version check'],
    argumentHints: [
      {
        index: 0,
        name: 'feature',
        description: 'Feature token to probe.',
        example: 'nvim-0.10',
      },
    ],
  },
  {
    name: 'exists',
    label: 'Check if Exists',
    signature: 'exists({expr})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'number-like bool',
    category: 'feature',
    notes:
      'Checks whether a Vim expression target exists, such as option, env var, function, command, or autocommand.',
    sourceDoc: ':help exists()',
    whatItDoes:
      'Checks whether a Vim option, environment variable, function, command, or autocommand exists. Useful for conditional configuration.',
    returnDescription: 'Returns 1 if the target exists, 0 otherwise.',
    aliases: ['check exists', 'option exists', 'variable exists'],
    argumentHints: [
      {
        index: 0,
        name: 'expr',
        description:
          'Expression to check, e.g. &number, $HOME, *printf, :quit, #BufEnter.',
        example: '&number',
      },
    ],
  },
  {
    name: 'executable',
    label: 'Check if Program Available',
    signature: 'executable({expr})',
    minArgs: 1,
    maxArgs: 1,
    returnType: '0 | 1',
    category: 'system',
    notes: 'Checks whether an executable program is available on PATH.',
    sourceDoc: ':help executable()',
    whatItDoes:
      'Checks whether a program (like "rg", "node", or "python") is installed and available on your system PATH.',
    returnDescription:
      'Returns 1 if the program is found on PATH, 0 otherwise.',
    isPopular: true,
    aliases: ['program check', 'installed', 'path check', 'which'],
    argumentHints: [
      {
        index: 0,
        name: 'program',
        description: 'Executable name (without shell arguments).',
        example: 'rg',
      },
    ],
  },
  {
    name: 'stdpath',
    label: 'Get Standard Path',
    signature: 'stdpath({what})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string | string[]',
    category: 'path',
    notes:
      'Returns one of Neovim standard directories (or directory lists) for config/data/cache/runtime locations.',
    sourceDoc: ':help stdpath()',
    whatItDoes:
      "Returns the path to one of Neovim's standard directories (config, data, cache, etc.). Use this to find where your config files live.",
    returnDescription:
      'The resolved filesystem path (or list of paths for "data_dirs").',
    isPopular: true,
    aliases: ['config path', 'data path', 'cache path', 'neovim directory'],
    argumentHints: [
      {
        index: 0,
        name: 'what',
        description: 'Which standard path to resolve.',
        allowedValues: STD_PATH_VALUES,
        example: 'config',
      },
    ],
  },
  {
    name: 'expand',
    label: 'Expand File Path',
    signature: 'expand({string}[, {nosuf}[, {list}]])',
    minArgs: 1,
    maxArgs: 3,
    returnType: 'string | list',
    category: 'path',
    notes:
      'Expands special file tokens and wildcards (for example %, #, and path modifiers).',
    sourceDoc: ':help expand()',
    whatItDoes:
      'Expands special file tokens like % (current file), # (alternate file), and path modifiers like :p (full path) or :h (directory).',
    returnDescription: 'The expanded filename or list of matches.',
    aliases: ['current file', 'filename', 'path expand', '%'],
    argumentHints: [
      {
        index: 0,
        name: 'expr',
        description: 'Pattern or filename expression to expand.',
        example: '%:p:h',
      },
      {
        index: 1,
        name: 'nosuf',
        description:
          'When non-zero, do not use suffixes from the suffixes option.',
        example: '0',
      },
      {
        index: 2,
        name: 'list',
        description:
          'When non-zero, return a list instead of a newline-separated string.',
        example: '0',
      },
    ],
  },
  {
    name: 'glob',
    label: 'Find Files by Pattern',
    signature: 'glob({expr}[, {nosuf}[, {list}[, {alllinks}]]])',
    minArgs: 1,
    maxArgs: 4,
    returnType: 'string | list',
    category: 'path',
    notes:
      'Expands filesystem wildcards to matching paths, optionally as a list and with symlink behavior control.',
    sourceDoc: ':help glob()',
    whatItDoes:
      'Finds files matching a wildcard pattern (like "**/*.lua"). Returns matching paths as a string or list.',
    returnDescription:
      'Matching paths as a newline-separated string, or a list when the list argument is non-zero.',
    aliases: ['file search', 'wildcard', 'pattern match'],
    argumentHints: [
      {
        index: 0,
        name: 'expr',
        description:
          'Glob pattern to resolve (supports recursive ** patterns).',
        example: '**/*.lua',
      },
      {
        index: 1,
        name: 'nosuf',
        description: 'When non-zero, skip suffix filtering.',
        example: '0',
      },
      {
        index: 2,
        name: 'list',
        description:
          'When non-zero, return a list instead of a newline-separated string.',
        example: '1',
      },
      {
        index: 3,
        name: 'alllinks',
        description: 'When non-zero, include all symlink matches.',
        example: '0',
      },
    ],
  },
  {
    name: 'filereadable',
    label: 'Check if File Readable',
    signature: 'filereadable({file})',
    minArgs: 1,
    maxArgs: 1,
    returnType: '0 | 1',
    category: 'path',
    notes: 'Checks whether a path points to a readable regular file.',
    sourceDoc: ':help filereadable()',
    whatItDoes:
      'Checks whether a file exists and can be read. Returns 1 if readable, 0 otherwise.',
    returnDescription:
      'Returns 1 if the file exists and is readable, 0 otherwise.',
    aliases: ['file exists', 'can read', 'file check'],
    argumentHints: [
      {
        index: 0,
        name: 'filePath',
        description: 'File path to validate.',
        example: '~/.config/nvim/init.lua',
      },
    ],
  },
  {
    name: 'isdirectory',
    label: 'Check if Directory Exists',
    signature: 'isdirectory({directory})',
    minArgs: 1,
    maxArgs: 1,
    returnType: '0 | 1',
    category: 'path',
    notes: 'Checks whether a path exists and is a directory.',
    sourceDoc: ':help isdirectory()',
    whatItDoes:
      'Checks whether a path exists and is a directory (not a file). Returns 1 if it is a directory, 0 otherwise.',
    returnDescription: 'Returns 1 if the path is a directory, 0 otherwise.',
    aliases: ['folder exists', 'dir check', 'is folder'],
    argumentHints: [
      {
        index: 0,
        name: 'directoryPath',
        description: 'Directory path to validate.',
        example: '~/.config/nvim',
      },
    ],
  },
  {
    name: 'getcwd',
    label: 'Get Working Directory',
    signature: 'getcwd([{winnr}[, {tabnr}]])',
    minArgs: 0,
    maxArgs: 2,
    returnType: 'string',
    category: 'path',
    notes:
      'Returns the current working directory, optionally scoped by window/tab context.',
    sourceDoc: ':help getcwd()',
    whatItDoes:
      'Returns the current working directory path. Useful for building paths relative to where Neovim was opened.',
    returnDescription: 'The absolute path of the current working directory.',
    aliases: ['current directory', 'pwd', 'cwd'],
    argumentHints: [
      {
        index: 0,
        name: 'window',
        description:
          'Window number or ID; 0 means current window, -1 targets global scope with tab argument.',
        example: '0',
      },
      {
        index: 1,
        name: 'tab',
        description: 'Tab page number when querying a specific tab scope.',
        example: '0',
      },
    ],
  },
  {
    name: 'fnameescape',
    label: 'Escape Filename',
    signature: 'fnameescape({string})',
    minArgs: 1,
    maxArgs: 1,
    returnType: 'string',
    category: 'path',
    notes:
      'Escapes special filename characters so the path is safe in Vim command-line commands.',
    sourceDoc: ':help fnameescape()',
    whatItDoes:
      'Escapes special characters in a file path so it can be safely used in Vim command-line commands.',
    returnDescription:
      'The escaped path string, safe for use in Vim command-line commands.',
    aliases: ['safe filename', 'path escape'],
    argumentHints: [
      {
        index: 0,
        name: 'path',
        description: 'Raw path or filename to escape.',
        example: '/tmp/file with spaces.txt',
      },
    ],
  },
  {
    name: 'system',
    label: 'Run Shell Command',
    signature: 'system({cmd}[, {input}])',
    minArgs: 1,
    maxArgs: 2,
    returnType: 'string',
    category: 'system',
    notes:
      'Runs a command and returns stdout as a string; shell exit code is available in v:shell_error.',
    sourceDoc: ':help system()',
    whatItDoes:
      'Runs a shell command and returns its output as a string. The exit code is stored in v:shell_error.',
    returnDescription: 'The stdout output of the command as a string.',
    isPopular: true,
    aliases: ['shell', 'exec', 'terminal', 'subprocess'],
    argumentHints: [
      {
        index: 0,
        name: 'command',
        description:
          'Command string (shell-parsed) or argv-style list represented as text.',
        example: 'git rev-parse --is-inside-work-tree',
      },
      {
        index: 1,
        name: 'stdin',
        description: 'Optional input passed to command stdin.',
        example: 'payload text',
      },
    ],
  },
  {
    name: 'systemlist',
    label: 'Run Shell Command (Lines)',
    signature: 'systemlist({cmd}[, {input}[, {keepempty}]])',
    minArgs: 1,
    maxArgs: 3,
    returnType: 'string[]',
    category: 'system',
    notes: 'Runs a command and returns stdout split into lines (list result).',
    sourceDoc: ':help systemlist()',
    whatItDoes:
      'Runs a shell command and returns its output as a list of lines. Useful when you need to process each line separately.',
    returnDescription: 'A list of output lines from the command.',
    aliases: ['shell lines', 'exec lines'],
    argumentHints: [
      {
        index: 0,
        name: 'command',
        description:
          'Command string (shell-parsed) or argv-style list represented as text.',
        example: 'ls -la',
      },
      {
        index: 1,
        name: 'stdin',
        description: 'Optional input passed to command stdin.',
        example: '',
      },
      {
        index: 2,
        name: 'keepEmpty',
        description: 'When non-zero, keep empty trailing lines in output.',
        example: '0',
      },
    ],
  },
  {
    name: 'input',
    label: 'Prompt for Input',
    signature: 'input({prompt}[, {text}[, {completion}]])',
    minArgs: 1,
    maxArgs: 3,
    returnType: 'string',
    category: 'ui',
    notes:
      'Prompts the user for text input, optionally with default text and completion mode.',
    sourceDoc: ':help input()',
    whatItDoes:
      'Shows a prompt at the bottom of the screen and waits for the user to type something. Returns what they typed.',
    returnDescription:
      'The text the user typed, or an empty string if they cancelled.',
    isPopular: true,
    aliases: ['ask user', 'text input', 'dialog'],
    argumentHints: [
      {
        index: 0,
        name: 'prompt',
        description: 'Prompt text shown to the user.',
        example: 'Project name: ',
      },
      {
        index: 1,
        name: 'defaultText',
        description: 'Initial text pre-filled in the input box.',
        example: 'my-project',
      },
      {
        index: 2,
        name: 'completion',
        description:
          'Optional completion mode token (for example file, dir, command).',
        example: 'file',
      },
    ],
  },
  {
    name: 'confirm',
    label: 'Show Confirmation Dialog',
    signature: 'confirm({msg}[, {choices}[, {default}[, {type}]]])',
    minArgs: 1,
    maxArgs: 4,
    returnType: 'number',
    category: 'ui',
    notes:
      'Shows a choice dialog and returns the selected button index (1-based).',
    sourceDoc: ':help confirm()',
    whatItDoes:
      'Shows a dialog with a message and buttons (like Yes/No). Returns the number of the button the user clicked (1-based).',
    returnDescription:
      'The 1-based index of the button the user clicked (0 if dismissed).',
    aliases: ['yes no', 'choice', 'ask'],
    argumentHints: [
      {
        index: 0,
        name: 'message',
        description: 'Main message text shown in the dialog.',
        example: 'Overwrite existing file?',
      },
      {
        index: 1,
        name: 'choices',
        description: 'Button labels separated by newline; & marks hotkeys.',
        example: '&Yes\n&No',
      },
      {
        index: 2,
        name: 'defaultChoice',
        description: '1-based index of the default selected choice.',
        example: '2',
      },
      {
        index: 3,
        name: 'dialogType',
        description: 'Dialog icon/style type.',
        allowedValues: ['Error', 'Question', 'Info', 'Warning', 'Generic'],
        example: 'Question',
      },
    ],
  },
  {
    name: 'printf',
    label: 'Format String',
    signature: 'printf({fmt}, {expr1} ...)',
    minArgs: 2,
    maxArgs: 'unbounded',
    returnType: 'string',
    category: 'text',
    notes:
      'Formats values using printf-style format specifiers and returns the resulting string.',
    sourceDoc: ':help printf()',
    whatItDoes:
      'Formats a string using printf-style placeholders (like %s for strings, %d for numbers). Returns the formatted result.',
    returnDescription:
      'The formatted string with all placeholders substituted.',
    aliases: ['string format', 'sprintf', 'template'],
    argumentHints: [
      {
        index: 0,
        name: 'format',
        description: 'Format string containing printf-style placeholders.',
        example: 'Hello %s',
      },
      {
        index: 1,
        name: 'value1',
        description: 'First value substituted into the format string.',
        example: 'world',
      },
    ],
  },
  {
    name: 'setreg',
    label: 'Set Register Contents',
    signature: 'setreg({regname}, {value}[, {options}])',
    minArgs: 2,
    maxArgs: 3,
    returnType: '0',
    category: 'register',
    notes:
      'Writes text/list into a Vim register, optionally controlling register mode and append behavior.',
    sourceDoc: ':help setreg()',
    whatItDoes:
      'Writes text into a Vim register (like the clipboard register "+"). Useful for programmatically setting clipboard content.',
    aliases: ['register', 'clipboard'],
    argumentHints: [
      {
        index: 0,
        name: 'register',
        description: 'Target register name (for example a, +, *, or ").',
        example: 'a',
      },
      {
        index: 1,
        name: 'value',
        description: 'Value written into the register.',
        example: 'copied text',
      },
      {
        index: 2,
        name: 'options',
        description: 'Register behavior flags such as append/mode options.',
        example: 'a',
      },
    ],
  },
] as const satisfies readonly VimFunctionCatalogEntry[]

export const NEOVIM_FUNCTION_NAMES: readonly string[] =
  NEOVIM_FUNCTION_CATALOG.map((entry) => entry.name)

const functionByName = new Map<string, VimFunctionCatalogEntry>(
  NEOVIM_FUNCTION_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]),
)

export function getNeovimFunction(
  functionName: string,
): VimFunctionCatalogEntry | null {
  const normalized = functionName.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }
  return functionByName.get(normalized) ?? null
}

function isVoidLikeReturnType(returnType: string): boolean {
  const normalized = returnType.trim().toLowerCase()
  return normalized === 'void' || normalized === '0'
}

export function hasFunctionResultValue(
  entry: VimFunctionCatalogEntry,
): boolean {
  return !isVoidLikeReturnType(entry.returnType)
}

function inferTypeToken(token: string): PortDataType | null {
  const normalized = token.trim().toLowerCase()

  if (normalized.length === 0) {
    return null
  }

  if (isVoidLikeReturnType(normalized)) {
    return 'void'
  }

  if (normalized === '0 | 1' || normalized.includes('bool')) {
    return 'boolean'
  }

  if (normalized.includes('buffer')) {
    return 'buffer'
  }

  if (normalized.includes('window')) {
    return 'window'
  }

  if (normalized.includes('number')) {
    return 'number'
  }

  if (normalized.includes('[]') || normalized.includes('list')) {
    return 'table'
  }

  if (normalized === 'string') {
    return 'string'
  }

  return null
}

export function inferFunctionResultPortType(
  entry: VimFunctionCatalogEntry,
): PortDataType {
  const normalized = entry.returnType.trim().toLowerCase()

  if (isVoidLikeReturnType(normalized)) {
    return 'void'
  }

  if (normalized === '0 | 1' || normalized.includes('bool')) {
    return 'boolean'
  }

  const unionTokens = normalized
    .split('|')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  if (unionTokens.length > 1) {
    const inferredTypes = unionTokens.map((token) => inferTypeToken(token))
    if (inferredTypes.some((typeName) => typeName === null)) {
      return 'any'
    }

    const [firstType, ...restTypes] = inferredTypes
    if (!firstType) {
      return 'any'
    }

    return restTypes.every((typeName) => typeName === firstType)
      ? firstType
      : 'any'
  }

  return inferTypeToken(normalized) ?? 'any'
}
