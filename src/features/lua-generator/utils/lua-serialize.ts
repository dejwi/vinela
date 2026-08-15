// Lua value serialization

import { getIndentPrefix } from './indent'
import { escapeLuaString } from './lua-string'

/**
 * Unique symbol used to brand raw Lua code objects.
 * Symbol-based branding ensures:
 * 1. Cannot be accidentally created from JSON (symbols aren't JSON-serializable)
 * 2. Cannot collide with user data properties
 * 3. Type narrowing via the isRawLua guard is sound
 */
const RAW_LUA_BRAND = Symbol('raw-lua')

/**
 * Branded wrapper for raw Lua code that should be emitted verbatim.
 * Only created via the rawLua() factory function.
 */
export interface LuaRawCode {
  readonly [RAW_LUA_BRAND]: true
  readonly code: string
}

/**
 * Factory function — the ONLY way to create a LuaRawCode instance.
 * This is the narrow entry point for raw Lua emission.
 */
export function rawLua(code: string): LuaRawCode {
  return { [RAW_LUA_BRAND]: true, code }
}

/**
 * Type guard for raw Lua code markers.
 * Uses the Symbol brand for sound narrowing.
 */
export function isRawLua(value: unknown): value is LuaRawCode {
  return typeof value === 'object' && value !== null && RAW_LUA_BRAND in value
}

/**
 * Types that can be serialized to Lua.
 */
export type LuaSerializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | LuaRawCode
  | LuaSerializable[]
  | { [key: string]: LuaSerializable }

/**
 * Options for serializing Lua values.
 */
export interface SerializeLuaOptions {
  /** The string to use for each indent level (default: '  ') */
  indentUnit?: string
  /** The base indent level to start with (default: 0) */
  baseIndentLevel?: number
  /** Whether to pretty-print with newlines (default: true) */
  pretty?: boolean
  /** Maximum recursion depth (default: 50) */
  maxDepth?: number
  /** Whether to sort object keys for stable output (default: true) */
  sortObjectKeys?: boolean
}

/**
 * Error thrown when serialization fails.
 */
export class LuaSerializationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LuaSerializationError'
  }
}

/**
 * Boundary check for schema `type: 'lua'` values prior to serialization.
 *
 * The schema-aware merge layer is responsible for converting user-supplied
 * Lua source strings into rawLua() markers. Any plain string reaching the
 * serializer at a `type: 'lua'` path is a merge-layer bug.
 *
 * This function performs only that single check:
 *   - if `value` is a plain string -> throw `LuaSerializationError`
 *   - otherwise -> return `value` unchanged
 */
export function validateLuaFieldNotPlainString(
  value: unknown,
  fieldPath: string,
): LuaRawCode | Exclude<LuaSerializable, string> {
  if (typeof value === 'string') {
    throw new LuaSerializationError(
      `lua field "${fieldPath}" was not wrapped as raw Lua before serialization`,
    )
  }

  if (isRawLua(value)) {
    return value
  }

  return value as Exclude<LuaSerializable, string>
}

interface SerializeContext {
  indentUnit: string
  pretty: boolean
  maxDepth: number
  sortObjectKeys: boolean
  depth: number
  visited: WeakSet<object>
}

function serializePrimitiveValue(value: LuaSerializable): string | undefined {
  if (value === null || value === undefined) {
    return 'nil'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new LuaSerializationError(
        `Cannot serialize non-finite number: ${value}`,
      )
    }
    return String(value)
  }

  if (typeof value === 'string') {
    return `"${escapeLuaString(value)}"`
  }

  return undefined
}

function rejectUnsupportedValueType(value: LuaSerializable): void {
  if (typeof value === 'function') {
    throw new LuaSerializationError('Cannot serialize functions')
  }
  if (typeof value === 'symbol') {
    throw new LuaSerializationError('Cannot serialize symbols')
  }
  if (typeof value === 'bigint') {
    throw new LuaSerializationError('Cannot serialize bigint')
  }
}

function rejectNonPlainObject(value: object): void {
  if (value instanceof Date) {
    throw new LuaSerializationError('Cannot serialize Date objects')
  }
  if (value instanceof Map) {
    throw new LuaSerializationError('Cannot serialize Map')
  }
  if (value instanceof Set) {
    throw new LuaSerializationError('Cannot serialize Set')
  }

  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== Array.prototype) {
    throw new LuaSerializationError('Cannot serialize class instances')
  }
}

function serializeObjectValue(
  value: object,
  ctx: SerializeContext,
  indentLevel: number,
): string {
  if (isRawLua(value)) {
    return formatRawLuaCode(value.code, ctx, indentLevel)
  }

  if (ctx.visited.has(value)) {
    throw new LuaSerializationError('Circular reference detected')
  }

  rejectNonPlainObject(value)
  ctx.visited.add(value)

  try {
    ctx.depth++

    if (Array.isArray(value)) {
      return serializeArray(value, ctx, indentLevel)
    }

    return serializeObject(
      value as { [key: string]: LuaSerializable },
      ctx,
      indentLevel,
    )
  } finally {
    ctx.depth--
    ctx.visited.delete(value)
  }
}

function serializeInternal(
  value: LuaSerializable,
  ctx: SerializeContext,
  indentLevel: number,
): string {
  if (ctx.depth > ctx.maxDepth) {
    throw new LuaSerializationError(
      `Maximum serialization depth (${ctx.maxDepth}) exceeded`,
    )
  }

  const primitive = serializePrimitiveValue(value)
  if (primitive !== undefined) {
    return primitive
  }

  rejectUnsupportedValueType(value)

  if (value !== null && typeof value === 'object') {
    return serializeObjectValue(value, ctx, indentLevel)
  }

  throw new LuaSerializationError(`Unsupported value type: ${typeof value}`)
}

