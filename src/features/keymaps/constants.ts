import type { KeymapMode } from '@/shared/types'
import type { ManualKeymapActionType } from './types'

/** Display labels for Vim modes (reuse from SetKeymapActionEditor pattern) */
export const MODE_LABELS: Record<KeymapMode, string> = {
  n: 'Normal',
  i: 'Insert',
  v: 'Visual+Select',
  x: 'Visual',
  t: 'Terminal',
  c: 'Command-line',
  o: 'Operator-pending',
  s: 'Select',
}

/** Ordered list of modes for consistent display */
export const MODE_ORDER: readonly KeymapMode[] = [
  'n',
  'i',
  'v',
  'x',
  't',
  'c',
  'o',
  's',
]

/** User-friendly labels for manual keymap action types */
export const ACTION_TYPE_LABELS: Record<ManualKeymapActionType, string> = {
  'run-action': 'Run Action',
  'run-function': 'Run Function',
  'set-option': 'Set Option',
  'set-variable': 'Set Variable',
  'code-block': 'Code Block',
  'run-custom-action': 'Run Custom Action',
}

/** Short descriptions for each action type (shown in dropdown) */
export const ACTION_TYPE_DESCRIPTIONS: Record<ManualKeymapActionType, string> =
  {
    'run-action': 'Execute a Vim Ex command or key sequence',
    'run-function': 'Call a Neovim API or plugin function',
    'set-option': 'Change a Neovim option value',
    'set-variable': 'Set a Neovim variable',
    'code-block': 'Run custom Lua code',
    'run-custom-action': 'Run a graph you built in the Graph Editor',
  }

/** Action type groups for progressive disclosure (Common vs Advanced) */
export interface ActionTypeGroup {
  label: string
  types: ManualKeymapActionType[]
}

export const ACTION_TYPE_GROUPS: readonly ActionTypeGroup[] = [
  {
    label: 'Common',
    types: ['run-action', 'run-function', 'set-option'],
  },
  {
    label: 'Advanced',
    types: ['set-variable', 'code-block', 'run-custom-action'],
  },
]

/** All action types in display order */
export const ACTION_TYPE_ORDER: readonly ManualKeymapActionType[] = [
  'run-action',
  'run-function',
  'set-option',
  'set-variable',
  'code-block',
  'run-custom-action',
]

/** Badge labels for keymap sources */
export const SOURCE_LABELS = {
  graph: 'From Graph Editor',
  project: 'Custom',
} as const
