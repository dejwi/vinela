// ============================================
// Domain 2: Data Dependencies
// Resolve data dependencies using topological sort (Kahn's algorithm)
// ============================================

import type { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { detectLocalDataCycles, formatCycle } from './cycle-detection'
import type {
  DataEdge,
  IndexedGraph,
  LuaValueRef,
  NodeOutputRef,
  TopologicalSortResult,
} from './types'
import { generateVariableName, makeBindingKey } from './variable-naming'

/**
 * Collect all data edges in the dependency subgraph for a node.
 * This traverses upstream to find all data providers and their dependencies.
 */
function collectDependencySubgraph(
  nodeId: string,
  indexes: IndexedGraph,
  visited: Set<string> = new Set(),
  collectedEdges: DataEdge[] = [],
): DataEdge[] {
  // Prevent infinite recursion
  if (visited.has(nodeId)) {
    return collectedEdges
  }
  visited.add(nodeId)

  // Get incoming data edges for this node
  const incomingData = indexes.incomingDataByNode.get(nodeId) ?? []

  for (const edge of incomingData) {
    // Add this edge to the collection
    collectedEdges.push(edge)

    // Recursively collect from the source node
    collectDependencySubgraph(
      edge.sourceNodeId,
      indexes,
      visited,
      collectedEdges,
    )
  }

  return collectedEdges
}

/**
 * Resolve data dependencies for a node.
 * Returns the topological order of provider nodes and the input bindings map.
 *
 * @param nodeId - The target node
 * @param indexes - The indexed graph
 * @param valueBindings - Already-resolved value bindings
 * @param usedTempNames - Set of used temp variable names
 * @param collector - Diagnostics collector
 * @returns Object with resolved dependencies and bindings, or null on error
 */
export function resolveDataDependencies(
  nodeId: string,
  indexes: IndexedGraph,
  valueBindings: ReadonlyMap<string, LuaValueRef>,
  usedTempNames: ReadonlySet<string>,
  collector: DiagnosticsCollector,
): {
  dependencies: readonly NodeOutputRef[]
  bindings: Record<string, string>
  newTempNames: readonly string[]
} | null {
  // Collect all incoming data edges for this node
  const incomingData = indexes.incomingDataByNode.get(nodeId) ?? []

  if (incomingData.length === 0) {
    return { dependencies: [], bindings: {}, newTempNames: [] }
  }

  // Group edges by target port
  const edgesByTargetPort = new Map<string, DataEdge[]>()
  for (const edge of incomingData) {
    const list = edgesByTargetPort.get(edge.targetPortId) ?? []
    list.push(edge)
    edgesByTargetPort.set(edge.targetPortId, list)
  }

  // Build complete dependency subgraph by traversing all reachable providers
  const allDataEdges = collectDependencySubgraph(nodeId, indexes)

  // Build dependency graph for topological sort
  const dependencyGraph = buildDependencyGraph(allDataEdges, valueBindings)

  // Check for cycles in the dependency graph
  const cycles = detectLocalDataCycles(
    dependencyGraph.nodes,
    (id) => dependencyGraph.edges.get(id) ?? [],
  )

  if (cycles.length > 0) {
    const cycleStr = cycles.map(formatCycle).join('; ')
    collector.addError({
      id: 'data-cycle-detected',
      category: 'cycle',
      message: `Data dependency cycle detected for node ${nodeId}`,
      details: `Cycles: ${cycleStr}`,
      source: { nodeId, nodeType: getNodeType(indexes, nodeId) },
      suggestions: ['Remove circular data dependencies'],
    })
    return null
  }

  // Run Kahn's algorithm for topological sort
  const topoResult = runKahnTopologicalSort(dependencyGraph)

  if (!topoResult.success) {
    collector.addError({
      id: 'data-cycle-detected',
      category: 'cycle',
      message: `Could not resolve data dependencies for node ${nodeId}`,
      details: 'Topological sort failed due to unresolved dependencies',
      source: { nodeId, nodeType: getNodeType(indexes, nodeId) },
      suggestions: ['Check for circular data dependencies'],
    })
    return null
  }

  // Generate bindings for each input port
  const bindings: Record<string, string> = {}
  const newTempNames: string[] = []
  const localUsedNames = new Set(usedTempNames)

  for (const [portId, edges] of edgesByTargetPort) {
    if (edges.length === 0) continue

    // For now, take the first edge (deterministic by sort order)
    // In the future, we could support multiple sources with merge logic
    const edge = edges[0]
    if (!edge) continue

    const bindingKey = makeBindingKey(edge.sourceNodeId, edge.sourcePortId)
    const valueRef = valueBindings.get(bindingKey)

    if (valueRef) {
      // Already resolved - use the existing reference
      switch (valueRef.kind) {
        case 'literal':
          bindings[portId] = valueRef.lua
          break
        case 'temp':
          bindings[portId] = valueRef.name
          break
        case 'param':
          bindings[portId] = valueRef.name
          break
      }
    } else {
      // Need to generate a temp variable for this provider
      const tempName = generateVariableName(
        edge.sourceNodeId,
        edge.sourcePortId,
        localUsedNames,
      )
      localUsedNames.add(tempName)
      newTempNames.push(tempName)
      bindings[portId] = tempName
    }
  }

  return {
    dependencies: topoResult.ordered,
    bindings,
    newTempNames,
  }
}

interface DependencyGraph {
  nodes: Set<string>
  edges: Map<
    string,
    { readonly targetNodeId: string; readonly edge: DataEdge }[]
  >
  inDegree: Map<string, number>
}

function buildDependencyGraph(
  dataEdges: readonly DataEdge[],
  _valueBindings: ReadonlyMap<string, LuaValueRef>,
): DependencyGraph {
  const nodes = new Set<string>()
  const edges = new Map<
    string,
    { readonly targetNodeId: string; readonly edge: DataEdge }[]
  >()
  const inDegree = new Map<string, number>()

  for (const edge of dataEdges) {
    nodes.add(edge.sourceNodeId)
    nodes.add(edge.targetNodeId)

    // Add edge from source to target
    const edgeList = edges.get(edge.sourceNodeId) ?? []
    edgeList.push({ targetNodeId: edge.targetNodeId, edge })
    edges.set(edge.sourceNodeId, edgeList)

    // Track in-degree
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1)
    inDegree.set(edge.sourceNodeId, inDegree.get(edge.sourceNodeId) ?? 0)
  }

  return { nodes, edges, inDegree }
}

