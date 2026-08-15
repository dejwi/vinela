// ============================================
// Check 2: Missing Required Ports
// ============================================

import type { GraphEdge, GraphNode, PortDataType } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for missing required ports.
 */
export const MISSING_REQUIRED_PORTS_CHECK_ID = 'check-missing-required-ports'

/**
 * Information about a port's required status.
 */
interface PortRequirement {
  nodeId: string
  portId: string
  portLabel: string
  dataType: PortDataType
  required: boolean
}

/**
 * Get required ports for a node based on its type and configuration.
 * This determines what inputs are required for the node to function.
 */
function getRequiredPorts(node: GraphNode): PortRequirement[] {
  const requirements: PortRequirement[] = []

  switch (node.data.nodeType) {
    case 'action': {
      // All action nodes have inline configuration, no dynamic required ports
      break
    }

    case 'condition': {
      const conditionData = node.data
      // Condition nodes require at least one input (a or b) to be connected
      // or have hardcoded values
      const hasHardcodedA = conditionData.hardcodedA.trim().length > 0
      const hasHardcodedB = conditionData.hardcodedB.trim().length > 0

      if (!hasHardcodedA) {
        requirements.push({
          nodeId: node.id,
          portId: 'a',
          portLabel: 'A',
          dataType: 'any',
          required: true,
        })
      }
      if (!hasHardcodedB) {
        requirements.push({
          nodeId: node.id,
          portId: 'b',
          portLabel: 'B',
          dataType: 'any',
          required: true,
        })
      }
      break
    }

    case 'loop': {
      // Loop nodes require iterable input
      requirements.push({
        nodeId: node.id,
        portId: 'iterable',
        portLabel: 'Iterable',
        dataType: 'table',
        required: true,
      })
      break
    }

    case 'code-block': {
      // Code block inputs are defined by the user in the inputs array
      const codeBlockData = node.data
      for (const input of codeBlockData.inputs) {
        requirements.push({
          nodeId: node.id,
          portId: input.id,
          portLabel: input.name,
          dataType: input.dataType,
          required: true, // All user-defined inputs are required
        })
      }
      break
    }

    case 'graph-ref': {
      // Graph-ref inputs come from the target graph's callable-entry parameters
      const refData = node.data
      if (refData.cachedContract?.parameters) {
        for (const param of refData.cachedContract.parameters) {
          requirements.push({
            nodeId: node.id,
            portId: param.id,
            portLabel: param.name,
            dataType: param.dataType,
            required: true,
          })
        }
      }
      break
    }

    case 'run-function': {
      // Run-function required params come from the function signature
      const runFnData = node.data
      const signature = runFnData.signature
      if (signature?.params) {
        for (const param of signature.params) {
          // Check if param has a default value
          const hasDefault =
            runFnData.paramDefaults[param.name] !== undefined &&
            runFnData.paramDefaults[param.name] !== null

          // param.optional is inverse of required
          const isRequired = !(param.optional ?? false)

          if (isRequired && !hasDefault) {
            requirements.push({
              nodeId: node.id,
              portId: `param:${param.name}`,
              portLabel: param.name,
              dataType: param.type as PortDataType,
              required: true,
            })
          }
        }
      }
      break
    }

    case 'builtin':
      // Built-in nodes typically don't have dynamic required ports
      break

    case 'return':
      // Return nodes define outputs, not inputs
      break

    case 'trigger':
    case 'callable-entry':
      // Entry nodes don't have required inputs
      break
  }

  return requirements
}

/**
 * Build a map of which ports have inbound edges.
 */
function buildInboundPortMap(
  edges: readonly GraphEdge[],
): Map<string, Set<string>> {
  const inbound = new Map<string, Set<string>>() // nodeId -> Set<portId>

  for (const edge of edges) {
    const nodePorts = inbound.get(edge.target)
    if (nodePorts === undefined) {
      inbound.set(edge.target, new Set([edge.targetPort]))
    } else {
      nodePorts.add(edge.targetPort)
    }
  }

  return inbound
}

/**
 * Check for missing required ports in effectively enabled graphs.
 *
 * A required port is considered satisfied if:
 * 1. It has an inbound edge
 * 2. It has a valid inline fallback value (node-specific)
 *
 * Complexity: O(N * P + E) where N = nodes, P = ports per node, E = edges
 */
export function checkMissingRequiredPorts(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    // Skip disabled graphs
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    const nodes = graph.nodes
    if (nodes.length === 0) {
      continue
    }

    const edges = graph.edges
    const inboundPortMap = buildInboundPortMap(edges)

    for (const node of nodes) {
      // Skip entry nodes (they don't have required inputs)
      if (
        node.data.nodeType === 'trigger' ||
        node.data.nodeType === 'callable-entry'
      ) {
        continue
      }

      const requiredPorts = getRequiredPorts(node)
      const connectedPorts = inboundPortMap.get(node.id) ?? new Set()

      for (const portReq of requiredPorts) {
        // Check if port has inbound edge
        if (connectedPorts.has(portReq.portId)) {
          continue
        }

        // Port is required but has no inbound edge
        // Get node display name
        const displayName =
          'displayName' in node.data
            ? (node.data.displayName as string | undefined)
            : undefined
        const nodeName = displayName?.trim() || node.id.slice(0, 8)

        collector.addError({
          id: 'ERR_CONNECTIVITY_MISSING_PORT',
          category: 'connectivity',
          message: `Node "${nodeName}" is missing required input "${portReq.portLabel}"`,
          details: `The ${portReq.dataType} input port "${portReq.portLabel}" must be connected to a data source.`,
          source: {
            graphId: graph.id,
            graphName: graph.name,
            nodeId: node.id,
            nodeType: node.data.nodeType,
            portId: portReq.portId,
          },
          suggestions: [
            `Connect a ${portReq.dataType} value to the "${portReq.portLabel}" port`,
            'Provide an inline default value if available for this node type',
          ],
        })
      }
    }
  }
}
