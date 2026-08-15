// ============================================
// Domain 2: Exec Flow Traversal
// Traverse execution flow graph and build compilation units
// ============================================

import type { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import {
  getGenerator,
  resolveGeneratorType,
} from '@/features/lua-generator/generators/nodes'
import {
  buildCallableKeyByGraphId,
  sanitizeLuaIdentifier,
} from '@/features/lua-generator/lua-utils'
import type { GenerationDiagnostic } from '@/features/lua-generator/types'
import {
  type LuaSerializable,
  serializeValue,
} from '@/features/lua-generator/utils/lua-serialize'
import type { GraphEdge, GraphNode } from '@/shared/types'
import { resolveDataDependencies } from './data-dependencies'
import type {
  CompilationUnit,
  ExecEdge,
  GraphIndexes,
  IndexedGraph,
  LuaValueRef,
  TraversalContext,
  TraversalGenerationContext,
} from './types'
import { generateVariableName, makeBindingKey } from './variable-naming'

/**
 * Traverse the execution flow starting from an entry node.
 * Uses DFS with cycle detection.
 *
 * @param entryNodeId - The entry node ID to start from
 * @param indexes - The indexed graph
 * @param context - Generation context
 * @param collector - Diagnostics collector
 * @returns Array of compilation units in execution order
 */
export function traverseExecFlow(
  entryNodeId: string,
  indexes: IndexedGraph,
  context: TraversalGenerationContext,
  collector: DiagnosticsCollector,
): CompilationUnit[] {
  const units: CompilationUnit[] = []
  const emittedNodeIds = new Set<string>()
  const visiting = new Set<string>()
  const valueBindings = new Map<string, LuaValueRef>()
  const usedTempNames = new Set<string>()
  let variableCounter = context.variableCounter

  const canonicalIndexes = buildCanonicalIndexes(
    context.currentGraphId,
    indexes,
  )
  const graphEdges =
    context.graphEdges ??
    collectGraphEdges(indexes.outgoingExecByNode, indexes.outgoingDataByNode)
  const graphName = context.graphName ?? context.currentGraphId
  const callableSymbolByGraphId =
    context.callableSymbolByGraphId ??
    buildCallableSymbolMap(context.graphContracts)
  const callableKeyByGraphId =
    context.callableKeyByGraphId ??
    buildCallableKeyByGraphId(
      [...context.graphContracts.entries()].map(([graphId, contract]) => ({
        graphId,
        graphName: contract.graphName,
      })),
    )

  const emitGenerationDiagnostic = (diagnostic: GenerationDiagnostic): void => {
    if (diagnostic.severity === 'error') {
      collector.addError({
        id: diagnostic.id,
        category: diagnostic.category,
        message: diagnostic.message,
        ...(diagnostic.details !== undefined && {
          details: diagnostic.details,
        }),
        ...(diagnostic.source !== undefined && { source: diagnostic.source }),
        ...(diagnostic.suggestions !== undefined && {
          suggestions: diagnostic.suggestions,
        }),
      })
      return
    }

    collector.addWarning({
      id: diagnostic.id,
      category: diagnostic.category,
      message: diagnostic.message,
      ...(diagnostic.details !== undefined && { details: diagnostic.details }),
      ...(diagnostic.source !== undefined && { source: diagnostic.source }),
      ...(diagnostic.suggestions !== undefined && {
        suggestions: diagnostic.suggestions,
      }),
    })
  }

  const getVariableName = (hint?: string): string => {
    variableCounter += 1
    const sanitizedHint = sanitizeLuaIdentifier(hint ?? 'var')
    return `_gen_${sanitizedHint}_${variableCounter}`
  }

  const toLuaLiteral = (value: unknown): string => {
    try {
      return serializeValue(value as LuaSerializable, { pretty: false })
    } catch {
      return 'nil'
    }
  }

  // Traversal context for tracking loop/conditional state
  // Currently reserved for future use when context-aware traversal is needed
  const _traversalContext: TraversalContext = {
    inLoop: false,
    loopStack: [],
    inConditional: false,
    conditionalStack: [],
  }
  // Mark as used to suppress TS warning - will be used in future enhancements
  void _traversalContext

  /**
   * Generate inline code for a node without pushing it to units[].
   *
   * This is used by renderExecFromPort so that branch/body nodes embedded
   * inside a condition or loop block are NOT double-emitted as standalone
   * CompilationUnits. Their code is embedded in the parent node's code.
   *
   * The node is marked as emitted so the outer traverse() control-flow
   * block will skip it when it tries to follow the same edges.
   *
   * Linear successors are also generated inline (recursively) because
   * the outer traverse() won't visit them after they are marked emitted.
   * Cycle detection uses the shared `visiting` set.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inline exec emission shares visiting/cycle state with outer traverse; splitting would duplicate traversal invariants
  function generateInlineCode(
    nodeId: string,
    currentIndentLevel: number,
  ): string[] {
    // Cycle guard
    if (visiting.has(nodeId)) {
      collector.addError({
        id: 'exec-cycle-detected',
        category: 'cycle',
        message: `Execution cycle detected involving node ${nodeId}`,
        source: { nodeId, nodeType: getNodeType(indexes, nodeId) },
        suggestions: ['Remove circular execution flow'],
      })
      return []
    }

    // Already handled (e.g. merge node reached from both branches)
    if (emittedNodeIds.has(nodeId)) {
      return []
    }

    const node = indexes.nodesById.get(nodeId)
    if (!node) {
      collector.addError({
        id: 'missing-node',
        category: 'structure',
        message: `Node ${nodeId} referenced but not found`,
        source: { nodeId },
      })
      return []
    }

    visiting.add(nodeId)
    emittedNodeIds.add(nodeId)

    // Resolve output bindings so downstream data consumers can read them
    const outputBindings = resolveOutputBindings(
      node,
      indexes,
      usedTempNames,
      collector,
    )

    let code: string[] = []

    if (context.enableNodeGeneration === true) {
      const dataResolution = resolveDataDependencies(
        nodeId,
        indexes,
        valueBindings,
        usedTempNames,
        collector,
      )

      const inputBindings = dataResolution?.bindings ?? {}
      for (const tempName of dataResolution?.newTempNames ?? []) {
        usedTempNames.add(tempName)
      }

      const generatorType = resolveGeneratorType(node)
      const generator = getGenerator(generatorType)

      if (generator !== undefined) {
        try {
          // Pre-seed valueBindings with output binding hints before calling
          // generator.generate(). This allows generators that call
          // renderExecFromPort internally (e.g. callable-entry) to have their
          // downstream body nodes see the correct upstream bindings.
          // After generation, overwrite with actual outputBindings if non-empty.
          for (const [portId, varName] of Object.entries(outputBindings)) {
            const key = makeBindingKey(nodeId, portId)
            if (!valueBindings.has(key)) {
              valueBindings.set(key, { kind: 'temp', name: varName })
            }
          }

          const generated = generator.generate(node, {
            indexes: canonicalIndexes,
            graphId: context.currentGraphId,
            graphName,
            nodeById: indexes.nodesById,
            edges: graphEdges,
            inputBindings,
            outputBindingHints: outputBindings,
            indentLevel: currentIndentLevel,
            renderExecFromPort: (sourceNodeId: string, sourcePortId: string) =>
              renderExecFromPort(
                sourceNodeId,
                sourcePortId,
                currentIndentLevel,
              ),
            sanitizeIdentifier: sanitizeLuaIdentifier,
            toLuaLiteral,
            emitDiagnostic: emitGenerationDiagnostic,
            callableSymbolByGraphId,
            callableKeyByGraphId,
            callableContracts: context.graphContracts,
            getVariableName,
          })

          code = generated.code

          // Register output bindings so downstream nodes can reference them
          const resolvedOutputBindings =
            Object.keys(generated.outputBindings).length > 0
              ? generated.outputBindings
              : outputBindings
          for (const [portId, varName] of Object.entries(
            resolvedOutputBindings,
          )) {
            const key = makeBindingKey(nodeId, portId)
            valueBindings.set(key, { kind: 'temp', name: varName })
          }
        } catch (error) {
          collector.addError({
            id: 'ERR_GENERATION_FAILED',
            category: 'runtime',
            message: `Failed to generate code for node: ${String(error)}`,
            source: {
              graphId: context.currentGraphId,
              nodeId: node.id,
              nodeType: node.data.nodeType,
            },
          })
        }
      } else {
        collector.addError({
          id: 'ERR_UNKNOWN_NODE_TYPE',
          category: 'config',
          message: `No generator registered for node type: ${generatorType}`,
          source: {
            graphId: context.currentGraphId,
            nodeId: node.id,
            nodeType: node.data.nodeType,
          },
        })
      }
    } else {
      // Topology-only mode: register output bindings without code
      for (const [portId, varName] of Object.entries(outputBindings)) {
        const key = makeBindingKey(nodeId, portId)
        valueBindings.set(key, { kind: 'temp', name: varName })
      }
    }

    // Follow continuations inline so the outer traverse() control-flow
    // block never has a chance to re-process these nodes.
    const nextNodes = getNextNodes(node, indexes, collector)

    if (node.data.nodeType === 'condition') {
      // Branches are handled by the condition generator via renderExecFromPort.
      // Only the merge point (post-branch continuation) needs inline handling here.
      const trueEdge = nextNodes.find((e) => e.sourcePortId === 'true')
      const falseEdge = nextNodes.find((e) => e.sourcePortId === 'false')

      const mergeNode = findMergePoint(
        trueEdge?.targetNodeId,
        falseEdge?.targetNodeId,
        indexes,
      )

      if (mergeNode) {
        code = [...code, ...generateInlineCode(mergeNode, currentIndentLevel)]
      }
    } else if (node.data.nodeType === 'loop') {
      // Loop body is handled by the loop generator via renderExecFromPort.
      // Only the complete/done continuation needs inline handling here.
      const completeEdge = nextNodes.find(
        (e) => e.sourcePortId === 'complete' || e.sourcePortId === 'done',
      )

      if (completeEdge) {
        code = [
          ...code,
          ...generateInlineCode(completeEdge.targetNodeId, currentIndentLevel),
        ]
      }
    } else {
      // Linear node: follow the primary continuation inline
      // Skip callback ports — those are handled by the node generator via renderExecFromPort
      const callbackPorts = getCallbackPorts(node)
      const nextEdge = nextNodes.find((e) => !callbackPorts.has(e.sourcePortId))
      if (nextEdge) {
        code = [
          ...code,
          ...generateInlineCode(nextEdge.targetNodeId, currentIndentLevel),
        ]
      }
    }

    visiting.delete(nodeId)
    return code
  }

  /**
   * Resolve the code for nodes connected to a specific exec port.
   * Used by node generators (condition, loop, trigger) to embed
   * downstream code directly in their generated output.
   *
   * Nodes traversed here are marked as emitted and will NOT be
   * separately pushed to units[] — preventing double emission.
   *
   * Lines are returned at indentLevel 0 so the calling generator's
   * LuaBuilder can embed them via inner.line() without double-indenting.
   * The parent generator's block() / inner.line() handles nesting.
   */
  function renderExecFromPort(
    sourceNodeId: string,
    sourcePortId: string,
    _currentIndentLevel: number,
  ): string[] {
    const outgoing = getExecEdgesFromPort(indexes, sourceNodeId, sourcePortId)

    if (outgoing.length === 0) {
      return []
    }

    const lines: string[] = []
    for (const edge of outgoing) {
      // Always generate at indent level 0 — the parent generator's LuaBuilder
      // applies its own indentation when it calls inner.line(line).
      lines.push(...generateInlineCode(edge.targetNodeId, 0))
    }
    return lines
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: DFS exec traversal with branch/cycle/data-edge handling must stay unified to preserve emission order and visiting semantics
  function traverse(nodeId: string, currentIndentLevel: number): void {
    // Check for cycle
    if (visiting.has(nodeId)) {
      collector.addError({
        id: 'exec-cycle-detected',
        category: 'cycle',
        message: `Execution cycle detected involving node ${nodeId}`,
        source: { nodeId, nodeType: getNodeType(indexes, nodeId) },
        suggestions: ['Remove circular execution flow'],
      })
      return
    }

    // Skip already emitted nodes (e.g. branch nodes handled inline by renderExecFromPort)
    if (emittedNodeIds.has(nodeId)) {
      return
    }

    const node = indexes.nodesById.get(nodeId)
    if (!node) {
      collector.addError({
        id: 'missing-node',
        category: 'structure',
        message: `Node ${nodeId} referenced but not found`,
        source: { nodeId },
      })
      return
    }

    visiting.add(nodeId)

    // Resolve output bindings for this node
    const outputBindings = resolveOutputBindings(
      node,
      indexes,
      usedTempNames,
      collector,
    )

    let unit: CompilationUnit
    if (context.enableNodeGeneration !== true) {
      unit = {
        nodeId,
        nodeType: node.data.nodeType,
        code: [],
        localVars: Object.values(outputBindings),
        inputBindings: {},
        outputBindings,
        indentLevel: currentIndentLevel,
      }
    } else {
      const dataResolution = resolveDataDependencies(
        nodeId,
        indexes,
        valueBindings,
        usedTempNames,
        collector,
      )

      const inputBindings = dataResolution?.bindings ?? {}
      for (const tempName of dataResolution?.newTempNames ?? []) {
        usedTempNames.add(tempName)
      }

      const generatorType = resolveGeneratorType(node)
      const generator = getGenerator(generatorType)

      if (generator === undefined) {
        collector.addError({
          id: 'ERR_UNKNOWN_NODE_TYPE',
          category: 'config',
          message: `No generator registered for node type: ${generatorType}`,
          source: {
            graphId: context.currentGraphId,
            nodeId: node.id,
            nodeType: node.data.nodeType,
          },
        })

        unit = {
          nodeId,
          nodeType: node.data.nodeType,
          code: [],
          localVars: Object.values(outputBindings),
          inputBindings,
          outputBindings,
          indentLevel: currentIndentLevel,
        }
      } else {
        try {
          // Pre-seed valueBindings with output binding hints before calling
          // generator.generate(). This allows generators that call
          // renderExecFromPort internally (e.g. callable-entry) to have their
          // downstream body nodes see the correct upstream bindings.
          // After generation, overwrite with actual outputBindings if non-empty.
          for (const [portId, varName] of Object.entries(outputBindings)) {
            const key = makeBindingKey(nodeId, portId)
            if (!valueBindings.has(key)) {
              valueBindings.set(key, { kind: 'temp', name: varName })
            }
          }

          const generated = generator.generate(node, {
            indexes: canonicalIndexes,
            graphId: context.currentGraphId,
            graphName,
            nodeById: indexes.nodesById,
            edges: graphEdges,
            inputBindings,
            outputBindingHints: outputBindings,
            indentLevel: currentIndentLevel,
            renderExecFromPort: (sourceNodeId: string, sourcePortId: string) =>
              renderExecFromPort(
                sourceNodeId,
                sourcePortId,
                currentIndentLevel,
              ),
            sanitizeIdentifier: sanitizeLuaIdentifier,
            toLuaLiteral,
            emitDiagnostic: emitGenerationDiagnostic,
            callableSymbolByGraphId,
            callableKeyByGraphId,
            callableContracts: context.graphContracts,
            getVariableName,
          })

          unit = {
            nodeId,
            nodeType: generated.nodeType,
            code: generated.code,
            localVars: generated.localVars,
            inputBindings,
            outputBindings:
              Object.keys(generated.outputBindings).length > 0
                ? generated.outputBindings
                : outputBindings,
            indentLevel: currentIndentLevel,
          }
        } catch (error) {
          collector.addError({
            id: 'ERR_GENERATION_FAILED',
            category: 'runtime',
            message: `Failed to generate code for node: ${String(error)}`,
            source: {
              graphId: context.currentGraphId,
              nodeId: node.id,
              nodeType: node.data.nodeType,
            },
          })

          unit = {
            nodeId,
            nodeType: node.data.nodeType,
            code: [],
            localVars: Object.values(outputBindings),
            inputBindings,
            outputBindings,
            indentLevel: currentIndentLevel,
          }
        }
      }
    }

    units.push(unit)
    emittedNodeIds.add(nodeId)

    // Store value bindings for this node's outputs
    for (const [portId, varName] of Object.entries(unit.outputBindings)) {
      const key = makeBindingKey(nodeId, portId)
      valueBindings.set(key, { kind: 'temp', name: varName })
    }

    // Handle node-specific control flow.
    // NOTE: In generation mode, branch/body nodes are already marked emitted
    // by generateInlineCode (called via renderExecFromPort inside the generator).
    // Those traverse() calls below will be no-ops due to the emittedNodeIds guard.
    // In topology mode (no generation), generators are not called so we still
    // need to traverse branches/continuations here to build the flat IR.
    const nextNodes = getNextNodes(node, indexes, collector)

    // Branch handling for condition nodes
    if (node.data.nodeType === 'condition') {
      // Process true branch
      const trueEdge = nextNodes.find((e) => e.sourcePortId === 'true')
      const falseEdge = nextNodes.find((e) => e.sourcePortId === 'false')

      if (trueEdge) {
        traverse(trueEdge.targetNodeId, currentIndentLevel + 1)
      }

      if (falseEdge) {
        traverse(falseEdge.targetNodeId, currentIndentLevel + 1)
      }

      // Find merge point (first common successor)
      const mergeNode = findMergePoint(
        trueEdge?.targetNodeId,
        falseEdge?.targetNodeId,
        indexes,
      )

      if (mergeNode) {
        traverse(mergeNode, currentIndentLevel)
      }
    } else if (node.data.nodeType === 'loop') {
      // Process loop body
      const bodyEdge = nextNodes.find(
        (e) => e.sourcePortId === 'body' || e.sourcePortId === 'loop',
      )
      const completeEdge = nextNodes.find(
        (e) => e.sourcePortId === 'complete' || e.sourcePortId === 'done',
      )

      if (bodyEdge) {
        traverse(bodyEdge.targetNodeId, currentIndentLevel + 1)
      }

      if (completeEdge) {
        traverse(completeEdge.targetNodeId, currentIndentLevel)
      }
    } else {
      // Linear flow - process next node
      // Skip callback ports — those are handled by the node generator via renderExecFromPort
      const callbackPorts = getCallbackPorts(node)
      const nextEdge = nextNodes.find((e) => !callbackPorts.has(e.sourcePortId))
      if (nextEdge) {
        traverse(nextEdge.targetNodeId, currentIndentLevel)
      }
    }

    visiting.delete(nodeId)
  }

  traverse(entryNodeId, context.indentLevel)

  return units
}

/**
 * Resolve output bindings for a node.
 * For each output port, generate a temp variable name.
 */
function resolveOutputBindings(
  node: GraphNode,
  indexes: IndexedGraph,
  usedTempNames: Set<string>,
  _collector: DiagnosticsCollector,
): Record<string, string> {
  const bindings: Record<string, string> = {}

  // Get outgoing data edges to determine which outputs are needed
  const outgoingData = indexes.outgoingDataByNode.get(node.id) ?? []

  // Group by source port
  const portsUsed = new Set<string>()
  for (const edge of outgoingData) {
    portsUsed.add(edge.sourcePortId)
  }

  // Generate temp names for each used output port
  for (const portId of portsUsed) {
    const varName = generateVariableName(node.id, portId, usedTempNames)
    usedTempNames.add(varName)
    bindings[portId] = varName
  }

  return bindings
}

/**
 * Ports that are callback/body ports — their execution chains are
 * rendered by the node generator via renderExecFromPort(), NOT followed
 * by the DFS traversal. These should not count as "ambiguous continuations".
 *
 * Only register node types that are handled by the generic linear-node else-branch
 * in the DFS. Do NOT add 'condition' or 'loop' here — those nodes have dedicated
 * special-case branches in the DFS that already handle their branching correctly.
 *
 * Key: `${nodeType}` or `${nodeType}:${actionType}` → Set of callback port IDs
 */
const CALLBACK_EXEC_PORTS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  // Create Autocmd callback is handled by create-autocmd generator
  ['action:create-autocmd', new Set(['on-event'])],
])

