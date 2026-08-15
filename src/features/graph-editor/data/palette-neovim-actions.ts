import {
  Command,
  Download,
  Keyboard,
  type LucideIcon,
  Palette,
  Settings,
  Variable,
  Zap,
} from 'lucide-react'
import type {
  ActionNodeData,
  CoreActionType,
  NodeData,
  NodeType,
} from '@/shared/types'
import { createActionNodeData } from '@/shared/types'

export interface NeovimActionPaletteItem {
  id: CoreActionType
  type: NodeType
  label: string
  description: string
  icon: LucideIcon
  createData: () => NodeData
}

function createActionData(actionType: CoreActionType): ActionNodeData {
  return createActionNodeData(actionType)
}

export const NEOVIM_ACTION_PALETTE_ITEMS: readonly NeovimActionPaletteItem[] = [
  {
    id: 'set-option',
    type: 'action',
    label: 'Set Option',
    description: 'Set a core Neovim option value.',
    icon: Settings,
    createData: () => createActionData('set-option'),
  },
  {
    id: 'run-action',
    type: 'action',
    label: 'Run Action',
    description: 'Execute an Ex command or key sequence.',
    icon: Command,
    createData: () => createActionData('run-action'),
  },
  {
    id: 'set-keymap',
    type: 'action',
    label: 'Set Keymap',
    description: 'Define a key mapping for one or more modes.',
    icon: Keyboard,
    createData: () => createActionData('set-keymap'),
  },
  {
    id: 'set-variable',
    type: 'action',
    label: 'Set Variable',
    description: 'Set a scoped vim variable.',
    icon: Variable,
    createData: () => createActionData('set-variable'),
  },
  {
    id: 'get-variable',
    type: 'action',
    label: 'Get Variable',
    description: 'Read a scoped vim variable value.',
    icon: Download,
    createData: () => createActionData('get-variable'),
  },
  {
    id: 'create-autocmd',
    type: 'action',
    label: 'Create Autocmd',
    description: 'Register callback-based autocommands.',
    icon: Zap,
    createData: () => createActionData('create-autocmd'),
  },
  {
    id: 'set-highlight',
    type: 'action',
    label: 'Set Highlight',
    description: 'Configure a highlight group.',
    icon: Palette,
    createData: () => createActionData('set-highlight'),
  },
]
