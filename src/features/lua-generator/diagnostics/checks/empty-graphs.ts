// ============================================
// Check 9: Empty Graphs
// ============================================

import type { Graph, GraphNode } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for empty graphs.
 */
export const EMPTY_GRAPHS_CHECK_ID = 'check-empty-graphs'

/**
 * Find entry nodes in a graph (trigger and callable-entry).
 */
function findEntryNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return nodes.filter(
    (node) =>
      node.data.nodeType === 'trigger' ||
      node.data.nodeType === 'callable-entry',
  )
}

/**
 * Check for executable content in a graph.
 * Returns true if the graph has nodes that would actually do something.
 */
function hasExecutableContent(graph: Graph): boolean {
  // Graphs with action nodes have executable content
  const hasActions = graph.nodes.some((n) => n.data.nodeType === 'action')
  if (hasActions) {
    return true
  }

  // Graphs with code blocks have executable content
  const hasCodeBlocks = graph.nodes.some(
    (n) => n.data.nodeType === 'code-block',
  )
  if (hasCodeBlocks) {
    // Only count non-empty code blocks
    const hasNonEmptyCodeBlock = graph.nodes.some(
      (n) => n.data.nodeType === 'code-block' && n.data.code.trim().length > 0,
    )
    if (hasNonEmptyCodeBlock) {
      return true
    }
  }

  // Graphs with run-function nodes have executable content
  const hasRunFunctions = graph.nodes.some(
    (n) => n.data.nodeType === 'run-function',
  )
  if (hasRunFunctions) {
    return true
  }

  // Graphs with builtin nodes have executable content
  const hasBuiltins = graph.nodes.some((n) => n.data.nodeType === 'builtin')
  if (hasBuiltins) {
    return true
  }

  // Graphs with graph-ref nodes have executable content (they call other graphs)
  const hasGraphRefs = graph.nodes.some((n) => n.data.nodeType === 'graph-ref')
  if (hasGraphRefs) {
    return true
  }

  // Graphs with condition or loop nodes that have body content
  const hasConditions = graph.nodes.some((n) => n.data.nodeType === 'condition')
  const hasLoops = graph.nodes.some((n) => n.data.nodeType === 'loop')
  if (hasConditions || hasLoops) {
    return true
  }

  return false
}

/**
 * Check for empty graphs.
 *
 * - Graphs with no nodes → Warning
 * - Graphs with no entry points → Warning
 * - Graphs with entry but no executable content → Warning
 *
 * Complexity: O(G * N) where G = graphs, N = nodes per graph
 */
export function checkEmptyGraphs(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    // Skip disabled graphs - they are excluded from generation
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    // Check 1: Graph with no nodes
    if (graph.nodes.length === 0) {
      collector.addWarning({
        id: 'WARN_EMPTY_GRAPH_NO_NODES',
        category: 'structure',
        message: `Graph "${graph.name}" has no nodes`,
        details:
          'This graph is completely empty and will not generate any Lua code.',
        source: {
          graphId: graph.id,
          graphName: graph.name,
        },
        suggestions: [
          'Add nodes to this graph',
          'Delete this graph if it is not needed',
        ],
      })
      continue
    }

    // Check 2: Graph with no entry points
    const entryNodes = findEntryNodes(graph.nodes)
    if (entryNodes.length === 0) {
      collector.addWarning({
        id: 'WARN_EMPTY_GRAPH_NO_ENTRY',
        category: 'structure',
        message: `Graph "${graph.name}" has no entry points`,
        details:
          'This graph has nodes but no Trigger or Callable Entry node. Nothing will execute this graph.',
        source: {
          graphId: graph.id,
          graphName: graph.name,
        },
        suggestions: [
          'Add a Trigger node for startup execution',
          'Add a Callable Entry node to make this graph callable from others',
          'Delete this graph if it is not needed',
        ],
      })
      continue
    }

    // Check 3: Graph with entry but no executable content
    if (!hasExecutableContent(graph)) {
      // Skip if it only has return nodes (those are valid for callable graphs)
      const hasOnlyReturns = graph.nodes.every(
        (n) =>
          n.data.nodeType === 'return' ||
          n.data.nodeType === 'callable-entry' ||
          n.data.nodeType === 'trigger',
      )

      if (hasOnlyReturns) {
        collector.addWarning({
          id: 'WARN_EMPTY_GRAPH_NO_CONTENT',
          category: 'structure',
          message: `Graph "${graph.name}" has no executable content`,
          details:
            'This graph has entry points but no actions, code blocks, or function calls. It will execute but do nothing.',
          source: {
            graphId: graph.id,
            graphName: graph.name,
          },
          suggestions: [
            'Add action nodes to perform operations',
            'Add code block nodes for custom Lua',
            'Add function calls to execute plugin functions',
          ],
        })
      }
    }
  }
}