function runKahnTopologicalSort(graph: DependencyGraph): TopologicalSortResult {
  const inDegree = new Map(graph.inDegree)
  const queue: string[] = []
  const result: NodeOutputRef[] = []

  // Start with nodes having in-degree of 0
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId)
    }
  }

  // Sort queue for deterministic ordering
  queue.sort()

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId) continue

    // For this node, add output refs for all its output ports
    // We use a placeholder - in practice, the port IDs would come from the actual node
    result.push({ nodeId, portId: 'out' })

    // Reduce in-degree of neighbors
    const outgoingEdges = graph.edges.get(nodeId) ?? []
    for (const { targetNodeId } of outgoingEdges) {
      const newDegree = (inDegree.get(targetNodeId) ?? 0) - 1
      inDegree.set(targetNodeId, newDegree)

      if (newDegree === 0) {
        queue.push(targetNodeId)
        queue.sort() // Maintain deterministic ordering
      }
    }
  }

  // Check for remaining nodes (cycle detected)
  const remainingNodes: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree > 0) {
      remainingNodes.push(nodeId)
    }
  }

  if (remainingNodes.length > 0) {
    // Return cycle information
    return {
      success: false,
      cycle: remainingNodes.map((id) => ({ nodeId: id, portId: 'out' })),
    }
  }

  return { success: true, ordered: result }
}

function getNodeType(indexes: IndexedGraph, nodeId: string): string {
  const node = indexes.nodesById.get(nodeId)
  return node?.data.nodeType ?? 'unknown'
}

/**
 * Create a value binding for a literal value.
 */
export function createLiteralBinding(lua: string): LuaValueRef {
  return { kind: 'literal', lua }
}

/**
 * Create a value binding for a temp variable.
 */
export function createTempBinding(name: string): LuaValueRef {
  return { kind: 'temp', name }
}

/**
 * Create a value binding for a parameter.
 */
export function createParamBinding(name: string): LuaValueRef {
  return { kind: 'param', name }
}
