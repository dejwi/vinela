import type { ActionScalarValue, PortDataType } from './graph'

// ============================================
// Run Function Source (discriminated union)
// ============================================

export type RunFunctionSource =
  | { readonly type: 'core'; functionName: string }
  | { readonly type: 'plugin'; pluginId: string; functionName: string }

// ============================================
// Run Function Signature
// ============================================

export interface RunFunctionParamSignature {
  name: string
  type: PortDataType
  optional?: boolean | undefined
  description?: string | undefined
  tier?: 'basic' | 'advanced' | undefined
  group?: string | undefined
  allowedValues?: string[] | undefined
  allowedValueDescriptions?: Readonly<Record<string, string>> | undefined
  multi?: boolean | undefined
  objectShape?: RunFunctionParamSignature[] | undefined
}

export interface RunFunctionSignatureSnapshot {
  params: RunFunctionParamSignature[]
  returns: PortDataType
  /** The Lua call template, e.g. "vim.fn.expand($params)" */
  luaCall: string
}

// ============================================
// Run Function Default Values (discriminated union)
// ============================================

export type RunFunctionDefaultValue =
  | { readonly kind: 'scalar'; value: ActionScalarValue }
  | { readonly kind: 'lua'; lua: string }
  | { readonly kind: 'multiselect'; values: string[] }
  | {
      readonly kind: 'object'
      entries: Record<string, RunFunctionDefaultValue>
    }

// ============================================
// Type Guards
// ============================================

export function isRunFunctionSource(
  value: unknown,
): value is RunFunctionSource {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record['type'] === 'core') {
    return typeof record['functionName'] === 'string'
  }
  if (record['type'] === 'plugin') {
    return (
      typeof record['pluginId'] === 'string' &&
      typeof record['functionName'] === 'string'
    )
  }
  return false
}

export function isRunFunctionDefaultValue(
  value: unknown,
): value is RunFunctionDefaultValue {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record['kind'] === 'scalar') {
    const v = record['value']
    return (
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    )
  }
  if (record['kind'] === 'lua') {
    return typeof record['lua'] === 'string'
  }
  if (record['kind'] === 'multiselect') {
    const v = record['values']
    return Array.isArray(v) && v.every((x) => typeof x === 'string')
  }
  if (record['kind'] === 'object') {
    const e = record['entries']
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return false
    return Object.values(e as Record<string, unknown>).every((x) =>
      isRunFunctionDefaultValue(x),
    )
  }
  return false
}
