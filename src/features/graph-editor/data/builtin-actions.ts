import { Bell, FileInput, Keyboard, type LucideIcon, Timer } from 'lucide-react'
import type { PluginConfigValue, Port, SchemaOption } from '@/shared/types'

export type BuiltinActionCategory =
  | 'Editor'
  | 'User Interface'
  | 'Buffers'
  | 'Automation'
  | 'Input'

export interface BuiltinActionDefinition {
  id: string
  label: string
  description: string
  category: BuiltinActionCategory
  icon: LucideIcon
  inputs: Port[]
  outputs: Port[]
  configSchema: SchemaOption[]
  getDefaultConfig: () => Record<string, PluginConfigValue>
  getPreview: (config: Record<string, unknown>) => string
}

const EXEC_INPUT: Port = {
  id: 'exec',
  label: 'Execute',
  dataType: 'void',
  required: true,
}

const DONE_OUTPUT: Port = {
  id: 'done',
  label: 'Done',
  dataType: 'void',
}

function readString(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = config[key]
  return typeof value === 'string' ? value : fallback
}

function readNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = config[key]
  return typeof value === 'number' ? value : fallback
}

const BUILTIN_ACTIONS_INTERNAL: BuiltinActionDefinition[] = [
  {
    id: 'ui.notify',
    label: 'Show Notification',
    description: 'Display a notification through vim.notify().',
    category: 'User Interface',
    icon: Bell,
    inputs: [
      EXEC_INPUT,
      {
        id: 'message',
        label: 'Message',
        dataType: 'string',
        required: false,
      },
      {
        id: 'title',
        label: 'Title',
        dataType: 'string',
        required: false,
      },
    ],
    outputs: [DONE_OUTPUT],
    configSchema: [
      {
        key: 'message',
        label: 'Message',
        type: 'string',
        default: 'Configuration updated',
        required: true,
      },
      {
        key: 'level',
        label: 'Level',
        type: 'select',
        default: 'info',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Warning', value: 'warn' },
          { label: 'Error', value: 'error' },
          { label: 'Debug', value: 'debug' },
          { label: 'Trace', value: 'trace' },
        ],
      },
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        default: '',
        description: 'Optional notification title.',
      },
    ],
    getDefaultConfig: () => ({
      message: 'Configuration updated',
      level: 'info',
      title: '',
    }),
    getPreview: (config) => {
      const level = readString(config, 'level', 'info').toUpperCase()
      const message = readString(config, 'message', 'Configuration updated')
      return `${level}: ${message}`
    },
  },
  {
    id: 'buffers.open-file',
    label: 'Open File',
    description: 'Open a file path in the current, split, or tab window.',
    category: 'Buffers',
    icon: FileInput,
    inputs: [
      EXEC_INPUT,
      {
        id: 'path',
        label: 'Path',
        dataType: 'string',
        required: false,
      },
    ],
    outputs: [DONE_OUTPUT],
    configSchema: [
      {
        key: 'path',
        label: 'Path',
        type: 'string',
        required: true,
        default: '',
        description:
          'Path to open. Relative paths resolve from current working directory.',
      },
      {
        key: 'mode',
        label: 'Open Mode',
        type: 'select',
        default: 'edit',
        options: [
          { value: 'edit', label: 'Current window' },
          { value: 'split', label: 'Horizontal split' },
          { value: 'vsplit', label: 'Vertical split' },
          { value: 'tabedit', label: 'New tab' },
        ],
      },
    ],
    getDefaultConfig: () => ({ path: '', mode: 'edit' }),
    getPreview: (config) => {
      const mode = readString(config, 'mode', 'edit')
      const path = readString(config, 'path', '<path>')
      return `${mode} ${path}`
    },
  },
  {
    id: 'automation.delay',
    label: 'Delay Execution',
    description:
      'Delay downstream execution by a fixed number of milliseconds.',
    category: 'Automation',
    icon: Timer,
    inputs: [EXEC_INPUT],
    outputs: [DONE_OUTPUT],
    configSchema: [
      {
        key: 'delayMs',
        label: 'Delay (ms)',
        type: 'number',
        default: 100,
        validation: { min: 0, step: 10, integer: true },
      },
    ],
    getDefaultConfig: () => ({ delayMs: 100 }),
    getPreview: (config) => {
      const delayMs = readNumber(config, 'delayMs', 100)
      return `${delayMs}ms`
    },
  },
  {
    id: 'input.prompt',
    label: 'Prompt Input',
    description: 'Ask the user for text input and emit the value.',
    category: 'Input',
    icon: Keyboard,
    inputs: [EXEC_INPUT],
    outputs: [
      DONE_OUTPUT,
      {
        id: 'value',
        label: 'Value',
        dataType: 'string',
      },
    ],
    configSchema: [
      {
        key: 'prompt',
        label: 'Prompt Text',
        type: 'string',
        default: 'Input: ',
      },
      {
        key: 'defaultValue',
        label: 'Default Value',
        type: 'string',
        default: '',
      },
    ],
    getDefaultConfig: () => ({ prompt: 'Input: ', defaultValue: '' }),
    getPreview: (config) => readString(config, 'prompt', 'Input: '),
  },
]

export const BUILTIN_ACTIONS: readonly BuiltinActionDefinition[] =
  BUILTIN_ACTIONS_INTERNAL

export function getBuiltinActionDefinition(
  builtinId: string,
): BuiltinActionDefinition | null {
  return BUILTIN_ACTIONS.find((action) => action.id === builtinId) ?? null
}

export function getBuiltinActionsByCategory(): Map<
  BuiltinActionCategory,
  BuiltinActionDefinition[]
> {
  const grouped = new Map<BuiltinActionCategory, BuiltinActionDefinition[]>()

  for (const action of BUILTIN_ACTIONS) {
    const existing = grouped.get(action.category)
    if (existing) {
      existing.push(action)
      continue
    }
    grouped.set(action.category, [action])
  }

  return grouped
}

export function isBuiltinActionDefinition(
  definition: BuiltinActionDefinition,
): boolean {
  if (definition.id.length === 0 || definition.label.length === 0) {
    return false
  }

  return definition.configSchema.every((option) => {
    if (option.key.length === 0 || option.label.length === 0) {
      return false
    }

    if (option.type === 'select') {
      return option.options.length > 0
    }

    return true
  })
}
