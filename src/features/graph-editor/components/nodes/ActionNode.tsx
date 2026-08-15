import {
  Command,
  Keyboard,
  type LucideIcon,
  Palette,
  Settings,
  Variable,
  Zap,
} from 'lucide-react'
import { memo } from 'react'
import { getOptionDefinition } from '@/shared/lib/neovim-options/catalog'
import type { ActionNodeData, Port } from '@/shared/types'
import {
  CREATE_AUTOCMD_OUTPUT_PORTS,
  resolveNodeDisplayName,
} from '@/shared/types'
import { BaseNode } from './BaseNode'

const ACTION_INPUTS: Port[] = [
  { id: 'exec', label: 'Execute', dataType: 'void', required: true },
]

const ACTION_FLOW_OUTPUT: Port = {
  id: 'done',
  label: 'Then',
  dataType: 'void',
  required: false,
}

interface ActionNodeProps {
  data: ActionNodeData
  selected?: boolean
}

interface ActionVisual {
  icon: LucideIcon
  summary: string
}

export function inferPortTypeFromOptionType(
  valueType: string | undefined,
): 'string' | 'number' | 'boolean' | 'any' {
  switch (valueType) {
    case 'string':
    case 'string-list':
    case 'char-list':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'any'
  }
}

function getSetOptionVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'set-option') {
    return { icon: Settings, summary: 'Choose option and value' }
  }

  const optionName = data.actionConfig.optionName.trim()
  const { valueConfig } = data.actionConfig

  let valueSummary: string
  if (valueConfig.valueMode === 'suggested') {
    valueSummary = summarizeValue(valueConfig.suggestedValue)
  } else {
    // raw mode
    const rawValue = valueConfig.rawValue
    valueSummary = rawValue.length === 0 ? '""' : `"${rawValue}"`
  }

  return {
    icon: Settings,
    summary:
      optionName.length > 0
        ? `${optionName} = ${valueSummary}`
        : 'Choose option and value',
  }
}

function getRunActionVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'run-action') {
    return { icon: Command, summary: 'Action is empty' }
  }

  const action = data.actionConfig.action.trim()
  return {
    icon: Command,
    summary: action.length > 0 ? action : 'Action is empty',
  }
}

function getSetKeymapVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'set-keymap') {
    return { icon: Keyboard, summary: 'Define modes and key sequence' }
  }

  const modeList = data.actionConfig.modes.join(',')
  const key = data.actionConfig.keySequence.trim()
  return {
    icon: Keyboard,
    summary:
      key.length > 0
        ? `[${modeList || '-'}] ${key}`
        : 'Define modes and key sequence',
  }
}

function getSetVariableVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'set-variable') {
    return { icon: Variable, summary: 'Set variable name and value' }
  }

  const name = data.actionConfig.variableName.trim()
  return {
    icon: Variable,
    summary:
      name.length > 0
        ? `${data.actionConfig.scope}:${name} = ${summarizeValue(data.actionConfig.value)}`
        : 'Set variable name and value',
  }
}

function getGetVariableVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'get-variable') {
    return { icon: Variable, summary: 'Get variable name' }
  }

  const name = data.actionConfig.variableName.trim()
  return {
    icon: Variable,
    summary:
      name.length > 0
        ? `${data.actionConfig.scope}:${name}`
        : 'Get variable name',
  }
}

function getCreateAutocmdVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'create-autocmd') {
    return { icon: Zap, summary: 'Select at least one event' }
  }

  const events = data.actionConfig.events.join(', ')
  return {
    icon: Zap,
    summary: events.length > 0 ? events : 'Select at least one event',
  }
}

function getSetHighlightVisual(data: ActionNodeData): ActionVisual {
  if (data.actionConfig.actionConfigType !== 'set-highlight') {
    return { icon: Palette, summary: 'Set highlight group name' }
  }

  const group = data.actionConfig.groupName.trim()
  return {
    icon: Palette,
    summary: group.length > 0 ? group : 'Set highlight group name',
  }
}

function summarizeValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return value.length === 0 ? '""' : `"${value}"`
  }
  return String(value)
}

function getActionVisual(data: ActionNodeData): ActionVisual {
  switch (data.actionConfig.actionConfigType) {
    case 'set-option':
      return getSetOptionVisual(data)
    case 'run-action':
      return getRunActionVisual(data)
    case 'set-keymap':
      return getSetKeymapVisual(data)
    case 'set-variable':
      return getSetVariableVisual(data)
    case 'get-variable':
      return getGetVariableVisual(data)
    case 'create-autocmd':
      return getCreateAutocmdVisual(data)
    case 'set-highlight':
      return getSetHighlightVisual(data)
  }
}

function getActionInputs(data: ActionNodeData): Port[] {
  // Set Option has an additional 'value' input port for data flow
  if (data.actionType === 'set-option') {
    const option = getOptionDefinition(data.actionConfig.optionName)
    const portType = inferPortTypeFromOptionType(option?.valueType)

    return [
      ...ACTION_INPUTS,
      {
        id: 'value',
        label: 'Value',
        dataType: portType,
        required: false,
      },
    ]
  }

  if (data.actionType === 'set-keymap') {
    return [
      ...ACTION_INPUTS,
      {
        id: 'on-press',
        label: 'On Press',
        dataType: 'string',
        required: false,
      },
      {
        id: 'key-sequence',
        label: 'Key Sequence',
        dataType: 'string',
        required: false,
      },
    ]
  }

  if (data.actionType === 'set-variable') {
    return [
      ...ACTION_INPUTS,
      {
        id: 'value',
        label: 'Value',
        dataType: 'any',
        required: false,
      },
    ]
  }

  if (data.actionType === 'set-highlight') {
    return [
      ...ACTION_INPUTS,
      {
        id: 'foreground',
        label: 'Foreground',
        dataType: 'string',
        required: false,
      },
      {
        id: 'background',
        label: 'Background',
        dataType: 'string',
        required: false,
      },
      {
        id: 'group-name',
        label: 'Group Name',
        dataType: 'string',
        required: false,
      },
    ]
  }

  return ACTION_INPUTS
}

/**
 * Get output ports for an action node.
 *
 * Create Autocmd has two outputs:
 * - "Then" (done): Immediate continuation after autocmd registration
 * - "On Event" (on-event): Future callback execution branch when event fires.
 */
function getActionOutputs(data: ActionNodeData): Port[] {
  // Create Autocmd has two control-flow outputs: Then and On Event
  if (data.actionType === 'create-autocmd') {
    return [...CREATE_AUTOCMD_OUTPUT_PORTS]
  }

  // Get Variable has a data output port
  if (data.actionType === 'get-variable') {
    return [
      ACTION_FLOW_OUTPUT,
      {
        id: 'value',
        label: 'Value',
        dataType: 'any',
        required: false,
      },
    ]
  }

  return [ACTION_FLOW_OUTPUT]
}

export const ActionNode = memo(function ActionNode({
  data,
  selected,
}: ActionNodeProps) {
  const visual = getActionVisual(data)
  const inputs = getActionInputs(data)
  const outputs = getActionOutputs(data)

  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, data.label || 'Action')}
      icon={<visual.icon className="w-4 h-4" />}
      color="border-blue-500"
      inputs={inputs}
      outputs={outputs}
      selected={selected}
    >
      <p className="max-w-[220px] truncate text-xs text-muted-foreground">
        {visual.summary}
      </p>
    </BaseNode>
  )
})
