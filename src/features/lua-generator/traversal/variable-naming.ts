// ============================================
// Domain 2: Variable Naming
// Generate deterministic, collision-safe Lua variable names
// ============================================

import { sanitizeLuaIdentifier } from '@/features/lua-generator/lua-utils'

/**
 * Generate a unique temporary variable name for a node output.
 *
 * Naming convention: `_ns_${nodeIdShort}_${portId}`
 * Example: node `a1b2c3d4`, port `result` -> `_ns_a1b2c3d4_result`
 *
 * Collision handling: If name already used, append `_2`, `_3`, etc.
 *
 * @param nodeId - The node ID
 * @param portId - The output port ID
 * @param usedNames - Set of already-used variable names
 * @returns A unique, Lua-safe variable name
 */
export function generateVariableName(
  nodeId: string,
  portId: string,
  usedNames: ReadonlySet<string>,
): string {
  const sanitizedNodeId = sanitizeLuaIdentifier(nodeId)
  const sanitizedPortId = sanitizeLuaIdentifier(portId)

  const baseName = `_ns_${sanitizedNodeId}_${sanitizedPortId}`

  // If no collision, return base name
  if (!usedNames.has(baseName)) {
    return baseName
  }

  // Handle collision with numbered suffix
  let counter = 2
  let candidate = `${baseName}_${counter}`

  while (usedNames.has(candidate)) {
    counter++
    candidate = `${baseName}_${counter}`
  }

  return candidate
}

/**
 * Create a binding key for the valueBindings map.
 * Format: `${nodeId}:${portId}`
 */
export function makeBindingKey(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`
}

/**
 * Parse a binding key back into nodeId and portId.
 * Returns null if the key format is invalid.
 */
export function parseBindingKey(
  key: string,
): { nodeId: string; portId: string } | null {
  const separatorIndex = key.lastIndexOf(':')
  if (separatorIndex === -1) {
    return null
  }

  const nodeId = key.slice(0, separatorIndex)
  const portId = key.slice(separatorIndex + 1)

  return { nodeId, portId }
}

/**
 * Generate a parameter variable name for callable graph parameters.
 * These are user-visible names, so we use cleaner naming.
 *
 * Naming convention: `param_${sanitizedName}`
 */
export function generateParamVariableName(
  paramName: string,
  usedNames: ReadonlySet<string>,
): string {
  const sanitized = sanitizeLuaIdentifier(paramName)
  const baseName = `param_${sanitized}`

  // If no collision, return base name
  if (!usedNames.has(baseName)) {
    return baseName
  }

  // Handle collision with numbered suffix
  let counter = 2
  let candidate = `${baseName}_${counter}`

  while (usedNames.has(candidate)) {
    counter++
    candidate = `${baseName}_${counter}`
  }

  return candidate
}

/**
 * Generate a local variable name for intermediate computations.
 * Used for temporary values within complex expressions.
 */
export function generateLocalVariableName(
  purpose: string,
  usedNames: ReadonlySet<string>,
): string {
  const sanitized = sanitizeLuaIdentifier(purpose)
  const baseName = `local_${sanitized}`

  // If no collision, return base name
  if (!usedNames.has(baseName)) {
    return baseName
  }

  // Handle collision with numbered suffix
  let counter = 2
  let candidate = `${baseName}_${counter}`

  while (usedNames.has(candidate)) {
    counter++
    candidate = `${baseName}_${counter}`
  }

  return candidate
}
