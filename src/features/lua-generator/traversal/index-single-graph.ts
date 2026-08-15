import type { Graph, GraphNode } from '@/shared/types'
import { isExecEdge } from './is-exec-edge'
import type { DataEdge, ExecEdge, IndexedGraph } from './types'

interface GraphIndexState {
  nodesById: Map<string, GraphNode>
  outgoingExec: Map<string, ExecEdge[]>
  incomingExec: Map<string, ExecEdge[]>
  outgoingData: Map<string, DataEdge[]>
  incomingData: Map<string, DataEdge[]>
  incomingDataByTargetPort: Map<string, Map<string, DataEdge[]>>
}

function createGraphIndexState(graph: Graph): GraphIndexState {
  const nodesById = new Map<string, GraphNode>()
  const outgoingExec = new Map<string, ExecEdge[]>()
  const incomingExec = new Map<string, ExecEdge[]>()
  const outgoingData = new Map<string, DataEdge[]>()
  const incomingData = new Map<string, DataEdge[]>()
  const incomingDataByTargetPort = new Map<string, Map<string, DataEdge[]>>()

  for (const node of graph.nodes) {
    nodesById.set(node.id, node)
    outgoingExec.set(node.id, [])
    incomingExec.set(node.id, [])
    outgoingData.set(node.id, [])
    incomingData.set(node.id, [])
    incomingDataByTargetPort.set(node.id, new Map())
  }

  return {
    nodesById,
    outgoingExec,
    incomingExec,
    outgoingData,
    incomingData,
    incomingDataByTargetPort,
  }
}

function indexExecEdge(state: GraphIndexState, execEdge: ExecEdge): void {
  const outList = state.outgoingExec.get(execEdge.sourceNodeId)
  if (outList) {
    outList.push(execEdge)
  }

  const inList = state.incomingExec.get(execEdge.targetNodeId)
  if (inList) {
    inList.push(execEdge)
  }
}

function indexDataEdge(state: GraphIndexState, dataEdge: DataEdge): void {
  const outList = state.outgoingData.get(dataEdge.sourceNodeId)
  if (outList) {
    outList.push(dataEdge)
  }

  const inList = state.incomingData.get(dataEdge.targetNodeId)
  if (inList) {
    inList.push(dataEdge)
  }

  const targetPortMap = state.incomingDataByTargetPort.get(
    dataEdge.targetNodeId,
  )
  if (targetPortMap) {
    let portEdges = targetPortMap.get(dataEdge.targetPortId)
    if (!portEdges) {
      portEdges = []
      targetPortMap.set(dataEdge.targetPortId, portEdges)
    }
    portEdges.push(dataEdge)
  }
}

function indexGraphEdge(
  state: GraphIndexState,
  edge: Graph['edges'][number],
): void {
  const sourceNode = state.nodesById.get(edge.source)
  if (!sourceNode) {
    return
  }

  if (isExecEdge(sourceNode, edge.sourcePort)) {
    indexExecEdge(state, {
      edgeId: edge.id,
      sourceNodeId: edge.source,
      sourcePortId: edge.sourcePort,
      targetNodeId: edge.target,
      targetPortId: edge.targetPort,
    })
    return
  }

  indexDataEdge(state, {
    edgeId: edge.id,
    sourceNodeId: edge.source,
    sourcePortId: edge.sourcePort,
    targetNodeId: edge.target,
    targetPortId: edge.targetPort,
  })
}

function collectEntryNodeIds(graph: Graph): string[] {
  const entries: string[] = []
  for (const node of graph.nodes) {
    if (
      node.data.nodeType === 'trigger' ||
      node.data.nodeType === 'callable-entry'
    ) {
      entries.push(node.id)
    }
  }
  return entries
}

export function indexSingleGraph(graph: Graph): IndexedGraph {
  const state = createGraphIndexState(graph)

  for (const edge of graph.edges) {
    indexGraphEdge(state, edge)
  }

  return {
    nodesById: state.nodesById,
    outgoingExecByNode: state.outgoingExec,
    incomingExecByNode: state.incomingExec,
    outgoingDataByNode: state.outgoingData,
    incomingDataByNode: state.incomingData,
    incomingDataByTargetPort: state.incomingDataByTargetPort,
    entries: collectEntryNodeIds(graph),
  }
}
