import type { FunctionCatalogEntry } from '@/shared/data/function-catalog-types'
import type {
  PortDataType,
  RunFunctionDefaultValue,
  RunFunctionParamSignature,
} from '@/shared/types'
import type { FunctionParamInfo, ParamInputMode } from './types'

export const DEFAULT_PARAM_GROUP = 'General'

// ============================================
// Param Default Parsing / Formatting
// ============================================

/**
 * Parse a raw text input value into a typed RunFunctionDefaultValue.
 * Returns null when the input is empty (meaning "no default").
 */
export function parseParamDefault(
  type: PortDataType,
  rawValue: string,
): RunFunctionDefaultValue | null {
  if (rawValue.trim().length === 0) {
    return null
  }

  if (type === 'string') {
    return { kind: 'scalar', value: rawValue }
  }

  if (type === 'number') {
    const asNumber = Number(rawValue)
    if (Number.isFinite(asNumber)) {
      return { kind: 'scalar', value: asNumber }
    }
    return { kind: 'lua', lua: rawValue }
  }

  if (type === 'boolean') {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === 'true') {
      return { kind: 'scalar', value: true }
    }
    if (normalized === 'false') {
      return { kind: 'scalar', value: false }
    }
    return { kind: 'lua', lua: rawValue }
  }

  return { kind: 'lua', lua: rawValue }
}

// ============================================
// Mode-Aware Parsing
// ============================================

/**
 * Determine the initial input mode for a param row based on the param type
 * and any existing saved default value.
 *
 * - If there's an existing value, derive mode from its `kind` discriminator.
 * - Otherwise use a type-based default:
 *   - `table`, `buffer`, `window` → Lua (inherently programmatic types)
 *   - everything else → Text (most params accept plain strings)
 */
export function getDefaultInputMode(
  paramType: PortDataType,
  currentDefault: RunFunctionDefaultValue | undefined,
): ParamInputMode {
  if (currentDefault !== undefined) {
    return currentDefault.kind === 'lua' ? 'lua' : 'text'
  }
  if (
    paramType === 'table' ||
    paramType === 'buffer' ||
    paramType === 'window'
  ) {
    return 'lua'
  }
  return 'text'
}

/**
 * Parse a raw text input value in **text mode** (scalar-first).
 * Returns null when the input is empty (meaning "no default").
 *
 * - `number`: tries numeric parse; falls back to scalar string on failure
 * - `boolean`: recognises `true`/`false`; falls back to scalar string
 * - everything else: plain scalar string
 */
export function parseParamDefaultAsText(
  type: PortDataType,
  rawValue: string,
): RunFunctionDefaultValue | null {
  if (rawValue.trim().length === 0) {
    return null
  }

  if (type === 'number') {
    const asNumber = Number(rawValue)
    if (Number.isFinite(asNumber)) {
      return { kind: 'scalar', value: asNumber }
    }
    // Store as scalar string — generation layer handles validation
    return { kind: 'scalar', value: rawValue }
  }

  if (type === 'boolean') {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === 'true') return { kind: 'scalar', value: true }
    if (normalized === 'false') return { kind: 'scalar', value: false }
    return { kind: 'scalar', value: rawValue }
  }

  // any, string, table, buffer, window — plain scalar
  return { kind: 'scalar', value: rawValue }
}

/**
 * Format a RunFunctionDefaultValue back to a string for display in an input.
 */
export function formatParamDefaultForInput(
  defaultValue: RunFunctionDefaultValue | undefined,
): string {
  if (defaultValue === undefined) {
    return ''
  }

  if (defaultValue.kind === 'lua') {
    return defaultValue.lua
  }
  if (defaultValue.kind === 'multiselect') {
    return defaultValue.values.join(', ')
  }
  if (defaultValue.kind === 'object') {
    return ''
  }

  return String(defaultValue.value)
}

export function defaultValueIsAbsent(
  defaultValue: RunFunctionDefaultValue | undefined,
): boolean {
  if (defaultValue === undefined) return true
  if (defaultValue.kind === 'lua') return defaultValue.lua.trim().length === 0
  if (defaultValue.kind === 'multiselect')
    return defaultValue.values.length === 0
  if (defaultValue.kind === 'object') {
    return Object.keys(defaultValue.entries).length === 0
  }
  return false
}

export function seedMultiselectDefault(
  values: readonly string[],
): RunFunctionDefaultValue {
  return { kind: 'multiselect', values: [...values] }
}

