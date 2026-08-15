import type { PortDataType, RunFunctionDefaultValue } from '@/shared/types'

// ============================================
// Mode Toggle Types
// ============================================

/**
 * Whether the user is entering a plain text value (auto-quoted as a Lua string)
 * or a raw Lua expression (inserted verbatim).
 *
 * Maps 1:1 to the RunFunctionDefaultValue discriminated union:
 *   text → { kind: 'scalar', value: string }
 *   lua  → { kind: 'lua', lua: string }
 */
export type ParamInputMode = 'text' | 'lua'

/**
 * Per-row UI state for the free-text input path (non-allowedValues params).
 */
export interface ParamRowState {
  readonly mode: ParamInputMode
  readonly rawValue: string
}

/**
 * Extended param info combining signature data with catalog metadata.
 * This is the "rich" param descriptor passed to the form.
 */
export interface FunctionParamInfo {
  readonly name: string
  readonly type: PortDataType
  readonly optional: boolean
  /** Friendly description from the catalog (argumentHints or schema) */
  readonly description?: string | undefined
  /** Example value from the catalog */
  readonly example?: string | undefined
  readonly tier?: 'basic' | 'advanced' | undefined
  readonly group?: string | undefined
  /** Constrained set of allowed values (renders Select dropdown) */
  readonly allowedValues?: readonly string[] | undefined
  /** Per-value descriptions for allowedValues. Keys must match allowedValues entries. */
  readonly allowedValueDescriptions?:
    | Readonly<Record<string, string>>
    | undefined
  readonly multi?: boolean | undefined
  readonly objectShape?: readonly FunctionParamInfo[] | undefined
  readonly defaultValue?: RunFunctionDefaultValue | undefined
}

/**
 * Per-param connection status. Only relevant in graph editor context.
 * When a param port is connected, the input is greyed out with a
 * "Value from connection" indicator.
 */
export type ParamConnectionStatus = Readonly<Record<string, boolean>>

export interface FunctionParamDefaultsFormProps {
  /** Identity key of the selected function (used to reset row-local state on function switch) */
  readonly selectedFunctionKey: string
  /** Parameter metadata (from catalog or signature snapshot) */
  readonly params: readonly FunctionParamInfo[]
  /** Current default values keyed by param name */
  readonly paramDefaults: Readonly<Record<string, RunFunctionDefaultValue>>
  /** Callback when any param default changes */
  readonly onParamDefaultsChange: (
    paramDefaults: Record<string, RunFunctionDefaultValue>,
  ) => void
  /**
   * Per-param connection status (graph editor only).
   * When undefined, all params are treated as editable (keymaps context).
   */
  readonly connectedParams?: ParamConnectionStatus | undefined
}
