import { normalizeAutocmdEventNames } from '@/shared/data/neovim/events'

// Node types in the graph editor
export type NodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'loop'
  | 'code-block'
  | 'graph-ref'
  | 'run-function'
  | 'builtin'
  | 'callable-entry'
  | 'return'

// Data types for node ports (used for data flow connections)
export type PortDataType =
  | 'any'
  | 'string'
  | 'number'
  | 'boolean'
  | 'buffer'
  | 'window'
  | 'table'
  | 'void'

export const PORT_DATA_TYPES: PortDataType[] = [
  'any',
  'string',
  'number',
  'boolean',
  'buffer',
  'window',
  'table',
  'void',
]

export function isPortDataType(value: string): value is PortDataType {
  return PORT_DATA_TYPES.includes(value as PortDataType)
}

export interface Port {
  id: string
  label: string
  dataType: PortDataType
  required?: boolean | undefined
}

export interface NodeDefinition {
  type: NodeType
  category: string
  label: string
  description: string
  inputs: Port[]
  outputs: Port[]
  // For plugin/builtin nodes, how to generate Lua
  luaTemplate?: string | undefined
}

// ============================================
// Node Data Types (Discriminated Union)
// ============================================
// Each node type has a specific data shape. This provides
// strong typing for node configuration.

export interface TriggerNodeData {
  readonly nodeType: 'trigger'
  displayName?: string
  /** Only 'startup' trigger type is supported in canonical format. Non-canonical values are rejected. */
  triggerType: 'startup'
}

export type CoreActionType =
  | 'set-option'
  | 'run-action'
  | 'set-keymap'
  | 'set-variable'
  | 'get-variable'
  | 'create-autocmd'
  | 'set-highlight'

export const CORE_ACTION_TYPES: CoreActionType[] = [
  'set-option',
  'run-action',
  'set-keymap',
  'set-variable',
  'get-variable',
  'create-autocmd',
  'set-highlight',
]

export type ActionScalarValue = string | number | boolean

// Set Option Value Config - Discriminated Union
export type SetOptionValueMode = 'suggested' | 'raw'

export type SetOptionValueConfig =
  | {
      valueMode: 'suggested'
      suggestedValue: ActionScalarValue
    }
  | {
      valueMode: 'raw'
      rawValue: string
    }

// Type guard for SetOptionValueConfig
export function isSetOptionValueConfig(
  value: unknown,
): value is SetOptionValueConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const mode = record['valueMode']
  if (mode !== 'suggested' && mode !== 'raw') {
    return false
  }
  if (mode === 'suggested') {
    const suggestedValue = record['suggestedValue']
    return (
      typeof suggestedValue === 'string' ||
      typeof suggestedValue === 'number' ||
      typeof suggestedValue === 'boolean'
    )
  }
  // mode === 'raw'
  return typeof record['rawValue'] === 'string'
}

export interface SetOptionActionConfig {
  readonly actionConfigType: 'set-option'
  optionName: string
  scope: 'global' | 'local'
  valueConfig: SetOptionValueConfig
}

export type RunActionMode = 'catalog' | 'custom-command' | 'custom-keys'

export type RunActionType = 'command' | 'keys'

export interface RunActionActionConfig {
  readonly actionConfigType: 'run-action'

  /** Mode: 'catalog' for preset selection, 'custom-command' or 'custom-keys' for manual entry */
  mode: RunActionMode

  /** Type of action: Ex command or key sequence */
  actionType: RunActionType

  /** The resolved action string (command or key sequence) */
  action: string

  /**
   * Unique key identifying the selected catalog item.
   * Format: 'write', 'yank-clipboard', 'set-mark'
   * Empty string when in custom mode.
   */
  selectedActionKey: string

  /**
   * Parameter values for parameterized actions.
   * Keys are param names, values are user input.
   */
  paramValues: Record<string, string>
}

export type KeymapMode = 'n' | 'i' | 'v' | 'x' | 't' | 'c' | 'o' | 's'

/** Canonical keymap mode tuple in required canonical order */
export const KEYMAP_MODES: KeymapMode[] = [
  'n',
  'i',
  'c',
  't',
  'x',
  's',
  'o',
  'v',
] as const

/** Type guard for KeymapMode backed by the canonical tuple */
export function isKeymapMode(value: string): value is KeymapMode {
  return KEYMAP_MODES.includes(value as KeymapMode)
}

/** Variable scope tuple for 'g|b|w|t|v' */
export type VariableScope = 'g' | 'b' | 'w' | 't' | 'v'
export const VARIABLE_SCOPES: VariableScope[] = [
  'g',
  'b',
  'w',
  't',
  'v',
] as const

/** Type guard for VariableScope */
export function isVariableScope(value: string): value is VariableScope {
  return VARIABLE_SCOPES.includes(value as VariableScope)
}

