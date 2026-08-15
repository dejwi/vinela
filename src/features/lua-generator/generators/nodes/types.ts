// src/features/lua-generator/generators/nodes/types.ts
// Node generator types and interfaces for Domain 3

import type { GenerationDiagnostic } from '@/features/lua-generator/diagnostics/types'
import { formatCallableId } from '@/features/lua-generator/lua-utils'
import type {
  CallableContract,
  CompilationUnit,
  GraphIndexes,
} from '@/features/lua-generator/types'
import type { Graph, GraphEdge, GraphNode, NodeData } from '@/shared/types'

export type {
  CallableContract,
  CompilationUnit,
  GenerationContext as CanonicalGenerationContext,
  GraphIndexes,
} from '@/features/lua-generator/types'

// ============================================
// Generation Context
// ============================================

/**
 * Context passed to node generators during code generation.
 * Provides access to graph structure, binding resolution, and utilities.
 */
export interface GenerationContext {
  /** Canonical graph/index contracts used by orchestrator integration */
  readonly graph?: Graph
  readonly indexes?: GraphIndexes
  /** Current graph ID */
  readonly graphId: string
  /** Current graph name */
  readonly graphName: string
  /** Node lookup by ID */
  readonly nodeById: ReadonlyMap<string, GraphNode>
  /** All edges in the graph */
  readonly edges: readonly GraphEdge[]
  /** Input bindings resolved by Domain 2 traversal */
  readonly inputBindings: Readonly<Record<string, string>>
  /** Canonical input lookup for D2/D3 integration */
  readonly getInputValue?: (portId: string) => string
  /** Hints for output variable naming */
  readonly outputBindingHints: Readonly<Record<string, string>>
  /** Current indentation level */
  readonly indentLevel: number
  /** Render execution flow from a port (recursive branch generation) */
  readonly renderExecFromPort: (
    nodeId: string,
    sourcePortId: string,
  ) => string[]
  /** Sanitize a string to be a valid Lua identifier */
  readonly sanitizeIdentifier: (raw: string) => string
  /** Convert a JavaScript value to a Lua literal */
  readonly toLuaLiteral: (value: unknown) => string
  /** Emit a diagnostic */
  readonly emitDiagnostic: (diagnostic: GenerationDiagnostic) => void
  /** Map of graphId -> callable symbol name for graph-ref resolution */
  readonly callableSymbolByGraphId: ReadonlyMap<string, string>
  /** Map of graphId -> emitted callable key for _G._vinela_callables[...] */
  readonly callableKeyByGraphId?: ReadonlyMap<string, string>
  /** Canonical callable contracts by graph ID */
  readonly callableContracts?: ReadonlyMap<string, CallableContract>
  /** Generate a unique variable name */
  readonly getVariableName: (hint?: string) => string
}

export function callableKeyFor(
  context: GenerationContext,
  graphId: string,
  fallbackName?: string,
): string {
  const cached = context.callableKeyByGraphId?.get(graphId)
  if (cached !== undefined) {
    return cached
  }

  return formatCallableId(fallbackName ?? '', graphId)
}

// ============================================
// Node Generator Interface
// ============================================

/**
 * Interface for node-type-specific Lua code generators.
 * Each node type implements this to generate its Lua representation.
 */
export interface NodeGenerator<T extends NodeData> {
  /**
   * Generate Lua code for a node.
   * @param node - The graph node to generate code for
   * @param context - Generation context with utilities and bindings
   * @returns CompilationUnit with generated code and metadata
   */
  generate(node: GraphNode<T>, context: GenerationContext): CompilationUnit
}

// ============================================
// Helper Types
// ============================================

/**
 * Input resolution result with fallback handling.
 */
export type InputResolutionResult =
  | { kind: 'bound'; expression: string }
  | { kind: 'fallback'; expression: string }
  | { kind: 'missing' }

// ============================================
// Factory Functions
// ============================================

/**
 * Create an empty compilation unit for a node.
 */
export function createEmptyUnit(
  nodeId: string,
  nodeType: string,
  indentLevel: number,
): CompilationUnit {
  return {
    nodeId,
    nodeType,
    code: [],
    localVars: [],
    inputBindings: {},
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Create a compilation unit with code lines.
 */
export function createUnit(
  nodeId: string,
  nodeType: string,
  code: string[],
  indentLevel: number,
  localVars: string[] = [],
): CompilationUnit {
  return {
    nodeId,
    nodeType,
    code,
    localVars,
    inputBindings: {},
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Merge multiple compilation units into one.
 * Units are merged in order, with indent levels adjusted.
 */
export function mergeUnits(
  baseUnit: CompilationUnit,
  ...additionalUnits: CompilationUnit[]
): CompilationUnit {
  const merged: CompilationUnit = {
    nodeId: baseUnit.nodeId,
    nodeType: baseUnit.nodeType,
    code: [...baseUnit.code],
    localVars: [...baseUnit.localVars],
    inputBindings: { ...baseUnit.inputBindings },
    outputBindings: { ...baseUnit.outputBindings },
    indentLevel: baseUnit.indentLevel,
  }

  for (const unit of additionalUnits) {
    merged.code.push(...unit.code)
    merged.localVars.push(...unit.localVars)
    Object.assign(merged.inputBindings, unit.inputBindings)
    Object.assign(merged.outputBindings, unit.outputBindings)
  }

  return merged
}
