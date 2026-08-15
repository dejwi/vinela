// src/features/lua-generator/generators/nodes/shared/output-vars.ts
// Output variable naming utilities

/**
 * Generate a deterministic variable name for node output.
 * Format: _nvimset_{nodeId}_{hint}
 */
export function generateOutputVarName(nodeId: string, hint = 'out'): string {
  // Sanitize nodeId to be safe for Lua identifiers
  const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_')
  const safeHint = hint.replace(/[^a-zA-Z0-9_]/g, '_')
  return `_nvimset_${safeNodeId}_${safeHint}`
}

/**
 * Generate a parameter variable name for callable entry.
 */
export function generateParamVarName(portId: string): string {
  return `param_${portId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/**
 * Generate a return value variable name.
 */
export function generateReturnVarName(portId: string): string {
  return `ret_${portId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/**
 * Sanitize a string to be a valid Lua identifier.
 * Lua identifiers must start with letter or underscore, followed by letters, digits, or underscores.
 */
export function sanitizeIdentifier(raw: string): string {
  if (raw.length === 0) {
    return '_'
  }

  // Replace invalid characters with underscores
  let sanitized = raw.replace(/[^a-zA-Z0-9_]/g, '_')

  // Ensure starts with letter or underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`
  }

  return sanitized
}

/**
 * Generate a unique variable name base with counter.
 * Used for temporary variables to avoid collisions.
 */
let variableCounter = 0

export function generateUniqueVarName(hint = 'var'): string {
  const counter = ++variableCounter
  return `_nvimset_${hint}_${counter}`
}

/**
 * Reset the variable counter (mainly for testing).
 */
export function resetVariableCounter(): void {
  variableCounter = 0
}
