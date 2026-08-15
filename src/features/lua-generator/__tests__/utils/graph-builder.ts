/**
 * Graph Builder Utility
 *
 * Fluent DSL for building test graphs with type-safe node creation
 * and connection management.
 */

import type {
  ActionConfig,
  ActionNodeData,
  BuiltinNodeData,
  CallableEntryNodeData,
  CallablePort,
  CodeBlockNodeData,
  ConditionNodeData,
  ConditionOperator,
  CoreActionType,
  Graph,
  GraphEdge,
  GraphNode,
  GraphRefNodeData,
  GraphViewport,
  LoopNodeData,
  NodeData,
  PortDataType,
  ReturnNodeData,
  RunFunctionNodeData,
  TriggerNodeData,
} from '@/shared/types'
import type {
  RunFunctionDefaultValue,
  RunFunctionSignatureSnapshot,
} from '@/shared/types/run-function'

export class GraphBuilder {
  private graphId: string
  private graphName: string
  private nodes: GraphNode[] = []
  private edges: GraphEdge[] = []
  private viewport: GraphViewport = { x: 0, y: 0, zoom: 1 }
  private createdAt: number
  private enabled = true
  private order = 0
  private description: string | undefined = undefined

  constructor(name: string, id?: string) {
    this.graphName = name
    this.graphId = id ?? generateId()
    this.createdAt = Date.now()
  }

  // ============================================
  // Node Creation Methods
  // ============================================

  /**
   * Add a startup trigger node.
   */
  startupTrigger(id: string, displayName?: string): this {
    const data: TriggerNodeData = {
      nodeType: 'trigger',
      displayName: displayName ?? 'On Startup',
      triggerType: 'startup',
    }
    this.addNode(id, 'trigger', data)
    return this
  }

  /**
   * Add a callable entry node.
   */
  callableEntry(
    id: string,
    parameters: CallablePort[] = [],
    displayName?: string,
  ): this {
    const data: CallableEntryNodeData = {
      nodeType: 'callable-entry',
      displayName: displayName ?? 'Callable Entry',
      parameters,
    }
    this.addNode(id, 'callable-entry', data)
    return this
  }

  /**
   * Add a return node.
   */
  returnNode(
    id: string,
    returnValues: CallablePort[] = [],
    displayName?: string,
  ): this {
    const data: ReturnNodeData = {
      nodeType: 'return',
      displayName: displayName ?? 'Return',
      returnValues,
    }
    this.addNode(id, 'return', data)
    return this
  }

  /**
   * Add an action node.
   */
  action<T extends CoreActionType>(
    id: string,
    actionType: T,
    actionConfig: ActionConfig,
    displayName?: string,
  ): this {
    const data: ActionNodeData = {
      nodeType: 'action',
      displayName: displayName ?? actionConfig.actionConfigType,
      label: actionConfig.actionConfigType,
      actionType,
      actionConfig,
    } as ActionNodeData
    this.addNode(id, 'action', data)
    return this
  }

  /**
   * Add a condition node.
   */
  condition(
    id: string,
    operator: ConditionOperator,
    hardcodedA: string,
    hardcodedB: string,
    displayName?: string,
  ): this {
    const data: ConditionNodeData = {
      nodeType: 'condition',
      displayName: displayName ?? 'Condition',
      operator,
      hardcodedA,
      hardcodedB,
    }
    this.addNode(id, 'condition', data)
    return this
  }

  /**
   * Add a loop node.
   */
  loop(
    id: string,
    loopType: 'for' | 'while' | 'each',
    iteratorVariable: string,
    iterableExpression: string,
    displayName?: string,
  ): this {
    const data: LoopNodeData = {
      nodeType: 'loop',
      displayName: displayName ?? `${loopType} Loop`,
      loopType,
      iteratorVariable,
      iterableExpression,
    }
    this.addNode(id, 'loop', data)
    return this
  }

