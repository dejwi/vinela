import type { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { sanitizeLuaIdentifier } from '@/features/lua-generator/lua-utils'
import { traverseExecFlow } from '@/features/lua-generator/traversal'
import type { TraversalGenerationContext } from '@/features/lua-generator/traversal/types'
import type {
  CallableContract,
  CompilationUnit,
} from '@/features/lua-generator/types'
import type { Graph, GraphNode } from '@/shared/types'
import type { TraversalGraphIndexes } from '../traversal/types'

export interface TraverseGraphOptions {
  callableContracts?: ReadonlyMap<string, CallableContract>
  callableKeyByGraphId?: ReadonlyMap<string, string>
  entryFilter?: (node: GraphNode) => boolean
}

export function traverseGraph(
  graph: Graph,
  indexes: TraversalGraphIndexes,
  collector: DiagnosticsCollector,
  options: TraverseGraphOptions = {},
): CompilationUnit[] {
  const indexedGraph = indexes.byGraph.get(graph.id)
  if (indexedGraph === undefined) {
    collector.addWarning({
      id: 'orchestrator-index-missing-graph',
      category: 'structure',
      message: `Graph '${graph.id}' is not present in provided indexes`,
      source: { graphId: graph.id },
      suggestions: ['Rebuild graph indexes before traversal'],
    })
    return []
  }

  const callableContracts = options.callableContracts ?? new Map()
  const context: TraversalGenerationContext = {
    currentGraphId: graph.id,
    graphName: graph.name,
    graphEdges: graph.edges,
    enableNodeGeneration: true,
    indentLevel: 0,
    variableCounter: 0,
    graphContracts: callableContracts,
    callableSymbolByGraphId: buildCallableSymbolMap(callableContracts),
    ...(options.callableKeyByGraphId !== undefined
      ? { callableKeyByGraphId: options.callableKeyByGraphId }
      : {}),
  }

  const units: CompilationUnit[] = []
  const emitted = new Set<string>()
  const entryNodeIds = [...indexedGraph.entries]
    .sort((a, b) => a.localeCompare(b))
    .filter((entryNodeId) => {
      if (options.entryFilter === undefined) {
        return true
      }

      const node = indexedGraph.nodesById.get(entryNodeId)
      return node !== undefined && options.entryFilter(node)
    })

  for (const entryNodeId of entryNodeIds) {
    const entryUnits = traverseExecFlow(
      entryNodeId,
      indexedGraph,
      context,
      collector,
    )

    for (const unit of entryUnits) {
      if (emitted.has(unit.nodeId)) {
        continue
      }

      emitted.add(unit.nodeId)
      units.push(unit)
    }
  }

  return units
}

function buildCallableSymbolMap(
  callableContracts: ReadonlyMap<string, CallableContract>,
): Map<string, string> {
  const symbols = new Map<string, string>()

  for (const graphId of callableContracts.keys()) {
    symbols.set(graphId, `_nvimset_${sanitizeLuaIdentifier(graphId)}`)
  }

  return symbols
}