const EMPTY_SET: ReadonlySet<string> = new Set()

function getCallbackPorts(node: GraphNode): ReadonlySet<string> {
  // Check specific action type first
  if (node.data.nodeType === 'action') {
    const key = `action:${node.data.actionType}`
    const ports = CALLBACK_EXEC_PORTS.get(key)
    if (ports) return ports
  }
  // Check generic node type
  return CALLBACK_EXEC_PORTS.get(node.data.nodeType) ?? EMPTY_SET
}

/**
 * Get the next nodes to traverse based on outgoing exec edges.
 * Returns edges sorted deterministically.
 */
function getNextNodes(
  node: GraphNode,
  indexes: IndexedGraph,
  collector: DiagnosticsCollector,
): readonly ExecEdge[] {
  const outgoing = indexes.outgoingExecByNode.get(node.id) ?? []

  // Sort by edgeId for deterministic ordering
  const sorted = [...outgoing].sort((a, b) => a.edgeId.localeCompare(b.edgeId))

  // Separate callback ports (handled by node generators) from continuation ports
  const callbackPorts = getCallbackPorts(node)
  const continuations = sorted.filter((e) => !callbackPorts.has(e.sourcePortId))

  // Check for ambiguous continuations on non-branching nodes
  if (
    node.data.nodeType !== 'condition' &&
    node.data.nodeType !== 'loop' &&
    continuations.length > 1
  ) {
    collector.addWarning({
      id: 'ambiguous-exec-continuation',
      category: 'structure',
      message: `Node ${node.id} has multiple execution continuations`,
      details: `Found ${continuations.length} outgoing exec edges. Using first continuation.`,
      source: { nodeId: node.id, nodeType: node.data.nodeType },
      suggestions: ['Remove redundant execution edges'],
    })
  }

  return sorted // Still return ALL edges (generators need callback edges via renderExecFromPort)
}

