// src/features/lua-generator/generators/nodes/builtin/get-variable.ts
// Get Variable builtin - reads Neovim variables

import type { BuiltinNodeData, GraphNode, VariableScope } from '@/shared/types'
import { VARIABLE_SCOPES } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createEmptyUnit } from '../types'

/**
 * Valid variable scopes for vim.* scopes
 */
const VALID_SCOPES: readonly VariableScope[] = VARIABLE_SCOPES

/**
 * Check if a variable name needs bracket notation (contains non-identifier chars)
 */
function needsBracketNotation(name: string): boolean {
  // If name contains any character that's not a valid Lua identifier char, use brackets
  return !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

/**
 * Escape a variable name for use as a Lua string literal
 */
function escapeVariableName(name: string): string {
  return name.replace(/"/g, '\\"')
}

/**
 * Builtin generator for reading Neovim variables.
 *
 * Config:
 * - scope: VariableScope (required) - The scope: 'g', 'b', 'w', 't', or 'v'
 * - variableName: string (required) - The variable name to read
 * - bufferNumber: number (optional) - For 'b' scope, the buffer number
 * - windowNumber: number (optional) - For 'w' scope, the window number
 * - tabNumber: number (optional) - For 't' scope, the tab page number
 *
 * Generates:
 * ```lua
 * local <var> = vim.g.variable_name
 * -- or with bracket notation:
 * local <var> = vim.g["variable-name"]
 * -- or for buffer-local with index:
 * local <var> = vim.b[bufnr].variable_name
 * ```
 */
export const getVariableGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data

    // Extract scope from config
    const scope =
      typeof config['scope'] === 'string'
        ? (config['scope'] as VariableScope)
        : undefined

    // Extract variable name from config
    const variableName =
      typeof config['variableName'] === 'string'
        ? (config['variableName'] as string).trim()
        : ''

    // Validate: Scope is required
    if (scope === undefined || !VALID_SCOPES.includes(scope)) {
      context.emitDiagnostic({
        id: 'builtin-get-variable-invalid-scope',
        severity: 'error',
        category: 'config',
        message:
          scope === undefined
            ? 'Get variable builtin has no scope specified'
            : `Invalid scope: '${scope}'`,
        details: `Node '${nodeId}' needs a valid variable scope.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Valid scopes: g (global), b (buffer), w (window), t (tab), v (vim)',
        ],
      })
      return createEmptyUnit(nodeId, 'builtin', context.indentLevel)
    }

    // Validate: Variable name is required
    if (variableName.length === 0) {
      context.emitDiagnostic({
        id: 'builtin-get-variable-missing-name',
        severity: 'error',
        category: 'config',
        message: 'Get variable builtin has no variable name specified',
        details: `Node '${nodeId}' is a get variable builtin but has no variable name configured.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Set the variable name (e.g., "my_var", "plugin_enabled")',
        ],
      })
      return createEmptyUnit(nodeId, 'builtin', context.indentLevel)
    }

    // Generate a local variable name for the result
    const varName = context.getVariableName('var')

    // Determine the access pattern based on scope and variable name
    let accessExpr: string

    // Check for index-based access (buffer/window/tab with specific numbers)
    const needsIndex = scope === 'b' || scope === 'w' || scope === 't'
    const hasSpecificIndex = typeof config['index'] === 'number'

    if (needsIndex && hasSpecificIndex) {
      // Access with specific index: vim.b[0].var or vim.b[0]["var"]
      const index = config['index'] as number
      if (needsBracketNotation(variableName)) {
        accessExpr = `vim.${scope}[${index}]["${escapeVariableName(variableName)}"]`
      } else {
        accessExpr = `vim.${scope}[${index}].${variableName}`
      }
    } else {
      // Direct access: vim.g.var or vim.g["var"]
      if (needsBracketNotation(variableName)) {
        accessExpr = `vim.${scope}["${escapeVariableName(variableName)}"]`
      } else {
        accessExpr = `vim.${scope}.${variableName}`
      }
    }

    // Generate: local varName = accessExpr
    const code = `local ${varName} = ${accessExpr}`

    return {
      nodeId,
      nodeType: 'builtin',
      code: [code],
      localVars: [varName],
      inputBindings: {},
      // Expose the generated variable on the canonical 'value' output port
      // so downstream data consumers receive the actual Lua identifier.
      outputBindings: { value: varName },
      indentLevel: context.indentLevel,
    }
  },
}
