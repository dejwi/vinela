// src/features/lua-generator/generators/nodes/control/loop.ts
// Loop node generator (for, while, each)

import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'
import type { GraphNode, LoopNodeData } from '@/shared/types'
import { sanitizeIdentifier } from '../shared/output-vars'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createUnit } from '../types'

/**
 * Loop node generator.
 *
 * Supports three loop types:
 *   - 'for': Numeric for loop (e.g., for i = 1, 10 do ... end)
 *   - 'while': Conditional loop (e.g., while condition do ... end)
 *   - 'each': Iterator loop (e.g., for _, item in ipairs(list) do ... end)
 *
 * Input ports:
 *   - 'exec': Trigger to start the loop
 *
 * Output ports (execution):
 *   - 'loop': Loop body (executed each iteration) [UI: 'Loop Body']
 *   - 'done': After loop completes [UI: 'Completed']
 *
 * Output ports (data):
 *   - 'item': Current item (each loops)
 *   - 'index': Current index (each loops)
 */
export const loopGenerator: NodeGenerator<LoopNodeData> = {
  generate(
    node: GraphNode<LoopNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data } = node

    // Sanitize iterator variable name, default to '_i' if empty
    const iteratorVar = sanitizeIdentifier(data.iteratorVariable.trim() || '_i')

    // Validate iterator expression
    const expression = data.iterableExpression?.trim() ?? ''
    if (expression.length === 0) {
      context.emitDiagnostic({
        id: 'loop-empty-expression',
        severity: 'error',
        category: 'config',
        message: 'Loop has empty iterator expression',
        details: `Node '${node.id}' requires a valid expression for the ${data.loopType} loop.`,
        source: {
          graphId: context.graphId,
          nodeId: node.id,
          nodeType: 'loop',
        },
        suggestions: [
          `Set the iterator expression in the node configuration`,
          `For 'for' loops: use 'start,stop,step' format`,
          `For 'while' loops: provide a condition expression`,
          `For 'each' loops: provide a table expression`,
        ],
      })

      return createUnit(node.id, 'loop', [], context.indentLevel)
    }

    // Generate loop body code
    // Port ID 'loop' matches the UI LoopNode's 'Loop Body' output port
    const bodyCode = context.renderExecFromPort(node.id, 'loop')

    // Build the loop
    const builder = new LuaBuilder()

    // Apply current indent level
    for (let i = 0; i < context.indentLevel; i++) {
      builder.indent()
    }

    switch (data.loopType) {
      case 'for': {
        generateForLoop(builder, iteratorVar, expression, bodyCode)
        break
      }

      case 'while': {
        generateWhileLoop(builder, expression, bodyCode)
        break
      }

      case 'each': {
        generateEachLoop(builder, iteratorVar, expression, bodyCode)
        break
      }

      default: {
        // Unknown loop type
        context.emitDiagnostic({
          id: 'loop-unknown-type',
          severity: 'error',
          category: 'config',
          message: `Unknown loop type: ${String(data.loopType)}`,
          details: `Node '${node.id}' has an unrecognized loop type.`,
          source: {
            graphId: context.graphId,
            nodeId: node.id,
            nodeType: 'loop',
          },
          suggestions: ['Use one of: for, while, each'],
        })

        return createUnit(node.id, 'loop', [], context.indentLevel)
      }
    }

    const code = builder
      .build()
      .split('\n')
      .filter((line) => line.length > 0)

    return createUnit(node.id, 'loop', code, context.indentLevel)
  },
}

/**
 * Generate a numeric for loop.
 * Format: for var = start, stop, step do ... end
 */
function generateForLoop(
  builder: LuaBuilder,
  varName: string,
  expression: string,
  bodyCode: string[],
): void {
  // Parse numeric for expression: start,stop[,step]
  const parts = expression.split(',').map((p) => p.trim())

  if (parts.length < 2) {
    // Not enough parts - fallback to generic while loop
    generateWhileLoop(builder, expression, bodyCode)
    return
  }

  const startExpr = parts[0]
  const stopExpr = parts[1]
  const stepExpr = parts[2]

  // Build for loop
  const forClause =
    stepExpr !== undefined
      ? `for ${varName} = ${startExpr}, ${stopExpr}, ${stepExpr} do`
      : `for ${varName} = ${startExpr}, ${stopExpr} do`

  builder.block(
    forClause,
    (inner) => {
      for (const line of bodyCode) {
        inner.line(line)
      }
    },
    'end',
  )
}

/**
 * Generate a while loop.
 * Format: while condition do ... end
 */
function generateWhileLoop(
  builder: LuaBuilder,
  condition: string,
  bodyCode: string[],
): void {
  builder.block(
    `while ${condition} do`,
    (inner) => {
      for (const line of bodyCode) {
        inner.line(line)
      }
    },
    'end',
  )
}

/**
 * Generate an each (iterator) loop.
 * Format: for _, item in ipairs(list) do ... end
 */
function generateEachLoop(
  builder: LuaBuilder,
  itemVar: string,
  iterableExpr: string,
  bodyCode: string[],
): void {
  // Use ipairs for array-like iteration, pairs for general tables
  // For simplicity, we use pairs which works for both
  builder.block(
    `for _, ${itemVar} in pairs(${iterableExpr}) do`,
    (inner) => {
      for (const line of bodyCode) {
        inner.line(line)
      }
    },
    'end',
  )
}
