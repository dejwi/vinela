export interface VariableScopeInfo {
  code: 'g' | 'b' | 'w' | 't' | 'v'
  label: string
  shortLabel: string
  description: string
}

export const VARIABLE_SCOPE_INFO: readonly VariableScopeInfo[] = [
  {
    code: 'g',
    label: 'Global (entire editor)',
    shortLabel: 'g:',
    description:
      'Accessible everywhere in your Neovim config. Use this for settings that should apply globally.',
  },
  {
    code: 'b',
    label: 'Buffer (current file only)',
    shortLabel: 'b:',
    description:
      'Only available in the current file/buffer. Use this for file-specific settings.',
  },
  {
    code: 'w',
    label: 'Window (current split only)',
    shortLabel: 'w:',
    description:
      'Only available in the current window/split. Use this for window-specific settings.',
  },
  {
    code: 't',
    label: 'Tab (current tab only)',
    shortLabel: 't:',
    description:
      'Only available in the current tab. Use this for tab-specific settings.',
  },
  {
    code: 'v',
    label: 'Vim Internal (advanced)',
    shortLabel: 'v:',
    description:
      'Read-only Vim internal variables. Only for advanced users who need to read Vim state.',
  },
]

export interface VariableValueTypeInfo {
  type: 'string' | 'number' | 'boolean' | 'raw'
  label: string
  description: string
}

export const VARIABLE_VALUE_TYPE_INFO: readonly VariableValueTypeInfo[] = [
  {
    type: 'string',
    label: 'Text',
    description: 'A text/string value like "hello" or "dark"',
  },
  {
    type: 'number',
    label: 'Number',
    description: 'A numeric value like 4, 80, or 100',
  },
  {
    type: 'boolean',
    label: 'True/False',
    description: 'A simple on/off toggle value',
  },
  {
    type: 'raw',
    label: 'Advanced (Lua code)',
    description:
      'For advanced users: enter raw Lua code like tables or function calls',
  },
]
