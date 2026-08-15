// src/features/lua-generator/generators/nodes/callable-entry.ts
// Callable Entry node generator

import type { CallableContract } from '@/features/lua-generator/types'
import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'
import { CALLABLE_REGISTRY_GLOBAL } from '@/shared/lib/app-identity'
import type { CallableEntryNodeData, GraphNode } from '@/shared/types'
import { generateParamVarName } from './shared/output-vars'
import {
  type CompilationUnit,
  callableKeyFor,
  createUnit,
  type GenerationContext,
  type NodeGenerator,
} from './types'

/**
 * Callable Entry node generator.
 *
 * Defines a callable function boundary for a graph. Generates:
 *
 *   _G._vinela_callables["{graphId}"] = function(params)
 *     -- materialize parameters
 *     local param_xxx = params["xxx"]
 *     ...
 *     -- body
 *     ...
 *   end
 *
 * The function is registered in a global table so GraphRef nodes
 * can call it by graph ID.
 *
 * Input ports:
 *   - 'exec': Trigger to call this function (internal use)
 *
 * Output ports (data):
 *   - One port per defined parameter
 */
export const callableEntryGenerator: NodeGenerator<CallableEntryNodeData> = {
  generate(
    node: GraphNode<CallableEntryNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data } = node
    const contract: CallableContract | undefined =
      context.callableContracts?.get(context.graphId)
    const parameters = contract?.parameters ?? data.parameters

    // Get the callable symbol name for this graph
    const callableSymbol = context.callableSymbolByGraphId.get(context.graphId)

    if (callableSymbol === undefined) {
      context.emitDiagnostic({
        id: 'callable-entry-no-symbol',
        severity: 'error',
        category: 'reference',
        message: 'Callable entry has no registered symbol',
        details: `Graph '${context.graphId}' has a Callable Entry node but no callable symbol was registered.`,
        source: {
          graphId: context.graphId,
          nodeId: node.id,
          nodeType: 'callable-entry',
        },
        suggestions: [
          'Ensure the graph has exactly one Callable Entry node',
          'Check that the graph is being processed as a callable',
        ],
      })

      return createUnit(node.id, 'callable-entry', [], context.indentLevel)
    }

    // Generate function body code
    const bodyCode = context.renderExecFromPort(node.id, 'exec')

    // Build the function definition
    const builder = new LuaBuilder()

    // Apply current indent level
    for (let i = 0; i < context.indentLevel; i++) {
      builder.indent()
    }

    // Build output bindings for parameters
    const outputBindings: Record<string, string> = {}

    // Generate parameter materialization code
    const paramMaterializations: string[] = []

    for (const param of parameters) {
      // Use the hint variable name if provided (pre-seeded by traversal), so
      // the generated local declaration matches the name registered in
      // valueBindings before this generator ran. Fall back to the canonical
      // param_<portId> name when no hint is available (e.g. standalone tests).
      const paramVar =
        context.outputBindingHints[param.id] ?? generateParamVarName(param.id)
      const keyLiteral = context.toLuaLiteral(param.id)

      // Materialize from params table (stable by port ID)
      paramMaterializations.push(`local ${paramVar} = params[${keyLiteral}]`)

      // Register output binding
      outputBindings[param.id] = paramVar
    }

    // Emit global function registration
    const callableKey = callableKeyFor(
      context,
      context.graphId,
      context.graphName,
    )
    const globalPath = `_G.${CALLABLE_REGISTRY_GLOBAL}[${context.toLuaLiteral(callableKey)}]`

    builder.block(
      `${globalPath} = function(params)`,
      (inner) => {
        // Materialize parameters
        for (const mat of paramMaterializations) {
          inner.line(mat)
        }

        if (paramMaterializations.length > 0 && bodyCode.length > 0) {
          inner.blank()
        }

        // Body
        for (const line of bodyCode) {
          inner.line(line)
        }
      },
      'end',
    )

    const code = builder
      .build()
      .split('\n')
      .filter((line) => line.length > 0)

    return {
      nodeId: node.id,
      nodeType: 'callable-entry',
      code,
      localVars: Object.values(outputBindings),
      inputBindings: {},
      outputBindings,
      indentLevel: context.indentLevel,
    }
  },
}
