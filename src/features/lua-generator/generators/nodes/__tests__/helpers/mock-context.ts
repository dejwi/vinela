// src/features/lua-generator/generators/nodes/__tests__/helpers/mock-context.ts
// Test helpers for creating mock GenerationContext

import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import type { GenerationDiagnostic } from '@/features/lua-generator/diagnostics/types'
import { formatCallableId } from '@/features/lua-generator/lua-utils'
import type { GraphEdge, GraphNode } from '@/shared/types'
import type { CompilationUnit, GenerationContext } from '../../types'

/**
 * Options for creating a mock GenerationContext.
 */
export interface MockContextOptions {
  graphId?: string
  graphName?: string
  nodes?: GraphNode[]
  edges?: GraphEdge[]
  inputBindings?: Record<string, string>
  outputBindingHints?: Record<string, string>
  indentLevel?: number
  callableSymbolByGraphId?: Map<string, string>
  callableKeyByGraphId?: Map<string, string>
  callableNamesByGraphId?: ReadonlyMap<string, string>
  renderExecFromPort?: (nodeId: string, sourcePortId: string) => string[]
}

/**
 * Create a mock GenerationContext for testing.
 */
export function createMockContext(options: MockContextOptions = {}): {
  context: GenerationContext
  diagnostics: DiagnosticsCollector
  getEmittedDiagnostics: () => GenerationDiagnostic[]
} {
  const diagnostics = new DiagnosticsCollector()
  const emittedDiagnostics: GenerationDiagnostic[] = []

  const nodeById = new Map<string, GraphNode>()
  for (const node of options.nodes ?? []) {
    nodeById.set(node.id, node)
  }

  const callableSymbolsByGraphId = options.callableSymbolByGraphId ?? new Map()
  const derivedCallableKeysByGraphId = new Map<string, string>()

  for (const graphId of callableSymbolsByGraphId.keys()) {
    const graphName = options.callableNamesByGraphId?.get(graphId) ?? graphId
    derivedCallableKeysByGraphId.set(
      graphId,
      formatCallableId(graphName, graphId),
    )
  }

  const context: GenerationContext = {
    graphId: options.graphId ?? 'test-graph',
    graphName: options.graphName ?? 'Test Graph',
    nodeById,
    edges: options.edges ?? [],
    inputBindings: options.inputBindings ?? {},
    outputBindingHints: options.outputBindingHints ?? {},
    indentLevel: options.indentLevel ?? 0,
    callableSymbolByGraphId: callableSymbolsByGraphId,
    callableKeyByGraphId:
      options.callableKeyByGraphId ??
      (derivedCallableKeysByGraphId.size > 0
        ? derivedCallableKeysByGraphId
        : new Map([
            [
              options.graphId ?? 'test-graph',
              formatCallableId(
                options.graphName ?? 'Test Graph',
                options.graphId ?? 'test-graph',
              ),
            ],
          ])),

    renderExecFromPort:
      options.renderExecFromPort ??
      (() => {
        return []
      }),

    sanitizeIdentifier: (raw: string) => {
      return raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
    },

    toLuaLiteral: (value: unknown) => {
      if (value === null || value === undefined) return 'nil'
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') return String(value)
      if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`
      if (Array.isArray(value)) {
        return `{ ${value.map((v) => context.toLuaLiteral(v)).join(', ')} }`
      }
      return 'nil'
    },

    emitDiagnostic: (d: GenerationDiagnostic) => {
      emittedDiagnostics.push(d)
      if (d.severity === 'error') {
        diagnostics.addError(d)
      } else {
        diagnostics.addWarning(d)
      }
    },

    getVariableName: (hint = 'var') => {
      return `_nvimset_${hint}_${Math.random().toString(36).slice(2, 7)}`
    },
  }

  return {
    context,
    diagnostics,
    getEmittedDiagnostics: () => [...emittedDiagnostics],
  }
}

/**
 * Create a simple mock unit for testing branch rendering.
 */
export function createMockUnit(code: string[]): CompilationUnit {
  return {
    nodeId: 'mock',
    nodeType: 'mock',
    code,
    localVars: [],
    inputBindings: {},
    outputBindings: {},
    indentLevel: 0,
  }
}