/** Set-variable value type tuple */
export type SetVariableValueType = 'raw' | 'string' | 'number' | 'boolean'
export const SET_VARIABLE_VALUE_TYPES: SetVariableValueType[] = [
  'raw',
  'string',
  'number',
  'boolean',
] as const

/** Type guard for SetVariableValueType */
export function isSetVariableValueType(
  value: string,
): value is SetVariableValueType {
  return SET_VARIABLE_VALUE_TYPES.includes(value as SetVariableValueType)
}

/**
 * Check if a value is compatible with the specified valueType for set-variable.
 * - 'raw' => string (Lua expression)
 * - 'string' => string
 * - 'number' => finite number
 * - 'boolean' => boolean
 */
export function isSetVariableValueCompatible(
  valueType: SetVariableValueType,
  value: unknown,
): boolean {
  switch (valueType) {
    case 'raw':
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    default:
      return false
  }
}

export interface SetKeymapActionConfig {
  readonly actionConfigType: 'set-keymap'
  modes: KeymapMode[]
  keySequence: string
  command: string
  description: string
  silent: boolean
  noremap: boolean
  expr: boolean
  /** Whether this keymap appears in the centralized Keymaps panel. Default: true */
  showInKeymaps: boolean
}

export interface SetVariableActionConfig {
  readonly actionConfigType: 'set-variable'
  scope: 'g' | 'b' | 'w' | 't' | 'v'
  variableName: string
  valueType: 'string' | 'number' | 'boolean' | 'raw'
  value: ActionScalarValue // When valueType is 'raw', value is a string containing a Lua expression
}

export interface GetVariableActionConfig {
  readonly actionConfigType: 'get-variable'
  scope: 'g' | 'b' | 'w' | 't' | 'v'
  variableName: string
}

export interface CreateAutocmdActionConfig {
  readonly actionConfigType: 'create-autocmd'
  events: string[]
  /** Multiple patterns for file matching. Empty array normalizes to ['*']. */
  patterns: string[]
  callbackLua: string
  groupName: string
  /** Run this autocommand a single time, then remove it. */
  once: boolean
  /** Allow commands inside this callback to trigger other autocommands. */
  nested: boolean
}

/**
 * Output port IDs for the Create Autocmd action node.
 * These represent the control-flow branches available when using this node.
 *
 * - 'done' (labeled "Then"): Immediate continuation after autocmd registration.
 *   This is the default flow that executes right after the autocmd is created.
 *
 * - 'on-event' (labeled "On Event"): Future callback execution branch when the
 *   registered event fires. When connected, the callbackLua field becomes secondary.
 */
export type CreateAutocmdActionOutputPortId = 'done' | 'on-event'

/**
 * Port definitions for Create Autocmd outputs.
 * Used by UI and validation to ensure consistent port contracts.
 */
export const CREATE_AUTOCMD_OUTPUT_PORTS: readonly Port[] = [
  { id: 'done', label: 'Then', dataType: 'void', required: false },
  { id: 'on-event', label: 'On Event', dataType: 'void', required: false },
] as const

export interface SetHighlightActionConfig {
  readonly actionConfigType: 'set-highlight'
  groupName: string
  foreground: string
  background: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export type ActionConfig =
  | SetOptionActionConfig
  | RunActionActionConfig
  | SetKeymapActionConfig
  | SetVariableActionConfig
  | GetVariableActionConfig
  | CreateAutocmdActionConfig
  | SetHighlightActionConfig

export type ActionConfigByType = {
  'set-option': SetOptionActionConfig
  'run-action': RunActionActionConfig
  'set-keymap': SetKeymapActionConfig
  'set-variable': SetVariableActionConfig
  'get-variable': GetVariableActionConfig
  'create-autocmd': CreateAutocmdActionConfig
  'set-highlight': SetHighlightActionConfig
}

export type ActionConfigFor<T extends CoreActionType> = ActionConfigByType[T]

interface ActionNodeDataBase {
  readonly nodeType: 'action'
  displayName?: string
  label: string
}

export type ActionNodeData =
  | (ActionNodeDataBase & {
      actionType: 'set-option'
      actionConfig: SetOptionActionConfig
    })
  | (ActionNodeDataBase & {
      actionType: 'run-action'
      actionConfig: RunActionActionConfig
    })
  | (ActionNodeDataBase & {
      actionType: 'set-keymap'
      actionConfig: SetKeymapActionConfig
    })
  | (ActionNodeDataBase & {
      actionType: 'set-variable'
      actionConfig: SetVariableActionConfig
    })
  | (ActionNodeDataBase & {
      actionType: 'get-variable'
      actionConfig: GetVariableActionConfig
    })
  | (ActionNodeDataBase & {
      actionType: 'create-autocmd'
      actionConfig: CreateAutocmdActionConfig
    })
  | (ActionNodeDataBase & {
      actionType: 'set-highlight'
      actionConfig: SetHighlightActionConfig
    })

export type ActionNodeDataFor<T extends CoreActionType> = Extract<
  ActionNodeData,
  { actionType: T }
>

export type ConditionOperator = '==' | '~=' | '>' | '>=' | '<' | '<='

export const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  '==',
  '~=',
  '>',
  '>=',
  '<',
  '<=',
]

