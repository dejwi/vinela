import { useGraphEditorStore } from '../store'

/**
 * Check if a specific input port on a node has an incoming connection.
 * Returns true if any edge targets the given node+port combination.
 */
export function useIsPortConnected(nodeId: string, portId: string): boolean {
  return useGraphEditorStore((state) => {
    if (!state.graph) return false
    return state.graph.edges.some(
      (edge) => edge.target === nodeId && edge.targetPort === portId,
    )
  })
}

/**
 * Check if a specific output port on a node has an outgoing connection.
 * Returns true if any edge sources from the given node+port combination.
 */
export function useIsOutputPortConnected(
  nodeId: string,
  portId: string,
): boolean {
  return useGraphEditorStore((state) => {
    if (!state.graph) return false
    return state.graph.edges.some(
      (edge) => edge.source === nodeId && edge.sourcePort === portId,
    )
  })
}
