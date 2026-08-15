// src/features/lua-generator/generators/nodes/builtin/require-module.ts
// Require Module builtin - loads a Lua module

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createEmptyUnit, createUnit } from '../types'

/**
 * Builtin generator for require("module").
 *
 * Config:
 * - moduleName: string (required) - The module path to require
 * - assignToVariable: boolean (optional) - Whether to assign to a local variable (default: true)
 *
 * Generates:
 * ```lua
 * local <var> = require('<module>')
 * ```
 */
export const requireModuleGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data
    // Extract module name from config
    const moduleName =
      typeof config['moduleName'] === 'string'
        ? (config['moduleName'] as string).trim()
        : ''

    // Validate: Module name is required
    if (moduleName.length === 0) {
      context.emitDiagnostic({
        id: 'builtin-require-missing-module',
        severity: 'error',
        category: 'config',
        message: 'Require module builtin has no module name specified',
        details: `Node '${nodeId}' is a require module builtin but has no module name configured.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Set the module name in the node properties (e.g., "plenary", "telescope")',
        ],
      })
      return createEmptyUnit(nodeId, 'builtin', context.indentLevel)
    }

    // Check if we should assign to a variable (default true)
    const assignToVariable = config['assignToVariable'] !== false

    // Escape the module name for Lua string literal
    const escapedModule = moduleName.replace(/'/g, "\\'")

    if (assignToVariable) {
      // Generate a local variable name
      const varName = context.getVariableName('mod')
      const code = `local ${varName} = require('${escapedModule}')`

      return createUnit(nodeId, 'builtin', [code], context.indentLevel, [
        varName,
      ])
    }

    // No variable assignment - just the require call
    const code = `require('${escapedModule}')`

    return createUnit(nodeId, 'builtin', [code], context.indentLevel)
  },
}