export function isConditionOperator(value: string): value is ConditionOperator {
  return CONDITION_OPERATORS.includes(value as ConditionOperator)
}

export interface ConditionNodeData {
  readonly nodeType: 'condition'
  displayName?: string
  operator: ConditionOperator
  hardcodedA: string
  hardcodedB: string
}

export interface LoopNodeData {
  readonly nodeType: 'loop'
  displayName?: string
  loopType: 'for' | 'while' | 'each'
  iteratorVariable: string
  iterableExpression: string
}

export interface CodeBlockDataPort {
  id: string
  name: string
  dataType: PortDataType
}

export interface CodeBlockNodeData {
  readonly nodeType: 'code-block'
  displayName?: string
  code: string
  inputs: CodeBlockDataPort[]
  outputs: CodeBlockDataPort[]
}

export interface GraphRefNodeData {
  readonly nodeType: 'graph-ref'
  displayName?: string
  referencedGraphId: string
  /**
   * Cached copy of target graph's callable contract.
   * Used to render ports. Updated when target graph changes.
   */
  cachedContract?:
    | {
        parameters: CallablePort[]
        returnValues: CallablePort[]
      }
    | undefined
}

// ============================================
// Callable Entry Node
// ============================================

export interface CallablePort {
  id: string
  name: string // User-editable label
  dataType: PortDataType
  description?: string
}

export interface CallableEntryNodeData {
  readonly nodeType: 'callable-entry'
  displayName?: string
  /** User-defined parameters that become input ports on graph-ref nodes */
  parameters: CallablePort[]
}

// ============================================
// Return Node
// ============================================

export interface ReturnNodeData {
  readonly nodeType: 'return'
  displayName?: string
  /** User-defined return values */
  returnValues: CallablePort[]
}

export interface RunFunctionNodeData {
  readonly nodeType: 'run-function'
  displayName?: string | undefined
  selectedFunctionKey: string
  functionSource: import('./run-function').RunFunctionSource
  signature: import('./run-function').RunFunctionSignatureSnapshot | null
  paramDefaults: Record<
    string,
    import('./run-function').RunFunctionDefaultValue
  >
}

export function isRunFunctionNodeData(
  data: NodeData,
): data is RunFunctionNodeData {
  return data.nodeType === 'run-function'
}