/**
 * Find the merge point of two branches.
 * Returns the first common successor, or null if branches don't merge.
 */
function findMergePoint(
  trueBranchId: string | undefined,
  falseBranchId: string | undefined,
  indexes: IndexedGraph,
): string | null {
  if (!trueBranchId || !falseBranchId) {
    return null
  }

  // Use continuation-only reachability to exclude deferred callback paths
  const trueReachable = getAllReachableContinuations(trueBranchId, indexes)
  const falseReachable = getAllReachableContinuations(falseBranchId, indexes)

  // Find first common node (by insertion order in trueReachable)
  for (const nodeId of trueReachable) {
    if (falseReachable.has(nodeId)) {
      return nodeId
    }
  }

  return null
}

/**
 * Get all nodes reachable from a starting node via *continuation* exec edges only.
 * Callback ports (e.g. on-event) are excluded so that deferred callback bodies
 * are not mistaken for synchronous successors during merge-point detection.
 */
function getAllReachableContinuations(
  startId: string,
  indexes: IndexedGraph,
): Set<string> {
  const reachable = new Set<string>()
  const queue: string[] = [startId]

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId) continue
    if (reachable.has(nodeId)) continue

    reachable.add(nodeId)

    const node = indexes.nodesById.get(nodeId)
    const outgoing = indexes.outgoingExecByNode.get(nodeId) ?? []
    const callbackPorts = node ? getCallbackPorts(node) : EMPTY_SET

    for (const edge of outgoing) {
      if (
        !callbackPorts.has(edge.sourcePortId) &&
        !reachable.has(edge.targetNodeId)
      ) {
        queue.push(edge.targetNodeId)
      }
    }
  }

  return reachable
}