/**
 * Serialize a JavaScript value to a Lua literal.
 *
 * Supports: strings, numbers, booleans, null/undefined, arrays, and plain objects.
 * Rejects: functions, symbols, bigint, non-finite numbers, circular references,
 * and non-plain objects (Date, Map, etc).
 *
 * @param value - The value to serialize
 * @param options - Serialization options
 * @returns The Lua literal string
 * @throws LuaSerializationError for unsupported values
 */
export function serializeValue(
  value: LuaSerializable,
  options: SerializeLuaOptions = {},
): string {
  const context: SerializeContext = {
    indentUnit: options.indentUnit ?? '  ',
    pretty: options.pretty ?? true,
    maxDepth: options.maxDepth ?? 50,
    sortObjectKeys: options.sortObjectKeys ?? true,
    depth: 0,
    visited: new WeakSet<object>(),
  }

  const result = serializeInternal(value, context, options.baseIndentLevel ?? 0)
  return result
}

function formatRawLuaCode(
  code: string,
  ctx: SerializeContext,
  indentLevel: number,
): string {
  if (!ctx.pretty || !code.includes('\n')) {
    return code
  }

  const continuationIndent = getIndentPrefix(indentLevel, ctx.indentUnit)
  const lines = code.split('\n')

  return lines
    .map((line, index) => (index === 0 ? line : `${continuationIndent}${line}`))
    .join('\n')
}

function serializeArray(
  arr: LuaSerializable[],
  ctx: SerializeContext,
  indentLevel: number,
): string {
  if (arr.length === 0) {
    return '{}'
  }

  const items = arr.map((item) => serializeInternal(item, ctx, indentLevel + 1))

  // Decide between inline and multiline format
  const allScalars = arr.every(
    (item) =>
      item === null ||
      item === undefined ||
      typeof item === 'boolean' ||
      typeof item === 'number' ||
      typeof item === 'string',
  )

  const inlineEstimate = `{ ${items.join(', ')} }`
  // Use inline if: not pretty, or all scalars and short enough
  const useInline = !ctx.pretty || (allScalars && inlineEstimate.length <= 80)

  if (useInline) {
    return `{ ${items.join(', ')} }`
  }

  // Multiline format
  const innerIndent = getIndentPrefix(indentLevel + 1, ctx.indentUnit)
  const closingIndent = getIndentPrefix(indentLevel, ctx.indentUnit)

  const lines = items.map((item) => `${innerIndent}${item},`)
  return `{\n${lines.join('\n')}\n${closingIndent}}`
}

function serializeObject(
  obj: { [key: string]: LuaSerializable },
  ctx: SerializeContext,
  indentLevel: number,
): string {
  const keys = Object.keys(obj)

  if (keys.length === 0) {
    return '{}'
  }

  // Sort keys for stable output if enabled
  if (ctx.sortObjectKeys) {
    keys.sort()
  }

  const pairs: string[] = []
  for (const key of keys) {
    const value = obj[key]
    const serializedValue = serializeInternal(value, ctx, indentLevel + 1)

    // Determine key format: identifier or bracket notation
    const keyStr = isValidLuaIdentifier(key)
      ? key
      : `["${escapeLuaString(key)}"]`
    pairs.push(`${keyStr} = ${serializedValue}`)
  }

  // Decide between inline and multiline format
  const allScalarValues = keys.every((k) => {
    const v = obj[k]
    return (
      v === null ||
      v === undefined ||
      typeof v === 'boolean' ||
      typeof v === 'number' ||
      typeof v === 'string'
    )
  })

  const inlineEstimate = `{ ${pairs.join(', ')} }`
  // Use inline if: not pretty, or all scalars and short enough
  const useInline =
    !ctx.pretty || (allScalarValues && inlineEstimate.length <= 80)

  if (useInline) {
    return `{ ${pairs.join(', ')} }`
  }

  // Multiline format
  const innerIndent = getIndentPrefix(indentLevel + 1, ctx.indentUnit)
  const closingIndent = getIndentPrefix(indentLevel, ctx.indentUnit)

  const lines = pairs.map((pair) => `${innerIndent}${pair},`)
  return `{\n${lines.join('\n')}\n${closingIndent}}`
}

/**
 * Check if a string is a valid Lua identifier (without sanitization).
 *
 * Valid identifiers:
 * - Start with letter or underscore
 * - Contain only letters, digits, and underscores
 * - Are not Lua reserved words
 */
function isValidLuaIdentifier(str: string): boolean {
  if (str.length === 0) return false

  // Must start with letter or underscore
  const firstChar = str.charCodeAt(0)
  if (
    !(firstChar >= 0x41 && firstChar <= 0x5a) && // A-Z
    !(firstChar >= 0x61 && firstChar <= 0x7a) && // a-z
    firstChar !== 0x5f // _
  ) {
    return false
  }

  // Remaining chars must be alphanumeric or underscore
  for (let i = 1; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (
      !(code >= 0x41 && code <= 0x5a) && // A-Z
      !(code >= 0x61 && code <= 0x7a) && // a-z
      !(code >= 0x30 && code <= 0x39) && // 0-9
      code !== 0x5f // _
    ) {
      return false
    }
  }

  return true
}