export interface BuiltinNodeData {
  readonly nodeType: 'builtin'
  displayName?: string
  builtinId: string
  config: Record<string, unknown>
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function readString(
  source: UnknownRecord,
  key: string,
  fallback: string,
): string {
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

function readOptionalString(
  source: UnknownRecord,
  key: string,
): string | undefined {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

function normalizeDisplayName(value: string | undefined): string {
  return value?.trim() ?? ''
}

function readDisplayName(source: UnknownRecord): string {
  return normalizeDisplayName(readOptionalString(source, 'displayName'))
}

function readBoolean(
  source: UnknownRecord,
  key: string,
  fallback: boolean,
): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : fallback
}

function readStringArray(source: UnknownRecord, key: string): string[] {
  const value = source[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function normalizePatternEntries(entries: readonly string[]): string[] {
  const normalizedPatterns: string[] = []
  const seenPatterns = new Set<string>()

  for (const entry of entries) {
    const trimmedPattern = entry.trim()
    if (trimmedPattern.length === 0 || seenPatterns.has(trimmedPattern)) {
      continue
    }

    seenPatterns.add(trimmedPattern)
    normalizedPatterns.push(trimmedPattern)
  }

  return normalizedPatterns.length > 0 ? normalizedPatterns : ['*']
}

function normalizeTriggerNodeData(data: unknown): TriggerNodeData {
  if (!isRecord(data)) {
    return {
      nodeType: 'trigger',
      displayName: '',
      triggerType: 'startup',
    }
  }

  // Only 'startup' trigger type is supported in canonical format.
  const displayName = readDisplayName(data)

  return {
    nodeType: 'trigger',
    displayName,
    triggerType: 'startup',
  }
}

function readActionScalarValue(
  source: UnknownRecord,
  key: string,
  fallback: ActionScalarValue,
): ActionScalarValue {
  const value = source[key]
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  return fallback
}

export function isCoreActionType(value: string): value is CoreActionType {
  return CORE_ACTION_TYPES.includes(value as CoreActionType)
}

function isActionConfigType(value: string): value is CoreActionType {
  return isCoreActionType(value)
}

export function getActionLabel(actionType: CoreActionType): string {
  switch (actionType) {
    case 'set-option':
      return 'Set Option'
    case 'run-action':
      return 'Run Action'
    case 'set-keymap':
      return 'Set Keymap'
    case 'set-variable':
      return 'Set Variable'
    case 'get-variable':
      return 'Get Variable'
    case 'create-autocmd':
      return 'Create Autocmd'
    case 'set-highlight':
      return 'Set Highlight'
  }
}

export function createDefaultActionConfig(
  actionType: 'set-option',
): SetOptionActionConfig
export function createDefaultActionConfig(
  actionType: 'run-action',
): RunActionActionConfig
export function createDefaultActionConfig(
  actionType: 'set-keymap',
): SetKeymapActionConfig
export function createDefaultActionConfig(
  actionType: 'set-variable',
): SetVariableActionConfig
export function createDefaultActionConfig(
  actionType: 'get-variable',
): GetVariableActionConfig
export function createDefaultActionConfig(
  actionType: 'create-autocmd',
): CreateAutocmdActionConfig
export function createDefaultActionConfig(
  actionType: 'set-highlight',
): SetHighlightActionConfig
export function createDefaultActionConfig(
  actionType: CoreActionType,
): ActionConfig
export function createDefaultActionConfig(
  actionType: CoreActionType,
): ActionConfig {
  switch (actionType) {
    case 'set-option':
      return {
        actionConfigType: 'set-option',
        optionName: 'number',
        scope: 'global',
        valueConfig: {
          valueMode: 'suggested',
          suggestedValue: true,
        },
      }
    case 'run-action':
      return {
        actionConfigType: 'run-action',
        mode: 'catalog',
        actionType: 'command',
        action: '',
        selectedActionKey: '',
        paramValues: {},
      }
    case 'set-keymap':
      return {
        actionConfigType: 'set-keymap',
        modes: ['n'],
        keySequence: '<leader>xx',
        command: '<cmd>echo "Mapped!"<CR>',
        description: '',
        silent: true,
        noremap: true,
        expr: false,
        showInKeymaps: true,
      }
    case 'set-variable':
      return {
        actionConfigType: 'set-variable',
        scope: 'g',
        variableName: 'example_variable',
        valueType: 'string',
        value: 'value',
      }
    case 'get-variable':
      return {
        actionConfigType: 'get-variable',
        scope: 'g',
        variableName: 'example_variable',
      }
    case 'create-autocmd':
      return {
        actionConfigType: 'create-autocmd',
        events: ['BufEnter'],
        patterns: ['*'],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }
    case 'set-highlight':
      return {
        actionConfigType: 'set-highlight',
        groupName: 'MyHighlight',
        foreground: '',
        background: '',
        bold: false,
        italic: false,
        underline: false,
      }
  }
}

interface CreateActionNodeDataOptions<T extends CoreActionType> {
  label?: string
  displayName?: string
  actionConfig?: ActionConfigFor<T>
}

export function createActionNodeData(
  actionType: 'set-option',
  options?: CreateActionNodeDataOptions<'set-option'>,
): ActionNodeDataFor<'set-option'>
export function createActionNodeData(
  actionType: 'run-action',
  options?: CreateActionNodeDataOptions<'run-action'>,
): ActionNodeDataFor<'run-action'>
export function createActionNodeData(
  actionType: 'set-keymap',
  options?: CreateActionNodeDataOptions<'set-keymap'>,
): ActionNodeDataFor<'set-keymap'>
export function createActionNodeData(
  actionType: 'set-variable',
  options?: CreateActionNodeDataOptions<'set-variable'>,
): ActionNodeDataFor<'set-variable'>
export function createActionNodeData(
  actionType: 'get-variable',
  options?: CreateActionNodeDataOptions<'get-variable'>,
): ActionNodeDataFor<'get-variable'>
export function createActionNodeData(
  actionType: 'create-autocmd',
  options?: CreateActionNodeDataOptions<'create-autocmd'>,
): ActionNodeDataFor<'create-autocmd'>
export function createActionNodeData(
  actionType: 'set-highlight',
  options?: CreateActionNodeDataOptions<'set-highlight'>,
): ActionNodeDataFor<'set-highlight'>
export function createActionNodeData(
  actionType: CoreActionType,
  options?: {
    label?: string
    displayName?: string
    actionConfig?: ActionConfig
  },
): ActionNodeData
export function createActionNodeData(
  actionType: CoreActionType,
  options?: {
    label?: string
    displayName?: string
    actionConfig?: ActionConfig
  },
): ActionNodeData {
  const label = options?.label ?? getActionLabel(actionType)
  const displayName = normalizeDisplayName(options?.displayName)

  switch (actionType) {
    case 'set-option':
      return {
        nodeType: 'action',
        actionType: 'set-option',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'set-option',
          options?.actionConfig,
        ),
      }
    case 'run-action':
      return {
        nodeType: 'action',
        actionType: 'run-action',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'run-action',
          options?.actionConfig,
        ),
      }
    case 'set-keymap':
      return {
        nodeType: 'action',
        actionType: 'set-keymap',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'set-keymap',
          options?.actionConfig,
        ),
      }
    case 'set-variable':
      return {
        nodeType: 'action',
        actionType: 'set-variable',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'set-variable',
          options?.actionConfig,
        ),
      }
    case 'get-variable':
      return {
        nodeType: 'action',
        actionType: 'get-variable',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'get-variable',
          options?.actionConfig,
        ),
      }
    case 'create-autocmd':
      return {
        nodeType: 'action',
        actionType: 'create-autocmd',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'create-autocmd',
          options?.actionConfig,
        ),
      }
    case 'set-highlight':
      return {
        nodeType: 'action',
        actionType: 'set-highlight',
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'set-highlight',
          options?.actionConfig,
        ),
      }
  }
}

