// src/features/lua-generator/generators/nodes/action/get-variable.ts
// Get Variable Action Node Generator (Legacy)
//
// IMPORTANT: action:get-variable is legacy/unsupported.
// Use builtin:get-variable instead.
//
// This generator emits a diagnostic and delegates to the builtin get-variable
// logic for backward compatibility during transition periods.

import type {
  ActionNodeDataFor,
  GraphNode,
  VariableScope,
} from '@/shared/types'
import { createNodeDiagnostic, DiagnosticCodes } from '../shared/diagnostics'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Generate Lua code for get-variable action node (LEGACY).
 *
 * NOTE: action:get-variable is deprecated. Use builtin:get-variable instead.
 *
 * This generator:
 * 1. Emits a diagnostic explaining the deprecation
 * 2. Generates the same code as builtin:get-variable for compatibility
 *
 * Example output:
 * ```lua
 * local value = vim.g.my_variable
 * ```
 */
export function generateGetVariableAction(
  node: GraphNode<ActionNodeDataFor<'get-variable'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, emitDiagnostic } = context

  // Emit legacy warning
  emitDiagnostic(
    createNodeDiagnostic(
      DiagnosticCodes.UNSUPPORTED_LEGACY,
      'warning',
      `Node '${node.data.label}' uses deprecated action:get-variable type`,
      graphId,
      node.id,
      'action:get-variable',
      'Use builtin:get-variable instead. Delete this node and re-create it as a Get Variable builtin node.',
    ),
  )

  // Validate config
  const variableName = config.variableName.trim()
  if (variableName.length === 0) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'error',
        'Get Variable node requires a variable name',
        graphId,
        node.id,
        'action:get-variable',
        'Provide a variable name like "my_var" or "loaded_plugin_name".',
      ),
    )
    return createEmptyUnit(node.id, 'action:get-variable', indentLevel)
  }

  // Validate scope
  const validScopes: VariableScope[] = ['g', 'b', 'w', 't', 'v']
  if (!validScopes.includes(config.scope)) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'error',
        `Invalid scope "${config.scope}"`,
        graphId,
        node.id,
        'action:get-variable',
        'Scope must be one of: g (global), b (buffer), w (window), t (tab), v (vim).',
      ),
    )
    return createEmptyUnit(node.id, 'action:get-variable', indentLevel)
  }

  // Generate variable access
  const accessCode = buildVariableAccess(config.scope, variableName)
  const outputVar = `_nvimset_${node.id}_value`

  // Generate the assignment
  const code = `local ${outputVar} = ${accessCode}`

  return {
    nodeId: node.id,
    nodeType: 'action:get-variable',
    code: [code],
    localVars: [outputVar],
    inputBindings: {},
    outputBindings: { done: 'nil', value: outputVar },
    indentLevel,
  }
}

/**
 * Build variable access code.
 * Uses bracket notation for non-identifier names.
 */
function buildVariableAccess(scope: VariableScope, name: string): string {
  const scopePath = `vim.${scope}`

  // Use bracket notation if name is not a valid Lua identifier
  if (isValidLuaIdentifier(name)) {
    return `${scopePath}.${name}`
  }

  // Escape string for bracket notation
  const escapedName = JSON.stringify(name)
  return `${scopePath}[${escapedName}]`
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

/**
 * NodeGenerator-compatible export for get-variable (legacy action form).
 */
export const getVariableActionGenerator = {
  generate: generateGetVariableAction,
}
