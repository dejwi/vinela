// ============================================
// Domain 2: Graph Traversal & Topological Sort
// Main entry point for the traversal module
// ============================================

export * from './cycle-detection'
export * from './data-dependencies'
export * from './exec-traversal'
export * from './indexes'
// Re-export core types for convenience
export type {
  CallableContract,
  CompilationUnit,
  CompileGraphOptions,
  CompileMode,
  CycleDetectionResult,
  DataEdge,
  ExecEdge,
  GenerationContext,
  GraphCompilationPlan,
  GraphIndexes,
  IndexedGraph,
  LuaValueRef,
  NodeOutputRef,
  TopologicalSortResult,
  TraversalContext,
  TraversalGenerationContext,
  TraversalGraphIndexes,
  TraversalState,
} from './types'
export * from './types'
export * from './variable-naming'
