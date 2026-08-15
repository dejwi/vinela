// src/features/lua-generator/generators/nodes/advanced/graph-ref.ts
// Graph Reference node generator - calls callable graphs

import type { CallableContract } from '@/features/lua-generator/types'
import { CALLABLE_REGISTRY_GLOBAL } from '@/shared/lib/app-identity'
import type { GraphNode, GraphRefNodeData } from '@/shared/types'
import { resolveInputOptional } from '../shared/input-resolver'
import {
  type CompilationUnit,
  callableKeyFor,
  createEmptyUnit,
  createUnit,
  type GenerationContext,
  type NodeGenerator,
} from '../types'

/**
 * Node generator for Graph Reference nodes.
 *
 * Generates a call to a callable graph via the global callable registry.
 * The callable graph must have a Callable Entry node defining its interface.
 */
export const graphRefGenerator: NodeGenerator<GraphRefNodeData> = {
  generate(
    node: GraphNode<GraphRefNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { referencedGraphId, cachedContract } = data

    // Validate: Target graph must be specified
    if (!referencedGraphId || referencedGraphId.length === 0) {
      context.emitDiagnostic({
        id: 'graph-ref-missing-target',
        severity: 'error',
        category: 'reference',
        message: 'Graph reference has no target graph specified',
        details: `Node '${nodeId}' is a graph reference but has no target graph ID set.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'graph-ref',
        },
        suggestions: ['Select a target callable graph in the node properties'],
      })
      return createEmptyUnit(nodeId, 'graph-ref', context.indentLevel)
    }

    // Resolve the callable symbol from the context
    const callableSymbol =
      context.callableSymbolByGraphId.get(referencedGraphId)

    const contractFromContext =
      context.callableContracts?.get(referencedGraphId)

    // Validate: Target graph must exist in the callable registry
    if (callableSymbol === undefined && contractFromContext === undefined) {
      context.emitDiagnostic({
        id: 'graph-ref-target-not-callable',
        severity: 'error',
        category: 'reference',
        message: `Target graph '${referencedGraphId}' is not callable`,
        details: `Node '${nodeId}' references graph '${referencedGraphId}' which does not exist or is not callable (missing Callable Entry node).`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'graph-ref',
        },
        suggestions: [
          'Ensure the target graph has a Callable Entry node',
          'Verify the target graph is enabled',
        ],
      })
      return createEmptyUnit(nodeId, 'graph-ref', context.indentLevel)
    }

    // Use cached contract for port information, or fall back to empty arrays
    // Note: cachedContract from GraphRefNodeData only has parameters/returnValues,
    // not the full GraphCallableContract fields (graphId, graphName)
    const rawContract = cachedContract

    // Construct a valid contract with all required fields
    const contract: CallableContract = contractFromContext ?? {
      graphId: referencedGraphId,
      graphName: callableSymbol ?? referencedGraphId,
      parameters: rawContract?.parameters ?? [],
      returnValues: rawContract?.returnValues ?? [],
    }

    // Build argument table for the call
    // Arguments are passed by port ID to ensure stability across renames
    const argsEntries: string[] = []
    const inputBindings: Record<string, string> = {}

    for (const param of contract.parameters) {
      const portId = param.id
      // Resolve the input value for this parameter
      const value = resolveInputOptional(context, portId)

      if (value.length > 0) {
        // Use the port ID as the key in the arguments table
        const keyLiteral = context.toLuaLiteral(portId)
        argsEntries.push(`[${keyLiteral}] = ${value}`)
        inputBindings[portId] = value
      }
    }

    const argsTable =
      argsEntries.length > 0 ? `{ ${argsEntries.join(', ')} }` : '{}'

    // Build the call expression
    const callableKey = callableKeyFor(
      context,
      referencedGraphId,
      contractFromContext?.graphName,
    )
    const callableRef = `_G.${CALLABLE_REGISTRY_GLOBAL}[${context.toLuaLiteral(callableKey)}]`

    // Generate output variable bindings for return values
    const outputBindings: Record<string, string> = {}
    const localVars: string[] = []

    if (contract.returnValues.length === 0) {
      // No return values - just call the function
      const code = `${callableRef}(${argsTable})`

      return createUnit(
        nodeId,
        'graph-ref',
        [code],
        context.indentLevel,
        localVars,
      )
    }

    // Capture the callable return table once, then materialize each return value
    const resultTableVar = context.getVariableName('ret_table')
    localVars.push(resultTableVar)

    const callLine = `local ${resultTableVar} = ${callableRef}(${argsTable})`
    const mappingLines: string[] = []

    for (const returnValue of contract.returnValues) {
      const varName = context.getVariableName(`ret_${returnValue.id}`)
      const keyLiteral = context.toLuaLiteral(returnValue.id)

      localVars.push(varName)
      outputBindings[returnValue.id] = varName
      mappingLines.push(`local ${varName} = ${resultTableVar}[${keyLiteral}]`)
    }

    return {
      nodeId,
      nodeType: 'graph-ref',
      code: [callLine, ...mappingLines],
      localVars,
      inputBindings,
      outputBindings,
      indentLevel: context.indentLevel,
    }
  },
}