/**
 * Normalizes SetOptionValueConfig from input.
 * Returns the valueConfig if valid, otherwise returns a default config.
 * Invalid/legacy data is not migrated - callers should ensure valid input.
 */
function normalizeSetOptionValueConfig(
  input: UnknownRecord,
): SetOptionValueConfig {
  const valueConfig = input['valueConfig']
  if (isSetOptionValueConfig(valueConfig)) {
    return valueConfig
  }

  // Invalid/missing valueConfig - return default (no legacy migration)
  return { valueMode: 'suggested', suggestedValue: true }
}

function normalizeSetOptionActionConfig(
  input: UnknownRecord,
): SetOptionActionConfig {
  const defaults = createDefaultActionConfig('set-option')
  const scope = input['scope']
  const optionName = readString(input, 'optionName', defaults.optionName)

  return {
    actionConfigType: 'set-option',
    optionName,
    scope: scope === 'local' || scope === 'global' ? scope : defaults.scope,
    valueConfig: normalizeSetOptionValueConfig(input),
  }
}

function normalizeRunActionActionConfig(
  input: UnknownRecord,
): RunActionActionConfig {
  const defaults = createDefaultActionConfig('run-action')
  const mode = input['mode']

  // Normalize paramValues - ensure it's a Record<string, string>
  const rawParamValues = input['paramValues']
  const paramValues: Record<string, string> = {}
  if (isRecord(rawParamValues)) {
    for (const [key, value] of Object.entries(rawParamValues)) {
      if (typeof value === 'string') {
        paramValues[key] = value
      }
    }
  }

  // Normal parsing for 'run-action' configs
  const newMode: RunActionMode =
    mode === 'catalog' || mode === 'custom-command' || mode === 'custom-keys'
      ? mode
      : defaults.mode

  const actionTypeValue = input['actionType']
  const actionType: RunActionType =
    actionTypeValue === 'keys' ? 'keys' : 'command'

  return {
    actionConfigType: 'run-action',
    mode: newMode,
    actionType,
    action: readString(input, 'action', defaults.action),
    selectedActionKey: readString(
      input,
      'selectedActionKey',
      defaults.selectedActionKey,
    ),
    paramValues:
      Object.keys(paramValues).length > 0 ? paramValues : defaults.paramValues,
  }
}

function normalizeSetKeymapActionConfig(
  input: UnknownRecord,
): SetKeymapActionConfig {
  const defaults = createDefaultActionConfig('set-keymap')
  const modes = readStringArray(input, 'modes').filter(isKeymapMode)

  return {
    actionConfigType: 'set-keymap',
    modes: modes.length > 0 ? modes : defaults.modes,
    keySequence: readString(input, 'keySequence', defaults.keySequence),
    command: readString(input, 'command', defaults.command),
    description: readString(input, 'description', defaults.description),
    silent: readBoolean(input, 'silent', defaults.silent),
    noremap: readBoolean(input, 'noremap', defaults.noremap),
    expr: readBoolean(input, 'expr', defaults.expr),
    showInKeymaps: readBoolean(input, 'showInKeymaps', true),
  }
}

function normalizeSetVariableActionConfig(
  input: UnknownRecord,
): SetVariableActionConfig {
  const defaults = createDefaultActionConfig('set-variable')
  const scope = input['scope']
  const valueType = input['valueType']

  return {
    actionConfigType: 'set-variable',
    scope:
      scope === 'g' ||
      scope === 'b' ||
      scope === 'w' ||
      scope === 't' ||
      scope === 'v'
        ? scope
        : defaults.scope,
    variableName: readString(input, 'variableName', defaults.variableName),
    valueType:
      valueType === 'string' ||
      valueType === 'number' ||
      valueType === 'boolean' ||
      valueType === 'raw'
        ? valueType
        : defaults.valueType,
    value: readActionScalarValue(input, 'value', defaults.value),
  }
}