export function seedObjectDefault(
  entries: Readonly<Record<string, RunFunctionDefaultValue>>,
): RunFunctionDefaultValue {
  return { kind: 'object', entries: { ...entries } }
}

export function effectiveTier(
  param: FunctionParamInfo,
  storedDefault: RunFunctionDefaultValue | undefined,
  isConnected: boolean,
): 'basic' | 'advanced' {
  if ((param.tier ?? 'basic') === 'basic') return 'basic'
  if (!defaultValueIsAbsent(storedDefault)) return 'basic'
  if (isConnected) return 'basic'
  return 'advanced'
}

export function getParamGroupName(param: FunctionParamInfo): string {
  const group = param.group?.trim()
  return group !== undefined && group.length > 0 ? group : DEFAULT_PARAM_GROUP
}

/**
 * Derive the initial expanded/collapsed state for parameter groups when a
 * function key is first initialized with available parameters.
 */
export function deriveInitialOpenGroups(
  groupEntries: ReadonlyArray<readonly [string, readonly FunctionParamInfo[]]>,
  paramDefaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedParams: Readonly<Record<string, boolean>> | undefined,
): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const [groupName, groupParams] of groupEntries) {
    if (groupName === DEFAULT_PARAM_GROUP) {
      next[groupName] = true
      continue
    }
    const hasValueOrConnection = groupParams.some((param) => {
      const hasValue = paramDefaults[param.name] !== undefined
      const isConnected = connectedParams?.[param.name] === true
      return hasValue || isConnected
    })
    next[groupName] = hasValueOrConnection
  }
  return next
}

/**
 * Get a placeholder string for a param input based on its type, mode,
 * and optional example value from the catalog.
 *
 * Canonical signature: getParamInputPlaceholder(type, mode, example?)
 */
export function getParamInputPlaceholder(
  type: PortDataType,
  mode: ParamInputMode,
  example?: string,
): string {
  if (mode === 'lua') {
    const base = 'Lua expression'
    return example !== undefined && example.length > 0
      ? `${base} (e.g. ${example})`
      : base
  }

  // Text mode
  const base = ((): string => {
    switch (type) {
      case 'string':
        return 'Text value'
      case 'number':
        return 'Number'
      case 'boolean':
        return 'true or false'
      default:
        return 'Text value'
    }
  })()

  if (example !== undefined && example.length > 0) {
    return `${base} (e.g. ${example})`
  }
  return base
}

// ============================================
// Catalog Metadata Merging
// ============================================

/**
 * Build a FunctionParamInfo[] by merging signature snapshot params with
 * catalog metadata (description, example, allowedValues).
 *
 * Falls back to signature-only data when the catalog entry is missing
 * (e.g. function removed from schema, or plugin disabled).
 */
export function buildParamInfoList(
  signatureParams: readonly RunFunctionParamSignature[],
  catalogEntry: FunctionCatalogEntry | undefined,
): FunctionParamInfo[] {
  return signatureParams.map((sigParam, index) => {
    // Try to find matching catalog param by name (primary) or index (fallback)
    const catalogParam =
      catalogEntry?.params.find((cp) => cp.name === sigParam.name) ??
      catalogEntry?.params[index]

    return {
      name: sigParam.name,
      type: sigParam.type,
      optional: sigParam.optional ?? false,
      description: catalogParam?.description ?? sigParam.description,
      example: catalogParam?.example,
      tier: catalogParam?.tier ?? sigParam.tier,
      group: catalogParam?.group ?? sigParam.group,
      allowedValues:
        catalogParam?.allowedValues !== undefined
          ? [...catalogParam.allowedValues]
          : undefined,
      allowedValueDescriptions: catalogParam?.allowedValueDescriptions,
      multi: catalogParam?.multi ?? sigParam.multi,
      objectShape:
        catalogParam?.objectShape?.map((child) => ({
          name: child.name,
          type: child.type,
          optional: child.optional,
          description: child.description,
          example: child.example,
          tier: child.tier,
          group: child.group,
          allowedValues: child.allowedValues,
          allowedValueDescriptions: child.allowedValueDescriptions,
          multi: child.multi,
          objectShape: undefined,
          defaultValue: child.defaultValue,
        })) ?? undefined,
      defaultValue: catalogParam?.defaultValue,
    }
  })
}
