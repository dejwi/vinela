// src/features/lua-generator/generators/nodes/return.ts
// Return node generator

import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'
import type { GraphNode, ReturnNodeData } from '@/shared/types'
import { resolveInputOptional } from './shared/input-resolver'
import type { CompilationUnit, GenerationContext, NodeGenerator } from './types'
import { createUnit } from './types'

/**
 * Return node generator.
 *
 * Generates a return statement for callable graphs:
 *
 *   return {
 *     ["portId1"] = value1,
 *     ["portId2"] = value2,
 *     ...
 *   }
 *
 * Must be inside a callable graph (a graph with a Callable Entry node).
 * Returns values are keyed by port ID to ensure stable contract.
 */
export const returnGenerator: NodeGenerator<ReturnNodeData> = {
  generate(
    node: GraphNode<ReturnNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data } = node

    // Check if we're inside a callable graph
    const callableSymbol = context.callableSymbolByGraphId.get(context.graphId)

    if (callableSymbol === undefined) {
      context.emitDiagnostic({
        id: 'return-outside-callable',
        severity: 'warning',
        category: 'structure',
        message: 'Return node outside callable graph',
        details: `Node '${node.id}' is a Return node, but graph '${context.graphId}' has no Callable Entry. The return statement will have no effect in startup graphs.`,
        source: {
          graphId: context.graphId,
          nodeId: node.id,
          nodeType: 'return',
        },
        suggestions: [
          'Add a Callable Entry node to make this graph callable',
          'Remove the Return node if this is a startup graph',
          'Move the Return node to a graph with a Callable Entry',
        ],
      })

      // Still generate the return, but it won't be used meaningfully
    }

    // Build return values from input bindings or fallback
    const returnEntries: Record<string, string> = {}

    for (const retVal of data.returnValues) {
      const inputExpr = resolveInputOptional(
        context,
        retVal.id,
        // No hardcoded fallback - return nil if not connected
      )

      // Use the input expression or default to nil
      returnEntries[retVal.id] = inputExpr.length > 0 ? inputExpr : 'nil'
    }

    // Build the return statement
    const builder = new LuaBuilder()

    // Apply current indent level
    for (let i = 0; i < context.indentLevel; i++) {
      builder.indent()
    }

    // Generate return table
    const entries = Object.entries(returnEntries)

    if (entries.length === 0) {
      // Empty return
      builder.line('return {}')
    } else if (entries.length === 1) {
      // Single return value - simple inline table
      const entry = entries[0]
      if (entry !== undefined) {
        const [key, value] = entry
        builder.line(`return { ["${key}"] = ${value} }`)
      }
    } else {
      // Multiple return values - multi-line table
      builder.line('return {')
      builder.indent()
      for (const [key, value] of entries) {
        builder.line(`["${key}"] = ${value},`)
      }
      builder.dedent()
      builder.line('}')
    }

    const code = builder
      .build()
      .split('\n')
      .filter((line) => line.length > 0)

    return createUnit(node.id, 'return', code, context.indentLevel)
  },
}