/**
 * Get all nodes reachable from a starting node via exec edges.
 */
function getAllReachable(startId: string, indexes: IndexedGraph): Set<string> {
  const reachable = new Set<string>()
  const queue: string[] = [startId]

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId) continue

    if (reachable.has(nodeId)) {
      continue
    }

    reachable.add(nodeId)

    const outgoing = indexes.outgoingExecByNode.get(nodeId) ?? []
    for (const edge of outgoing) {
      if (!reachable.has(edge.targetNodeId)) {
        queue.push(edge.targetNodeId)
      }
    }
  }

  return reachable
}

function getNodeType(indexes: IndexedGraph, nodeId: string): string {
  const node = indexes.nodesById.get(nodeId)
  return node?.data.nodeType ?? 'unknown'
}

function getExecEdgesFromPort(
  indexes: IndexedGraph,
  sourceNodeId: string,
  sourcePortId: string,
): readonly ExecEdge[] {
  const outgoing = indexes.outgoingExecByNode.get(sourceNodeId) ?? []
  return outgoing
    .filter((edge) => edge.sourcePortId === sourcePortId)
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
}

function collectGraphEdges(
  execByNode: ReadonlyMap<string, readonly ExecEdge[]>,
  dataByNode: ReadonlyMap<
    string,
    readonly {
      edgeId: string
      sourceNodeId: string
      sourcePortId: string
      targetNodeId: string
      targetPortId: string
    }[]
  >,
): GraphEdge[] {
  const byId = new Map<string, GraphEdge>()

  for (const edges of execByNode.values()) {
    for (const edge of edges) {
      byId.set(edge.edgeId, {
        id: edge.edgeId,
        source: edge.sourceNodeId,
        sourcePort: edge.sourcePortId,
        target: edge.targetNodeId,
        targetPort: edge.targetPortId,
      })
    }
  }

  for (const edges of dataByNode.values()) {
    for (const edge of edges) {
      byId.set(edge.edgeId, {
        id: edge.edgeId,
        source: edge.sourceNodeId,
        sourcePort: edge.sourcePortId,
        target: edge.targetNodeId,
        targetPort: edge.targetPortId,
      })
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function buildCallableSymbolMap(
  callableContracts: ReadonlyMap<string, unknown>,
): Map<string, string> {
  const symbols = new Map<string, string>()
  for (const graphId of callableContracts.keys()) {
    symbols.set(graphId, `_nvimset_${sanitizeLuaIdentifier(graphId)}`)
  }
  return symbols
}

function buildCanonicalIndexes(
  graphId: string,
  indexes: IndexedGraph,
): GraphIndexes {
  const nodes = [...indexes.nodesById.values()]
  const edges = collectGraphEdges(
    indexes.outgoingExecByNode,
    indexes.outgoingDataByNode,
  )

  const execEdges = new Map<string, GraphEdge[]>()
  for (const [nodeId, nodeEdges] of indexes.outgoingExecByNode) {
    execEdges.set(
      nodeId,
      nodeEdges.map((edge) => ({
        id: edge.edgeId,
        source: edge.sourceNodeId,
        sourcePort: edge.sourcePortId,
        target: edge.targetNodeId,
        targetPort: edge.targetPortId,
      })),
    )
  }

  const dataEdges = new Map<string, GraphEdge[]>()
  for (const [nodeId, nodeEdges] of indexes.outgoingDataByNode) {
    dataEdges.set(
      nodeId,
      nodeEdges.map((edge) => ({
        id: edge.edgeId,
        source: edge.sourceNodeId,
        sourcePort: edge.sourcePortId,
        target: edge.targetNodeId,
        targetPort: edge.targetPortId,
      })),
    )
  }

  return {
    nodesByGraph: new Map([[graphId, nodes]]),
    edgesByGraph: new Map([[graphId, edges]]),
    execEdges,
    dataEdges,
  }
}

/**
 * Find all unreachable nodes in a graph.
 * These are nodes not reachable from any entry point.
 */
export function findUnreachableNodes(
  indexes: IndexedGraph,
  collector: DiagnosticsCollector,
): readonly string[] {
  const reachable = new Set<string>()

  // BFS from all entry points
  for (const entryId of indexes.entries) {
    const entryReachable = getAllReachable(entryId, indexes)
    for (const nodeId of entryReachable) {
      reachable.add(nodeId)
    }
  }

  // Find unreachable nodes
  const unreachable: string[] = []
  for (const nodeId of indexes.nodesById.keys()) {
    if (!reachable.has(nodeId)) {
      unreachable.push(nodeId)

      collector.addWarning({
        id: 'unreachable-node',
        category: 'connectivity',
        message: `Node ${nodeId} is unreachable from any entry point`,
        source: { nodeId, nodeType: getNodeType(indexes, nodeId) },
        suggestions: ['Connect this node to the execution flow'],
      })
    }
  }

  return unreachable
}
