// Lua utility functions for code generation

const LUA_RESERVED_WORDS = new Set([
  'and',
  'break',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'goto',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while',
])

function longBracketEqualsCount(lua: string, index: number): number | null {
  if (lua[index] !== '[') return null

  let cursor = index + 1
  while (lua[cursor] === '=') {
    cursor += 1
  }

  return lua[cursor] === '[' ? cursor - index - 1 : null
}

function shortStringEnd(
  lua: string,
  index: number,
  quote: '"' | "'",
): number | null {
  let cursor = index + 1
  while (cursor < lua.length && lua[cursor] !== quote) {
    cursor += lua[cursor] === '\\' ? 2 : 1
  }

  return cursor < lua.length ? cursor + 1 : null
}

/**
 * Replace complete Lua long-bracket strings and comments with a space.
 */
export function stripLuaLongBracketLiterals(lua: string): string {
  let result = ''
  let index = 0

  while (index < lua.length) {
    const character = lua[index]

    if (character === '"' || character === "'") {
      const end = shortStringEnd(lua, index, character)
      if (end === null) {
        return result + lua.slice(index)
      }
      result += lua.slice(index, end)
      index = end
      continue
    }

    if (character === '-' && lua[index + 1] === '-') {
      const equalsCount = longBracketEqualsCount(lua, index + 2)
      if (equalsCount === null) {
        const newlineIndex = lua.indexOf('\n', index)
        if (newlineIndex === -1) return result + lua.slice(index)
        result += lua.slice(index, newlineIndex + 1)
        index = newlineIndex + 1
        continue
      }

      const closer = `]${'='.repeat(equalsCount)}]`
      const closerIndex = lua.indexOf(closer, index + 3 + equalsCount)
      if (closerIndex === -1) return result + lua.slice(index)
      result += ' '
      index = closerIndex + closer.length
      continue
    }

    const equalsCount = longBracketEqualsCount(lua, index)
    if (equalsCount !== null) {
      const closer = `]${'='.repeat(equalsCount)}]`
      const closerIndex = lua.indexOf(closer, index + 2 + equalsCount)
      if (closerIndex === -1) return result + lua.slice(index)
      result += ' '
      index = closerIndex + closer.length
      continue
    }

    result += character
    index += 1
  }

  return result
}

/**
 * Check if a word is a Lua reserved word
 */
export function isLuaReservedWord(word: string): boolean {
  return LUA_RESERVED_WORDS.has(word)
}

/**
 * Sanitize a string to be a valid Lua identifier
 *
 * Rules:
 * 1. Replace any character that isn't [a-zA-Z0-9_] with _
 * 2. If result starts with a digit, prepend _
 * 3. If result is empty, return _unnamed
 * 4. If result is a Lua reserved word, prepend _
 */
export function sanitizeLuaIdentifier(name: string): string {
  let result = name.replace(/[^a-zA-Z0-9_]/g, '_')

  if (result.length === 0) {
    return '_unnamed'
  }

  if (/^[0-9]/.test(result)) {
    result = `_${result}`
  }

  if (LUA_RESERVED_WORDS.has(result)) {
    result = `_${result}`
  }

  return result
}

/**
 * Sanitize a list of identifiers, resolving collisions.
 *
 * Collision policy: When multiple names sanitize to the same base identifier,
 * subsequent occurrences get numbered suffixes (_2, _3, etc.):
 * - ['my-input', 'my_input'] -> ['my_input', 'my_input_2']
 * - ['', '   ', 'end'] -> ['_unnamed', '_unnamed_2', '_end']
 *
 * @param names - Array of names to sanitize
 * @returns Array of sanitized identifiers with collisions resolved
 */
export function sanitizeLuaIdentifierList(names: string[]): string[] {
  const counts = new Map<string, number>()
  const result: string[] = []

  for (const name of names) {
    // Trim whitespace before sanitizing
    const trimmedName = name.trim()
    const base = sanitizeLuaIdentifier(trimmedName)

    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)

    if (count === 0) {
      // First occurrence: use base as-is
      result.push(base)
    } else {
      // nth occurrence: add _n suffix (count is 0-indexed, so add 2 for second occurrence)
      result.push(`${base}_${count + 1}`)
    }
  }

  return result
}

/**
 * Take the leading 6 hex chars of a UUID for readable stable suffixes.
 */
export function shortIdFromUuid(id: string): string {
  const stripped = id.replace(/-/g, '').toLowerCase()
  const hex = stripped.match(/[0-9a-f]+/)?.[0] ?? ''
  if (hex.length >= 6) {
    return hex.slice(0, 6)
  }

  const fallback = sanitizeLuaIdentifier(id).slice(0, 6)
  return fallback.length > 0 ? fallback : '_id'
}

/**
 * Build descriptive callable key: <sanitizedName>_<shortId>.
 */
export function formatCallableId(name: string, uuid: string): string {
  const trimmed = name.trim()
  const base = trimmed.length > 0 ? sanitizeLuaIdentifier(trimmed) : 'graph'
  return `${base}_${shortIdFromUuid(uuid)}`
}

export function formatAutocmdCallbackId(
  graphName: string,
  nodeId: string,
): string {
  return `autocmd_callback_${formatCallableId(graphName, nodeId)}`
}

export interface CallableKeyInput {
  readonly graphId: string
  readonly graphName: string
}

/**
 * Build deterministic callable keys with collision suffixing.
 */
export function buildCallableKeyByGraphId(
  callableGraphs: Iterable<CallableKeyInput>,
): Map<string, string> {
  const keys = new Map<string, string>()
  const counts = new Map<string, number>()

  for (const { graphId, graphName } of callableGraphs) {
    const base = formatCallableId(graphName, graphId)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    keys.set(graphId, count === 0 ? base : `${base}_${count + 1}`)
  }

  return keys
}
