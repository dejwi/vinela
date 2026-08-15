// src/features/lua-generator/generators/nodes/control/condition.ts
// Condition node generator (if-then-else)

import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'
import type { ConditionNodeData, GraphNode } from '@/shared/types'
import { resolveInput } from '../shared/input-resolver'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createUnit } from '../types'

/**
 * Condition node generator.
 *
 * Input ports:
 *   - 'a' (data): First operand (falls back to node.data.hardcodedA if not connected)
 *   - 'b' (data): Second operand (falls back to node.data.hardcodedB if not connected)
 *
 * Output ports (execution):
 *   - 'true': Executed when condition is true
 *   - 'false': Executed when condition is false
 *
 * Generates:
 *   if {condition} then
 *     -- true branch
 *   else
 *     -- false branch
 *   end
 */
export const conditionGenerator: NodeGenerator<ConditionNodeData> = {
  generate(
    node: GraphNode<ConditionNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data } = node

    // Build condition expression.
    // Prefer connected data inputs; fall back to hardcoded values on the node.
    // Empty hardcoded values are not valid fallbacks — they require a connection.
    const aResult = resolveInput(context, 'a', data.hardcodedA)
    const bResult = resolveInput(context, 'b', data.hardcodedB)

    let hasError = false

    if (aResult.kind === 'missing') {
      hasError = true
      context.emitDiagnostic({
        id: 'node-missing-input',
        severity: 'error',
        category: 'connectivity',
        message: 'Missing required input: first operand (a)',
        details: `Port 'a' on condition node '${node.id}' has no connected input or fallback value.`,
        source: {
          graphId: context.graphId,
          nodeId: node.id,
          nodeType: 'condition',
          portId: 'a',
        },
        suggestions: [
          'Connect a data source to the first operand (a) port',
          'Set a hardcoded fallback value in the node configuration',
        ],
      })
    }

    if (bResult.kind === 'missing') {
      hasError = true
      context.emitDiagnostic({
        id: 'node-missing-input',
        severity: 'error',
        category: 'connectivity',
        message: 'Missing required input: second operand (b)',
        details: `Port 'b' on condition node '${node.id}' has no connected input or fallback value.`,
        source: {
          graphId: context.graphId,
          nodeId: node.id,
          nodeType: 'condition',
          portId: 'b',
        },
        suggestions: [
          'Connect a data source to the second operand (b) port',
          'Set a hardcoded fallback value in the node configuration',
        ],
      })
    }

    if (hasError) {
      return createUnit(node.id, 'condition', [], context.indentLevel)
    }

    // At this point both results are non-missing (guarded by hasError above)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const aExpr = aResult.kind !== 'missing' ? aResult.expression : ''
    const bExpr = bResult.kind !== 'missing' ? bResult.expression : ''

    // Build the condition expression
    const condition = `${aExpr} ${data.operator} ${bExpr}`

    // Generate true branch
    const trueBranchCode = context.renderExecFromPort(node.id, 'true')

    // Generate false branch
    const falseBranchCode = context.renderExecFromPort(node.id, 'false')

    // Build the if-else block
    const builder = new LuaBuilder()

    // Apply current indent level
    for (let i = 0; i < context.indentLevel; i++) {
      builder.indent()
    }

    // If both branches are empty, emit a warning but still generate the structure
    if (trueBranchCode.length === 0 && falseBranchCode.length === 0) {
      context.emitDiagnostic({
        id: 'condition-empty-branches',
        severity: 'warning',
        category: 'connectivity',
        message: 'Condition node has no connected branches',
        details: `Node '${node.id}' has neither true nor false execution branches connected.`,
        source: {
          graphId: context.graphId,
          nodeId: node.id,
          nodeType: 'condition',
        },
        suggestions: [
          'Connect nodes to the true branch for when the condition is met',
          'Connect nodes to the false branch for when the condition is not met',
        ],
      })
    }

    // Emit if-else block
    if (falseBranchCode.length === 0) {
      // Only true branch - use if-then-end
      builder.block(
        `if ${condition} then`,
        (inner) => {
          for (const line of trueBranchCode) {
            inner.line(line)
          }
        },
        'end',
      )
    } else if (trueBranchCode.length === 0) {
      // Only false branch - negate condition
      builder.block(
        `if not (${condition}) then`,
        (inner) => {
          for (const line of falseBranchCode) {
            inner.line(line)
          }
        },
        'end',
      )
    } else {
      // Both branches - full if-then-else-end
      builder.line(`if ${condition} then`)
      builder.indent()
      for (const line of trueBranchCode) {
        builder.line(line)
      }
      builder.dedent()
      builder.line('else')
      builder.indent()
      for (const line of falseBranchCode) {
        builder.line(line)
      }
      builder.dedent()
      builder.line('end')
    }

    // Render 'done' continuation: nodes chained after the if/else block.
    // The 'done' port fires unconditionally after the condition evaluates,
    // regardless of which branch ran (analogous to loop's 'done' port).
    const doneContinuationCode = context.renderExecFromPort(node.id, 'done')
    for (const line of doneContinuationCode) {
      builder.line(line)
    }

    const code = builder
      .build()
      .split('\n')
      .filter((line) => line.length > 0)

    return createUnit(node.id, 'condition', code, context.indentLevel)
  },
}