  /**
   * Add a code block node.
   */
  codeBlock(
    id: string,
    code: string,
    inputs: { id: string; name: string; dataType: PortDataType }[] = [],
    outputs: { id: string; name: string; dataType: PortDataType }[] = [],
    displayName?: string,
  ): this {
    const data: CodeBlockNodeData = {
      nodeType: 'code-block',
      displayName: displayName ?? 'Code Block',
      code,
      inputs: inputs.map((p) => ({ ...p })),
      outputs: outputs.map((p) => ({ ...p })),
    }
    this.addNode(id, 'code-block', data)
    return this
  }

  /**
   * Add a graph reference node.
   */
  graphRef(id: string, referencedGraphId: string, displayName?: string): this {
    const data: GraphRefNodeData = {
      nodeType: 'graph-ref',
      displayName: displayName ?? 'Call Graph',
      referencedGraphId,
    }
    this.addNode(id, 'graph-ref', data)
    return this
  }

  /**
   * Add a run function node.
   */
  runFunction(
    id: string,
    selectedFunctionKey: string,
    functionSource: RunFunctionNodeData['functionSource'],
    displayName?: string,
  ): this {
    const data: RunFunctionNodeData = {
      nodeType: 'run-function',
      displayName: displayName ?? 'Run Function',
      selectedFunctionKey,
      functionSource,
      signature: null,
      paramDefaults: {},
    }
    this.addNode(id, 'run-function', data)
    return this
  }

  /**
   * Add a builtin node.
   */
  builtin(
    id: string,
    builtinId: string,
    config: Record<string, unknown> = {},
    displayName?: string,
  ): this {
    const data: BuiltinNodeData = {
      nodeType: 'builtin',
      displayName: displayName ?? builtinId,
      builtinId,
      config,
    }
    this.addNode(id, 'builtin', data)
    return this
  }

  // ============================================
  // Connection Methods
  // ============================================

  /**
   * Connect two nodes (execution flow).
   * Default ports are used for execution flow.
   * @param edgeId - Optional explicit edge ID (test-only override for order-sensitive tests)
   */
  connect(
    sourceId: string,
    targetId: string,
    sourcePort = 'out',
    targetPort = 'in',
    edgeId?: string,
  ): this {
    const edge: GraphEdge = {
      id: edgeId ?? `edge-${sourceId}-${targetId}-${this.edges.length}`,
      source: sourceId,
      sourcePort,
      target: targetId,
      targetPort,
    }
    this.edges.push(edge)
    return this
  }

  /**
   * Connect nodes for data flow.
   */
  connectData(
    sourceId: string,
    sourcePort: string,
    targetId: string,
    targetPort: string,
  ): this {
    return this.connect(sourceId, targetId, sourcePort, targetPort)
  }

  /**
   * Connect execution flow (convenience method).
   * Automatically selects the correct source port based on the source node type:
   * - trigger / callable-entry → 'exec'
   * - action / loop / code-block / graph-ref / run-function / builtin → 'done'
   * - condition → 'true' (use connectTrue/connectFalse for conditional branching)
   */
  connectExec(sourceId: string, targetId: string): this {
    const sourceNode = this.nodes.find((n) => n.id === sourceId)
    let sourcePort = 'exec'
    if (sourceNode) {
      const nodeType = sourceNode.data.nodeType
      if (
        nodeType === 'action' ||
        nodeType === 'code-block' ||
        nodeType === 'graph-ref' ||
        nodeType === 'run-function' ||
        nodeType === 'builtin'
      ) {
        sourcePort = 'done'
      }
      // trigger and callable-entry use 'exec'
      // loop uses 'exec' here as a generic continuation (less common — prefer connectLoopBody/connectLoopComplete)
    }
    return this.connect(sourceId, targetId, sourcePort, 'exec')
  }

  /**
   * Connect condition true branch.
   */
  connectTrue(conditionId: string, targetId: string): this {
    return this.connect(conditionId, targetId, 'true', 'exec')
  }

