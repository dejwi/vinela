// Set Variable Action Node Generator
// Generates Lua code for vim.g/vim.b/vim.w/vim.t/vim.v assignments

import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import { createNodeDiagnostic } from '../shared/diagnostics'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Generate Lua code for a set-variable action node.
 *
 * Generates vim.g/vim.b/vim.w/vim.t/vim.v assignments for Neovim variables.
 *
 * Examples:
 * - vim.g.my_var = 42
 * - vim.b.buffer_local = "value"
 * - vim.w.window_option = true
 * - vim.t.tab_variable = { a = 1, b = 2 }
 */
export function generateSetVariable(
  node: GraphNode<ActionNodeDataFor<'set-variable'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, inputBindings, toLuaLiteral, emitDiagnostic } =
    context

  // Validate variable name
  if (!config.variableName || config.variableName.trim() === '') {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        'Set Variable node requires a variable name',
        graphId,
        node.id,
        'action:set-variable',
        'Provide a variable name like "my_var" or "plugin_enabled"',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-variable', indentLevel)
  }

  const variableName = config.variableName.trim()

  // Validate scope
  const validScopes = ['g', 'b', 'w', 't', 'v'] as const
  if (!validScopes.includes(config.scope as (typeof validScopes)[number])) {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        `Set Variable node has invalid scope: ${config.scope}`,
        graphId,
        node.id,
        'action:set-variable',
        'Scope must be one of: g (global), b (buffer), w (window), t (tab), v (vim)',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-variable', indentLevel)
  }

  // Resolve value - connected input takes precedence over config
  const valueExpression = resolveValueExpression(
    config.valueType,
    config.value,
    inputBindings['value'],
    toLuaLiteral,
  )

  if (valueExpression === null) {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        `Set Variable node for '${variableName}' has no value configured`,
        graphId,
        node.id,
        'action:set-variable',
        'Connect a value input or configure a value in the node settings',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-variable', indentLevel)
  }

  // Generate the assignment
  const target = `vim.${config.scope}`
  const varKey = formatVariableKey(variableName)
  const code = `${target}${varKey} = ${valueExpression}`

  return {
    nodeId: node.id,
    nodeType: 'action:set-variable',
    code: [code],
    localVars: [],
    inputBindings: { value: valueExpression },
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Resolve the value expression for set-variable.
 * Priority: connected input > config value
 */
function resolveValueExpression(
  valueType: string,
  configValue: string | number | boolean,
  connectedValue: string | undefined,
  toLuaLiteral: (value: unknown) => string,
): string | null {
  // Connected input takes precedence
  if (connectedValue !== undefined && connectedValue !== '') {
    return connectedValue
  }

  // Handle raw type - emit as-is
  if (valueType === 'raw') {
    if (typeof configValue !== 'string') {
      return null
    }
    const raw = configValue.trim()
    if (raw === '') {
      return null
    }
    return raw
  }

  // Handle typed values
  switch (valueType) {
    case 'string':
      if (typeof configValue !== 'string') {
        return null
      }
      return toLuaLiteral(configValue)
    case 'number':
      if (typeof configValue !== 'number' || !Number.isFinite(configValue)) {
        return null
      }
      return String(configValue)
    case 'boolean':
      if (typeof configValue !== 'boolean') {
        return null
      }
      return configValue ? 'true' : 'false'
    default:
      return null
  }
}

/**
 * Format a variable key for Lua access.
 * Uses bracket notation for keys that aren't valid Lua identifiers.
 */
function formatVariableKey(name: string): string {
  if (isValidLuaIdentifier(name)) {
    return `.${name}`
  }
  // Use bracket notation with escaped string
  const escaped = name.replace(/"/g, '\\"').replace(/\\/g, '\\\\')
  return `["${escaped}"]`
}

/**
 * Check if a string is a valid Lua identifier.
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