function normalizeGetVariableActionConfig(
  input: UnknownRecord,
): GetVariableActionConfig {
  const defaults = createDefaultActionConfig('get-variable')
  const scope = input['scope']

  return {
    actionConfigType: 'get-variable',
    scope:
      scope === 'g' ||
      scope === 'b' ||
      scope === 'w' ||
      scope === 't' ||
      scope === 'v'
        ? scope
        : defaults.scope,
    variableName: readString(input, 'variableName', defaults.variableName),
  }
}

/**
 * Normalizes event names for Create Autocmd configuration.
 * - Trims whitespace
 * - Case-canonicalizes to known catalog names (e.g., "bufreadpre" -> "BufReadPre")
 * - Preserves canonical custom User events (e.g., "UserMyEvent")
 * - Deduplicates case-insensitively
 * - Filters out unknown/invalid events
 */
export function normalizeCreateAutocmdEvents(
  events: readonly string[],
): string[] {
  return normalizeAutocmdEventNames(events)
}

function normalizeCreateAutocmdActionConfig(
  input: UnknownRecord,
): CreateAutocmdActionConfig {
  const defaults = createDefaultActionConfig('create-autocmd')
  const rawEventsValue = input['events']
  const rawEvents: string[] = Array.isArray(rawEventsValue)
    ? rawEventsValue.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : defaults.events

  // Only accept canonical 'patterns' array format (no legacy migration)
  const patternsArray = readStringArray(input, 'patterns')
  const patterns: string[] =
    patternsArray.length > 0 ? patternsArray : defaults.patterns

  // Normalize events: trim, case-canonicalize, dedupe, filter unknown
  const normalizedEvents = normalizeCreateAutocmdEvents(rawEvents)

  return {
    actionConfigType: 'create-autocmd',
    events: normalizedEvents,
    patterns: normalizePatternEntries(patterns),
    callbackLua: readString(input, 'callbackLua', defaults.callbackLua),
    groupName: readString(input, 'groupName', defaults.groupName),
    once: readBoolean(input, 'once', defaults.once),
    nested: readBoolean(input, 'nested', defaults.nested),
  }
}

function normalizeSetHighlightActionConfig(
  input: UnknownRecord,
): SetHighlightActionConfig {
  const defaults = createDefaultActionConfig('set-highlight')

  return {
    actionConfigType: 'set-highlight',
    groupName: readString(input, 'groupName', defaults.groupName),
    foreground: readString(input, 'foreground', defaults.foreground),
    background: readString(input, 'background', defaults.background),
    bold: readBoolean(input, 'bold', defaults.bold),
    italic: readBoolean(input, 'italic', defaults.italic),
    underline: readBoolean(input, 'underline', defaults.underline),
  }
}

function normalizeActionConfig(
  actionType: 'set-option',
  input: unknown,
): SetOptionActionConfig
function normalizeActionConfig(
  actionType: 'run-action',
  input: unknown,
): RunActionActionConfig
function normalizeActionConfig(
  actionType: 'set-keymap',
  input: unknown,
): SetKeymapActionConfig
function normalizeActionConfig(
  actionType: 'set-variable',
  input: unknown,
): SetVariableActionConfig
function normalizeActionConfig(
  actionType: 'get-variable',
  input: unknown,
): GetVariableActionConfig
function normalizeActionConfig(
  actionType: 'create-autocmd',
  input: unknown,
): CreateAutocmdActionConfig
function normalizeActionConfig(
  actionType: 'set-highlight',
  input: unknown,
): SetHighlightActionConfig
function normalizeActionConfig(
  actionType: CoreActionType,
  input: unknown,
): ActionConfig {
  if (!isRecord(input)) {
    return createDefaultActionConfig(actionType)
  }

  switch (actionType) {
    case 'set-option':
      return normalizeSetOptionActionConfig(input)
    case 'run-action':
      return normalizeRunActionActionConfig(input)
    case 'set-keymap':
      return normalizeSetKeymapActionConfig(input)
    case 'set-variable':
      return normalizeSetVariableActionConfig(input)
    case 'get-variable':
      return normalizeGetVariableActionConfig(input)
    case 'create-autocmd':
      return normalizeCreateAutocmdActionConfig(input)
    case 'set-highlight':
      return normalizeSetHighlightActionConfig(input)
  }
}

function resolveActionType(
  actionTypeValue: unknown,
  actionConfigValue: unknown,
): CoreActionType {
  if (
    typeof actionTypeValue === 'string' &&
    isCoreActionType(actionTypeValue)
  ) {
    return actionTypeValue
  }

  if (isRecord(actionConfigValue)) {
    const configTypeValue = actionConfigValue['actionConfigType']
    if (
      typeof configTypeValue === 'string' &&
      isActionConfigType(configTypeValue)
    ) {
      return configTypeValue
    }
  }

  return 'run-action'
}

