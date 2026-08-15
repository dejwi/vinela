import { listGraphs } from '@/features/graph-editor/storage'
import type { Graph, GraphEdge } from '@/shared/types'
import type { GraphSourcedKeymap } from './types'

/**
 * Scan all graphs in a project for set-keymap action nodes.
 * Only includes nodes where showInKeymaps is true.
 *
 * @param projectPath - Absolute path to the project folder
 * @returns Array of graph-sourced keymaps
 */
export async function scanGraphsForKeymaps(
  projectPath: string,
): Promise<GraphSourcedKeymap[]> {
  const graphs = await listGraphs(projectPath)
  return extractKeymapsFromGraphs(graphs)
}

/**
 * Extract keymaps from a pre-loaded array of graphs.
 * Pure function - useful for testing without disk I/O.
 */
export function extractKeymapsFromGraphs(
  graphs: Graph[],
): GraphSourcedKeymap[] {
  const keymaps: GraphSourcedKeymap[] = []

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      // Only look at action nodes with set-keymap type
      if (
        node.data.nodeType !== 'action' ||
        node.data.actionType !== 'set-keymap'
      ) {
        continue
      }

      const config = node.data.actionConfig

      // Canonical check: showInKeymaps is required to be true for visibility.
      // Legacy nodes without explicit showInKeymaps are not migrated.
      if (!config.showInKeymaps) {
        continue
      }

      keymaps.push({
        source: 'graph',
        graphId: graph.id,
        graphName: graph.name,
        nodeId: node.id,
        modes: config.modes,
        keySequence: config.keySequence,
        command: config.command,
        description: config.description,
        hasConnectedLogic: hasOnPressConnection(graph.edges, node.id),
      })
    }
  }

  return keymaps
}

/**
 * Check if a set-keymap node has its 'on-press' input port connected.
 * When connected, the command/RHS comes from upstream graph logic
 * rather than the static config field.
 */
function hasOnPressConnection(edges: GraphEdge[], nodeId: string): boolean {
  return edges.some(
    (edge) => edge.target === nodeId && edge.targetPort === 'on-press',
  )
}