  /**
   * Connect condition false branch.
   */
  connectFalse(conditionId: string, targetId: string): this {
    return this.connect(conditionId, targetId, 'false', 'exec')
  }

  /**
   * Connect loop body.
   * Uses the UI port ID 'loop' (matches LoopNode's 'Loop Body' output port).
   */
  connectLoopBody(loopId: string, targetId: string): this {
    return this.connect(loopId, targetId, 'loop', 'exec')
  }

  /**
   * Connect loop completion (after loop finishes).
   * Uses the UI port ID 'done' (matches LoopNode's 'Completed' output port).
   */
  connectLoopComplete(loopId: string, targetId: string): this {
    return this.connect(loopId, targetId, 'done', 'exec')
  }

  /**
   * Connect an autocmd node's on-event output to another node's exec input.
   * Convenience wrapper: `connect(autocmdId, targetId, 'on-event', 'exec')`.
   *
   * @param autocmdId - ID of the create-autocmd action node
   * @param targetId  - ID of the node that receives the event trigger
   */
  connectOnEvent(autocmdId: string, targetId: string): this {
    return this.connect(autocmdId, targetId, 'on-event', 'exec')
  }

  /**
   * Add a run-function node with a fully-populated signature snapshot and
   * optional parameter defaults.
   *
   * Unlike `runFunction()`, which leaves `signature` as `null` (useful for
   * testing missing-signature diagnostics), this method sets `signature` to
   * a real snapshot. Use this when integration tests need to exercise actual
   * run-function code generation.
   *
   * @param id                 - Node ID
   * @param selectedFunctionKey - The function key (e.g. 'vim.fn.expand')
   * @param functionSource      - Source descriptor (core or plugin)
   * @param signature           - Full signature snapshot
   * @param paramDefaults       - Optional per-parameter default values
   * @param displayName         - Optional display name (defaults to 'Run Function')
   */
  runFunctionWithSignature(
    id: string,
    selectedFunctionKey: string,
    functionSource: RunFunctionNodeData['functionSource'],
    signature: RunFunctionSignatureSnapshot,
    paramDefaults?: Record<string, RunFunctionDefaultValue>,
    displayName?: string,
  ): this {
    const data: RunFunctionNodeData = {
      nodeType: 'run-function',
      displayName: displayName ?? 'Run Function',
      selectedFunctionKey,
      functionSource,
      signature,
      paramDefaults: paramDefaults ?? {},
    }
    this.addNode(id, 'run-function', data)
    return this
  }

  // ============================================
  // Graph Metadata
  // ============================================

  withDescription(description: string): this {
    this.description = description
    return this
  }

  withEnabled(enabled: boolean): this {
    this.enabled = enabled
    return this
  }

  withOrder(order: number): this {
    this.order = order
    return this
  }

  withViewport(viewport: GraphViewport): this {
    this.viewport = viewport
    return this
  }

  // ============================================
  // Build
  // ============================================

  build(): Graph {
    return {
      id: this.graphId,
      name: this.graphName,
      description: this.description,
      nodes: [...this.nodes],
      edges: [...this.edges],
      viewport: this.viewport,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      enabled: this.enabled,
      order: this.order,
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private addNode(id: string, type: GraphNode['type'], data: NodeData): void {
    const node: GraphNode = {
      id,
      type,
      definitionId: `${type}-${id}`,
      position: { x: 0, y: 0 },
      data,
    }
    this.nodes.push(node)
  }
}

/**
 * Generate a simple unique ID.
 */
function generateId(): string {
  return `graph-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create a simple callable port.
 */
export function createCallablePort(
  id: string,
  name: string,
  dataType: PortDataType = 'any',
  description?: string | undefined,
): CallablePort {
  const port: CallablePort = {
    id,
    name,
    dataType,
  }
  if (description !== undefined) {
    port.description = description
  }
  return port
}