export function normalizeActionNodeData(data: unknown): ActionNodeData {
  if (!isRecord(data)) {
    return createActionNodeData('run-action')
  }

  const actionType = resolveActionType(data['actionType'], data['actionConfig'])
  const displayName = readDisplayName(data)
  const normalizedLabel = readString(
    data,
    'label',
    getActionLabel(actionType),
  ).trim()
  const label =
    normalizedLabel.length > 0 ? normalizedLabel : getActionLabel(actionType)

  switch (actionType) {
    case 'set-option':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig('set-option', data['actionConfig']),
      })
    case 'run-action':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig('run-action', data['actionConfig']),
      })
    case 'set-keymap':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig('set-keymap', data['actionConfig']),
      })
    case 'set-variable':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'set-variable',
          data['actionConfig'],
        ),
      })
    case 'get-variable':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'get-variable',
          data['actionConfig'],
        ),
      })
    case 'create-autocmd':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'create-autocmd',
          data['actionConfig'],
        ),
      })
    case 'set-highlight':
      return createActionNodeData(actionType, {
        displayName,
        label,
        actionConfig: normalizeActionConfig(
          'set-highlight',
          data['actionConfig'],
        ),
      })
  }
}

function normalizeCodeBlockDataPort(
  value: unknown,
  fallbackId: string,
): CodeBlockDataPort | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readString(value, 'id', fallbackId).trim()
  const name = readString(value, 'name', id).trim()
  const dataTypeValue = readString(value, 'dataType', 'any')

  return {
    id: id.length > 0 ? id : fallbackId,
    name,
    dataType: isPortDataType(dataTypeValue) ? dataTypeValue : 'any',
  }
}

function normalizeCodeBlockPortArray(
  value: unknown,
  prefix: 'input' | 'output',
): CodeBlockDataPort[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalizedPorts: CodeBlockDataPort[] = []

  for (const [index, entry] of value.entries()) {
    const normalizedPort = normalizeCodeBlockDataPort(
      entry,
      `${prefix}-${index + 1}`,
    )
    if (normalizedPort) {
      normalizedPorts.push(normalizedPort)
    }
  }

  return normalizedPorts
}

export function normalizeCodeBlockNodeData(data: unknown): CodeBlockNodeData {
  if (!isRecord(data)) {
    return {
      nodeType: 'code-block',
      displayName: '',
      code: '',
      inputs: [],
      outputs: [],
    }
  }

  return {
    nodeType: 'code-block',
    displayName: readDisplayName(data),
    code: readString(data, 'code', ''),
    inputs: normalizeCodeBlockPortArray(data['inputs'], 'input'),
    outputs: normalizeCodeBlockPortArray(data['outputs'], 'output'),
  }
}

export function resolveNodeDisplayName(
  displayName: string | undefined,
  fallbackLabel: string,
): string {
  const normalized = normalizeDisplayName(displayName)
  return normalized.length > 0 ? normalized : fallbackLabel
}

/**
 * Build a condition expression preview from builder fields.
 * Used for both node preview and the condition compatibility field.
 */
export function buildConditionExpression(
  hardcodedA: string,
  operator: ConditionOperator,
  hardcodedB: string,
): string {
  const a = hardcodedA.trim()
  const b = hardcodedB.trim()

  if (a.length === 0 || b.length === 0) {
    return ''
  }

  return `${a} ${operator} ${b}`
}

/**
 * Get a display label for an input source (for preview UI).
 */
export function getInputSourceLabel(
  hardcodedValue: string,
  isConnected: boolean,
): string {
  if (isConnected) {
    return 'Connected'
  }
  const trimmed = hardcodedValue.trim()
  if (trimmed.length === 0) {
    return 'Unset'
  }
  return trimmed
}

// Discriminated union of all node data types
export type NodeData =
  | TriggerNodeData
  | ActionNodeData
  | ConditionNodeData
  | LoopNodeData
  | CodeBlockNodeData
  | GraphRefNodeData
  | RunFunctionNodeData
  | BuiltinNodeData
  | CallableEntryNodeData
  | ReturnNodeData

// ============================================
// Graph Node (uses discriminated union)
// ============================================

export interface GraphNode<T extends NodeData = NodeData> {
  id: string
  type: NodeType
  definitionId: string // References a NodeDefinition
  position: { x: number; y: number }
  data: T
}

// Type guard helpers for narrowing node data
export function isTriggerNode(
  node: GraphNode,
): node is GraphNode<TriggerNodeData> {
  return node.data.nodeType === 'trigger'
}

export function isActionNode(
  node: GraphNode,
): node is GraphNode<ActionNodeData> {
  return node.data.nodeType === 'action'
}

