// ============================================
// Domain 2: Graph Traversal Types
// Compilation units and traversal state for Lua code generation
// ============================================

import type { GenerationDiagnostic } from '@/features/lua-generator/diagnostics/types'
import type {
  CallableContract,
  CompilationUnit,
  GenerationContext,
  GraphIndexes,
} from '@/features/lua-generator/types'
import type { GraphEdge, GraphNode } from '@/shared/types'

// ============================================
// Compilation Unit (IR)
// ============================================
export type {
  CallableContract,
  CompilationUnit,
  GenerationContext,
  GraphIndexes,
}

// ============================================
// Value References
// ============================================

export type LuaValueRef =
  | { readonly kind: 'literal'; readonly lua: string }
  | { readonly kind: 'temp'; readonly name: string }
  | { readonly kind: 'param'; readonly name: string }

export interface NodeOutputRef {
  readonly nodeId: string
  readonly portId: string
}

// ============================================
// Traversal Context
// ============================================

export interface TraversalContext {
  readonly inLoop: boolean
  readonly loopStack: readonly string[]
  readonly inConditional: boolean
  readonly conditionalStack: readonly string[]
  readonly parentConditionNodeId?: string | undefined
}

export interface TraversalGenerationContext {
  readonly currentGraphId: string
  readonly graphName?: string
  readonly graphEdges?: readonly GraphEdge[]
  readonly enableNodeGeneration?: boolean
  readonly indentLevel: number
  readonly variableCounter: number
  readonly graphContracts: ReadonlyMap<string, CallableContract>
  readonly callableSymbolByGraphId?: ReadonlyMap<string, string>
  readonly callableKeyByGraphId?: ReadonlyMap<string, string>
}

// ============================================
// Graph Indexes
// ============================================

export interface ExecEdge {
  readonly edgeId: string
  readonly sourceNodeId: string
  readonly sourcePortId: string
  readonly targetNodeId: string
  readonly targetPortId: string
}

export interface DataEdge {
  readonly edgeId: string
  readonly sourceNodeId: string
  readonly sourcePortId: string
  readonly targetNodeId: string
  readonly targetPortId: string
}

export interface IndexedGraph {
  readonly nodesById: ReadonlyMap<string, GraphNode>
  readonly outgoingExecByNode: ReadonlyMap<string, readonly ExecEdge[]>
  readonly incomingExecByNode: ReadonlyMap<string, readonly ExecEdge[]>
  readonly outgoingDataByNode: ReadonlyMap<string, readonly DataEdge[]>
  readonly incomingDataByNode: ReadonlyMap<string, readonly DataEdge[]>
  readonly incomingDataByTargetPort: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly DataEdge[]>
  >
  readonly entries: readonly string[]
}

export interface TraversalGraphIndexes {
  readonly byGraph: ReadonlyMap<string, IndexedGraph>
  readonly allNodes: ReadonlyMap<string, GraphNode>
}

// ============================================
// Traversal State
// ============================================

export interface TraversalState {
  readonly graphId: string
  readonly units: CompilationUnit[]
  readonly diagnostics: GenerationDiagnostic[]
  readonly emittedNodeIds: Set<string>
  readonly visitingExec: Set<string>
  readonly visitingData: Set<string>
  readonly valueBindings: Map<string, LuaValueRef> // key: `${nodeId}:${portId}`
  readonly usedTempNames: Set<string>
  readonly contextStack: TraversalContext[]
}

// ============================================
// Topological Sort Result
// ============================================

export type TopologicalSortResult =
  | { readonly success: true; readonly ordered: readonly NodeOutputRef[] }
  | { readonly success: false; readonly cycle: readonly NodeOutputRef[] }

// ============================================
// Cycle Detection
// ============================================

export interface CycleDetectionResult {
  readonly hasCycle: boolean
  readonly cycles: readonly string[][] // Each cycle is array of node IDs
}

// ============================================
// Compile Options
// ============================================

export type CompileMode = 'startup' | 'callable'

export interface CompileGraphOptions {
  readonly mode: CompileMode
}

export interface GraphCompilationPlan {
  readonly graphId: string
  readonly units: readonly CompilationUnit[]
  readonly diagnostics: readonly GenerationDiagnostic[]
}

// ============================================
// Port Classification
// ============================================

/**
 * Determine if an edge is an execution edge (void data type) or data edge.
 * This is a helper that should be used during graph indexing.
 */
export function isExecEdgeByPortType(sourcePortDataType: string): boolean {
  return sourcePortDataType === 'void'
}
