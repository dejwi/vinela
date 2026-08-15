import { buildCallableKeyByGraphId } from '@/features/lua-generator/lua-utils'
import { buildGraphIndexes } from '@/features/lua-generator/traversal'
import type { CompilationUnit } from '@/features/lua-generator/types'
import {
  extractCallableContract,
  type Graph,
  type GraphCallableContract,
  isCallableEntryNode,
  isTriggerNode,
} from '@/shared/types'
import type { DiagnosticsCollector } from '../diagnostics/collector'
import { traverseGraph } from './traverse'

export interface GraphGenerationResult {
  callableUnits: CompilationUnit[]
  startupUnits: CompilationUnit[]
  callableContracts: Map<string, GraphCallableContract>
  callableKeyByGraphId: Map<string, string>
}

export function generateAllGraphs(
  graphs: Graph[],
  collector: DiagnosticsCollector,
): GraphGenerationResult {
  const callableUnits: CompilationUnit[] = []
  const startupUnits: CompilationUnit[] = []
  const callableContracts = new Map<string, GraphCallableContract>()

  const enabledGraphs = graphs.filter((graph) => graph.enabled)
  const traversalIndexes = buildGraphIndexes(enabledGraphs)

  for (const graph of enabledGraphs) {
    const contract = extractCallableContract(graph)
    if (contract !== null) {
      callableContracts.set(graph.id, contract)
    }
  }

  const callableKeyByGraphId = buildCallableKeyByGraphId(
    enabledGraphs
      .filter((graph) => callableContracts.has(graph.id))
      .map((graph) => ({ graphId: graph.id, graphName: graph.name })),
  )

  for (const graph of enabledGraphs) {
    if (graph.nodes.some((node) => isCallableEntryNode(node))) {
      const units = traverseGraph(graph, traversalIndexes, collector, {
        callableContracts,
        callableKeyByGraphId,
        entryFilter: isCallableEntryNode,
      })
      callableUnits.push(...units)
    }
  }

  for (const graph of enabledGraphs) {
    if (graph.nodes.some((node) => isTriggerNode(node))) {
      const units = traverseGraph(graph, traversalIndexes, collector, {
        callableContracts,
        callableKeyByGraphId,
        entryFilter: isTriggerNode,
      })
      startupUnits.push(...units)
    }
  }

  return {
    callableUnits,
    startupUnits,
    callableContracts,
    callableKeyByGraphId,
  }
}
