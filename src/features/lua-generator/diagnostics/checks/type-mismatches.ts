// ============================================
// Check 4: Type Mismatches
// ============================================

import type { Graph, GraphNode, PortDataType } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'
import { getPortDataType } from './port-data-type'

/**
 * Check ID constant for type mismatches.
 */
export const TYPE_MISMATCHES_CHECK_ID = 'check-type-mismatches'

/**
 * Check if two data types are compatible for connection.
 */
function areTypesCompatible(
  sourceType: PortDataType,
  targetType: PortDataType,
): boolean {
  // void -> non-void is invalid (exec can't connect to data)
  if (sourceType === 'void' && targetType !== 'void') {
    return false
  }

  // non-void -> void is invalid (data can't connect to exec)
  if (sourceType !== 'void' && targetType === 'void') {
    return false
  }

  // Same type is always compatible
  if (sourceType === targetType) {
    return true
  }

  // any is compatible with anything (both directions)
  if (sourceType === 'any' || targetType === 'any') {
    return true
  }

  // Specific type mappings
  // table is compatible with any (loose typing for Lua tables)
  if (sourceType === 'table' || targetType === 'table') {
    return true
  }

  // buffer/window are special types, treat as compatible with any
  if (
    ['buffer', 'window'].includes(sourceType) ||
    ['buffer', 'window'].includes(targetType)
  ) {
    return true
  }

  // Everything else is incompatible
  return false
}

/**
 * Get a display label for a data type.
 */
function getTypeLabel(type: PortDataType): string {
  return type
}

/**
 * Build source-target type mappings for all edges in a graph.
 */
function buildEdgeTypeMappings(graph: Graph): Array<{
  edgeId: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  sourceType: PortDataType | undefined
  targetType: PortDataType | undefined
}> {
  const mappings: Array<{
    edgeId: string
    sourceNodeId: string
    sourcePortId: string
    targetNodeId: string
    targetPortId: string
    sourceType: PortDataType | undefined
    targetType: PortDataType | undefined
  }> = []

  const nodeMap = new Map<string, GraphNode>()
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node)
  }

  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (!sourceNode || !targetNode) {
      continue // Missing nodes will be caught by other checks
    }

    const sourceType = getPortDataType(sourceNode, edge.sourcePort, true)
    const targetType = getPortDataType(targetNode, edge.targetPort, false)

    mappings.push({
      edgeId: edge.id,
      sourceNodeId: edge.source,
      sourcePortId: edge.sourcePort,
      targetNodeId: edge.target,
      targetPortId: edge.targetPort,
      sourceType,
      targetType,
    })
  }

  return mappings
}

/**
 * Check for type mismatches in data edge connections.
 *
 * - Checks that data edges connect compatible types
 * - Port data types: string, number, boolean, table, any
 * - Warns on 'any' connections
 * - Errors on incompatible types (e.g., string -> number)
 *
 * Complexity: O(E) per graph
 */
export function checkTypeMismatches(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    // Skip disabled graphs
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    if (graph.nodes.length === 0 || graph.edges.length === 0) {
      continue
    }

    const typeMappings = buildEdgeTypeMappings(graph)

    for (const mapping of typeMappings) {
      const {
        sourceNodeId,
        sourcePortId,
        targetPortId,
        sourceType,
        targetType,
      } = mapping

      // Skip if we can't determine types (other checks handle unknown ports)
      if (sourceType === undefined || targetType === undefined) {
        continue
      }

      // Check for 'any' connections (warning)
      if (sourceType === 'any' || targetType === 'any') {
        // Only warn if specifically connecting to/from 'any' when the other side is specific
        if (sourceType !== targetType) {
          collector.addWarning({
            id: 'WARN_TYPE_ANY_CONNECTION',
            category: 'reference',
            message: `Connection uses 'any' type - type safety reduced`,
            details: `Edge from port "${sourcePortId}" (${getTypeLabel(sourceType)}) to port "${targetPortId}" (${getTypeLabel(targetType)}) uses loose typing. Consider specifying explicit types.`,
            source: {
              graphId: graph.id,
              graphName: graph.name,
              nodeId: sourceNodeId,
              portId: sourcePortId,
            },
            suggestions: [
              'Specify explicit data types for code block ports',
              'Use specific types (string, number, boolean, table) instead of any',
            ],
          })
        }
        continue
      }

      // Check compatibility
      if (!areTypesCompatible(sourceType, targetType)) {
        collector.addError({
          id: 'ERR_TYPE_MISMATCH',
          category: 'reference',
          message: `Cannot connect ${getTypeLabel(sourceType)} to ${getTypeLabel(targetType)}`,
          details: `Type mismatch: output port "${sourcePortId}" produces ${getTypeLabel(sourceType)} but input port "${targetPortId}" expects ${getTypeLabel(targetType)}.`,
          source: {
            graphId: graph.id,
            graphName: graph.name,
            nodeId: sourceNodeId,
            portId: sourcePortId,
          },
          suggestions: [
            `Change source to output ${getTypeLabel(targetType)}`,
            `Change target to accept ${getTypeLabel(sourceType)}`,
            'Use a code block to convert between types',
          ],
        })
      }
    }
  }
}
