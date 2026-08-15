import type { GraphNode } from '@/shared/types'

/**
 * Determine if an edge from a node's port is an execution edge.
 * This uses heuristics since we don't have full port contracts here.
 */
export function isExecEdge(node: GraphNode, portId: string): boolean {
  switch (node.data.nodeType) {
    case 'trigger':
      return portId === 'exec'

    case 'callable-entry':
      return portId === 'exec'

    case 'action':
      return portId === 'done' || portId === 'on-event'

    case 'condition':
      return portId === 'true' || portId === 'false' || portId === 'done'

    case 'loop':
      return portId === 'loop' || portId === 'done' || portId === 'complete'

    case 'code-block': {
      const data = node.data
      const hasDataOutput =
        data.nodeType === 'code-block' &&
        data.outputs.some((port) => port.id === portId)
      if (hasDataOutput) {
        return false
      }
      return portId === 'done'
    }

    case 'graph-ref':
      return portId === 'done'

    case 'run-function':
      return portId === 'done'

    case 'builtin':
      return portId === 'done'

    case 'return':
      return false

    default:
      return portId === 'exec' || portId === 'done'
  }
}
