// src/features/lua-generator/generators/nodes/builtin/delay.ts
// automation.delay builtin generator — wraps downstream execution in vim.defer_fn

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'

/**
 * Builtin generator for automation.delay.
 *
 * Config:
 * - delayMs: number (default: 100, min: 0, integer)
 *
 * This is a wrapping node — downstream execution is placed inside the
 * vim.defer_fn callback so it runs after the delay.
 *
 * Generates:
 * ```lua
 * vim.defer_fn(function()
 *   -- downstream code
 * end, 100)
 * ```
 */
export const delayGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data
    const { indentLevel, emitDiagnostic, graphId, renderExecFromPort } = context

    // Resolve delayMs from config
    const rawDelay = config['delayMs']
    const delayMs =
      typeof rawDelay === 'number' && Number.isFinite(rawDelay)
        ? Math.round(rawDelay)
        : 100

    // Warn if delayMs is negative (clamp to 0 for generated code)
    if (delayMs < 0) {
      emitDiagnostic({
        id: 'builtin-delay-negative',
        severity: 'warning',
        category: 'config',
        message: 'Delay builtin has a negative delay — clamping to 0ms',
        details: `Node '${nodeId}' has delayMs = ${rawDelay as number}. Negative delays are not valid; using 0ms instead.`,
        source: {
          graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: ['Set delayMs to a non-negative integer'],
      })
    }

    // Warn if delayMs is 0 (unusual but valid — defers to next event loop tick)
    if (delayMs === 0) {
      emitDiagnostic({
        id: 'builtin-delay-zero',
        severity: 'warning',
        category: 'config',
        message: 'Delay builtin has a delay of 0ms',
        details: `Node '${nodeId}' uses 0ms delay, which defers execution to the next event loop tick. This is valid but unusual.`,
        source: {
          graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Use a non-zero delay if you intended a timed deferral',
          'A 0ms delay defers execution to the next event loop tick',
        ],
      })
    }

    const effectiveDelay = Math.max(0, delayMs)

    // Render downstream code from the 'done' exec port
    const downstreamLines = renderExecFromPort(nodeId, 'done')

    // Build the wrapped vim.defer_fn call
    const code: string[] = []
    code.push('vim.defer_fn(function()')
    for (const line of downstreamLines) {
      code.push(`  ${line}`)
    }
    code.push(`end, ${effectiveDelay})`)

    return {
      nodeId,
      nodeType: 'builtin:automation.delay',
      code,
      localVars: [],
      inputBindings: {},
      outputBindings: { done: 'nil' },
      indentLevel,
    }
  },
}
