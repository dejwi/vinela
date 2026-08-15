// ============================================
// Diagnostics Types for Lua Code Generation
// ============================================

export type DiagnosticCategory =
  | 'structure'
  | 'connectivity'
  | 'config'
  | 'syntax'
  | 'reference'
  | 'cycle'
  | 'runtime'

export interface DiagnosticSource {
  graphId?: string
  /** Human-readable graph name, for display in error messages */
  graphName?: string
  nodeId?: string
  nodeType?: string
  portId?: string
}

export interface GenerationDiagnostic {
  id: string
  severity: 'error' | 'warning'
  category: DiagnosticCategory
  message: string
  details?: string
  source?: DiagnosticSource
  suggestions?: string[]
}

// ============================================
// Pre-Generation Context
// ============================================

import type { TargetNeovimSnapshot } from '@/features/lua-generator/lib/target-neovim'
import type {
  Graph,
  GraphCallableContract,
  GraphDisableState,
  GraphEdge,
  GraphNode,
  InstalledPlugin,
  ResolvedSchema,
} from '@/shared/types'

/**
 * Precomputed indices for validation context.
 * Built once per generation request to avoid O(V+E) recomputation.
 */
export interface PreGenerationContext {
  /** All graphs in the project */
  graphs: readonly Graph[]
  /** Graph lookup by ID */
  graphsById: ReadonlyMap<string, Graph>
  /** Nodes grouped by graph ID */
  nodesByGraph: ReadonlyMap<string, GraphNode[]>
  /** Edges grouped by graph ID */
  edgesByGraph: ReadonlyMap<string, GraphEdge[]>
  /** Disable states for all graphs */
  disableStates: ReadonlyMap<string, GraphDisableState>
  /** Callable contracts by graph ID */
  callableContracts: ReadonlyMap<string, GraphCallableContract>
  /** Installed plugins for config validation */
  installedPlugins: readonly InstalledPlugin[]
  /** Resolved schemas for plugin validation */
  schemas: readonly ResolvedSchema[]
  /** Request-scoped target Neovim snapshot from pre-flight */
  targetNeovim: TargetNeovimSnapshot
}

// ============================================
// Pre-Generation Check Interface
// ============================================

import type { DiagnosticsCollector } from './collector'

export interface PreGenerationCheck {
  readonly id: string
  run(ctx: PreGenerationContext, collector: DiagnosticsCollector): void
}

// ============================================
// Helper Types for Check Implementation
// ============================================

/**
 * Adjacency lists for graph traversal.
 */
export interface GraphAdjacencyLists {
  /** Exec flow edges (void data type connections) */
  execAdj: ReadonlyMap<string, string[]> // nodeId -> downstream nodeIds
  /** Data flow edges (non-void data type connections) */
  dataAdj: ReadonlyMap<string, string[]> // nodeId -> downstream nodeIds
  /** Reverse lookup: nodeId -> upstream nodeIds */
  reverseExecAdj: ReadonlyMap<string, string[]>
  /** Reverse lookup: nodeId -> upstream nodeIds */
  reverseDataAdj: ReadonlyMap<string, string[]>
}

/**
 * Port connection state for a node.
 */
export interface PortConnectionState {
  nodeId: string
  portId: string
  /** Whether this port has an inbound edge */
  hasInboundEdge: boolean
  /** Source node ID if connected */
  sourceNodeId?: string | undefined
  /** Source port ID if connected */
  sourcePortId?: string | undefined
}
