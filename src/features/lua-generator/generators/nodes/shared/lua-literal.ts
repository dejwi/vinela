// src/features/lua-generator/generators/nodes/shared/lua-literal.ts
// Convert JavaScript values to Lua literals

/**
 * Convert a JavaScript value to a Lua literal string.
 */
export function toLuaLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'nil'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      // Lua NaN representation
      return '0/0'
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? 'math.huge' : '-math.huge'
    }
    return String(value)
  }

  if (typeof value === 'string') {
    return toLuaString(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '{}'
    }
    const elements = value.map(toLuaLiteral).join(', ')
    return `{ ${elements} }`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => {
      const key = isValidLuaKey(k) ? k : `[${toLuaString(k)}]`
      return `${key} = ${toLuaLiteral(v)}`
    })
    return `{ ${entries.join(', ')} }`
  }

  // Fallback for functions, symbols, etc.
  return 'nil'
}

/**
 * Escape a string for use as a Lua string literal.
 * Uses double quotes and escapes special characters.
 */
export function toLuaString(str: string): string {
  // Check if we can use a simple literal
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str)) {
    return str
  }

  // Escape special characters
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')

  return `"${escaped}"`
}

/**
 * Check if a string is a valid unquoted Lua table key.
 */
function isValidLuaKey(key: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
}

/**
 * Escape a string for use in a Lua bracket index.
 * Example: vim.g["escaped_key"]
 */
export function toLuaBracketKey(key: string): string {
  const escaped = key
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}