export function isConditionNode(
  node: GraphNode,
): node is GraphNode<ConditionNodeData> {
  return node.data.nodeType === 'condition'
}

export function isCodeBlockNode(
  node: GraphNode,
): node is GraphNode<CodeBlockNodeData> {
  return node.data.nodeType === 'code-block'
}

export function isLoopNode(node: GraphNode): node is GraphNode<LoopNodeData> {
  return node.data.nodeType === 'loop'
}

export function isGraphRefNode(
  node: GraphNode,
): node is GraphNode<GraphRefNodeData> {
  return node.data.nodeType === 'graph-ref'
}

export function isRunFunctionNode(
  node: GraphNode,
): node is GraphNode<RunFunctionNodeData> {
  return node.data.nodeType === 'run-function'
}

export function isBuiltinNode(
  node: GraphNode,
): node is GraphNode<BuiltinNodeData> {
  return node.data.nodeType === 'builtin'
}

export function isCallableEntryNode(
  node: GraphNode,
): node is GraphNode<CallableEntryNodeData> {
  return node.data.nodeType === 'callable-entry'
}

export function isReturnNode(
  node: GraphNode,
): node is GraphNode<ReturnNodeData> {
  return node.data.nodeType === 'return'
}

// ============================================
// Graph Edge & Graph
// ============================================

export interface GraphEdge {
  id: string
  source: string // Node ID
  sourcePort: string // Port ID
  target: string // Node ID
  targetPort: string // Port ID
}

export interface GraphViewport {
  x: number
  y: number
  zoom: number
}

export interface Graph {
  id: string
  name: string
  description?: string | undefined
  nodes: GraphNode[]
  edges: GraphEdge[]
  viewport?: GraphViewport | undefined
  createdAt: number
  updatedAt: number
  /** Whether this graph is enabled (user intent). Defaults to true. */
  enabled: boolean
  /** Display order for sorting in the graph list. Lower values appear first. */
  order: number
}

export function normalizeGraphForEditor(graph: Graph): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      switch (node.data.nodeType) {
        case 'action':
          return {
            ...node,
            data: normalizeActionNodeData(node.data),
          }
        case 'code-block':
          return {
            ...node,
            data: normalizeCodeBlockNodeData(node.data),
          }
        case 'trigger':
          return {
            ...node,
            data: normalizeTriggerNodeData(node.data),
          }
        case 'condition':
          return {
            ...node,
            data: {
              ...node.data,
              displayName: normalizeDisplayName(node.data.displayName),
            },
          }
        case 'loop':
        case 'graph-ref':
        case 'run-function':
        case 'builtin':
        case 'callable-entry':
        case 'return':
          return {
            ...node,
            data: {
              ...node.data,
              displayName: normalizeDisplayName(node.data.displayName),
            },
          }
        default:
          return node
      }
    }),
  }
}

// ============================================
// Callable Graph Contract
// ============================================

/** Extracted callable contract from a graph (if it has Callable Entry) */
export interface GraphCallableContract {
  graphId: string
  graphName: string
  parameters: CallablePort[]
  returnValues: CallablePort[]
}

/** Extract callable contract from a graph, returns null if not callable */
export function extractCallableContract(
  graph: Graph,
): GraphCallableContract | null {
  const callableEntry = graph.nodes.find(
    (n) => n.data.nodeType === 'callable-entry',
  )
  if (!callableEntry) return null

  const entryData = callableEntry.data as CallableEntryNodeData

  // Get return values from first Return node (all must be identical)
  const returnNode = graph.nodes.find((n) => n.data.nodeType === 'return')
  const returnData = returnNode?.data as ReturnNodeData | undefined

  return {
    graphId: graph.id,
    graphName: graph.name,
    parameters: entryData.parameters,
    returnValues: returnData?.returnValues ?? [],
  }
}

// ============================================
// Graph Disable State (Intent vs Effective)
// ============================================

export type GraphEffectiveState =
  | { kind: 'enabled' }
  | { kind: 'user-disabled' }
  | {
      kind: 'dependency-disabled'
      /** First discovered user-disabled root causing this block (BFS parent root). */
      blockedByRootId: string
      blockedByRootName: string
    }

export interface GraphDisableState {
  graphId: string
  /** User intent only (checkbox source of truth). */
  userEnabled: boolean
  /** Computed transitive effective state. */
  effective: GraphEffectiveState
}

export interface DisableComputationResult {
  /** O(1) lookup by graph id, computed once per graph list. */
  statesByGraphId: ReadonlyMap<string, GraphDisableState>
}

// ============================================
// Graph Metadata Update Contracts
// ============================================

export interface GraphMetadataPatch {
  graphId: string
  enabled?: boolean | undefined
  order?: number | undefined
}

export interface GraphOrderUpdate {
  graphId: string
  order: number
}
