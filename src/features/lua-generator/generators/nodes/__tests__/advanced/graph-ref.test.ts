// src/features/lua-generator/generators/nodes/__tests__/advanced/graph-ref.test.ts
// Tests for Graph Reference node generator - reference resolution

import { describe, expect, it, vi } from 'vitest'
import { expectedCallableRef } from '@/features/lua-generator/__tests__/utils/callable-keys'
import { formatCallableId } from '@/features/lua-generator/lua-utils'
import type { GraphNode, GraphRefNodeData } from '@/shared/types'
import { graphRefGenerator } from '../../advanced/graph-ref'
import type { GenerationContext } from '../../types'

/**
 * Create a mock GenerationContext for testing
 */
function createMockContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  const diagnostics: ReturnType<GenerationContext['emitDiagnostic']>[] = []

  const callableSymbolByGraphId = overrides.callableSymbolByGraphId ?? new Map()
  const callableKeyByGraphId = new Map<string, string>()
  for (const graphId of callableSymbolByGraphId.keys()) {
    callableKeyByGraphId.set(graphId, formatCallableId(graphId, graphId))
  }

  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map(),
    edges: [],
    inputBindings: {},
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: vi.fn(() => []),
    sanitizeIdentifier: (raw: string) => raw.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (value: unknown) => JSON.stringify(value),
    emitDiagnostic: vi.fn((d) => {
      diagnostics.push(d)
    }),
    callableSymbolByGraphId: new Map(),
    callableKeyByGraphId,
    getVariableName: vi.fn((hint = 'var') => `_${hint}_1`),
    ...overrides,
  }
}

/**
 * Create a Graph Reference node for testing
 */
function createGraphRefNode(
  id: string,
  referencedGraphId: string,
  cachedContract?: {
    parameters: { id: string; name: string; dataType: string }[]
    returnValues: { id: string; name: string; dataType: string }[]
  },
): GraphNode<GraphRefNodeData> {
  return {
    id,
    type: 'graph-ref',
    definitionId: `graph-ref-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'graph-ref',
      referencedGraphId,
      cachedContract: cachedContract
        ? {
            parameters: cachedContract.parameters.map((p) => ({
              ...p,
              dataType: p.dataType as 'string' | 'number' | 'boolean' | 'any',
            })),
            returnValues: cachedContract.returnValues.map((r) => ({
              ...r,
              dataType: r.dataType as 'string' | 'number' | 'boolean' | 'any',
            })),
          }
        : undefined,
    },
  }
}

describe('graphRefGenerator', () => {
  describe('target validation', () => {
    it('emits error when target graph ID is empty', () => {
      const node = createGraphRefNode('ref1', '')
      const context = createMockContext()

      const result = graphRefGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'graph-ref-missing-target',
          severity: 'error',
        }),
      )
    })

    it('emits error when target graph is not callable', () => {
      const node = createGraphRefNode('ref1', 'nonexistent-graph')
      const context = createMockContext()

      const result = graphRefGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'graph-ref-target-not-callable',
          severity: 'error',
        }),
      )
    })

    it('generates call when target exists in callable registry', () => {
      const node = createGraphRefNode('ref1', 'callable-graph')
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code.length).toBeGreaterThan(0)
      expect(result.code[0]).toContain(
        expectedCallableRef('callable-graph', 'callable-graph'),
      )
    })
  })

  describe('argument passing', () => {
    it('generates empty args table when no parameters', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [],
        returnValues: [],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        `${expectedCallableRef('callable-graph', 'callable-graph')}({})`,
      )
    })

    it('passes arguments by port ID in table', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [
          { id: 'param1', name: 'message', dataType: 'string' },
          { id: 'param2', name: 'count', dataType: 'number' },
        ],
        returnValues: [],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
        inputBindings: {
          param1: '"hello"',
          param2: '42',
        },
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        `${expectedCallableRef('callable-graph', 'callable-graph')}({ ["param1"] = "hello", ["param2"] = 42 })`,
      )
    })

    it('omits unbound parameters from args table', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [
          { id: 'param1', name: 'message', dataType: 'string' },
          { id: 'param2', name: 'count', dataType: 'number' },
        ],
        returnValues: [],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
        inputBindings: {
          param1: '"hello"',
          // param2 is not bound
        },
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        `${expectedCallableRef('callable-graph', 'callable-graph')}({ ["param1"] = "hello" })`,
      )
    })
  })

  describe('return value handling', () => {
    it('generates simple call when no return values', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [],
        returnValues: [],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.localVars).toEqual([])
    })

    it('captures single return value', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [],
        returnValues: [{ id: 'ret1', name: 'result', dataType: 'string' }],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
        getVariableName: vi.fn((hint) => `_${hint}_1`),
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code.length).toBeGreaterThanOrEqual(2)
      expect(result.code[0]).toContain('local _ret_table_1 =')
      expect(result.code[1]).toContain(
        'local _ret_ret1_1 = _ret_table_1["ret1"]',
      )
      expect(result.localVars).toEqual(
        expect.arrayContaining(['_ret_table_1', '_ret_ret1_1']),
      )
    })

    it('captures multiple return values', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [],
        returnValues: [
          { id: 'ret1', name: 'x', dataType: 'number' },
          { id: 'ret2', name: 'y', dataType: 'number' },
        ],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
        getVariableName: vi.fn((hint) => `_${hint}_1`),
      })

      const result = graphRefGenerator.generate(node, context)

      expect(result.code[0]).toContain('local _ret_table_1 =')
      expect(result.code[1]).toContain(
        'local _ret_ret1_1 = _ret_table_1["ret1"]',
      )
      expect(result.code[2]).toContain(
        'local _ret_ret2_1 = _ret_table_1["ret2"]',
      )
      expect(result.localVars).toEqual(
        expect.arrayContaining(['_ret_table_1', '_ret_ret1_1']),
      )
      expect(result.localVars).toContain('_ret_ret2_1')
    })

    it('extracts return values from result table', () => {
      const node = createGraphRefNode('ref1', 'callable-graph', {
        parameters: [],
        returnValues: [{ id: 'ret1', name: 'result', dataType: 'string' }],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([
          ['callable-graph', '_callable_graph'],
        ]),
        getVariableName: vi.fn(() => '_result'),
      })

      const result = graphRefGenerator.generate(node, context)

      // Should have call line and mapping line
      expect(result.code.length).toBeGreaterThanOrEqual(2)
      expect(result.code[0]).toContain('_G._vinela_callables')
      // The mapping should extract from the return table
      expect(result.code[1]).toContain('["ret1"]')
    })
  })

  describe('integration', () => {
    it('generates complete call with args and returns', () => {
      const node = createGraphRefNode('ref1', 'process-data', {
        parameters: [
          { id: 'input', name: 'data', dataType: 'table' },
          { id: 'mode', name: 'processingMode', dataType: 'string' },
        ],
        returnValues: [
          { id: 'output', name: 'processedData', dataType: 'table' },
          { id: 'status', name: 'success', dataType: 'boolean' },
        ],
      })
      const context = createMockContext({
        callableSymbolByGraphId: new Map([['process-data', '_process_data']]),
        inputBindings: {
          input: 'raw_data',
          mode: '"transform"',
        },
        getVariableName: vi.fn((hint) => `_${hint}_1`),
      })

      const result = graphRefGenerator.generate(node, context)

      // Verify call with arguments
      expect(result.code[0]).toContain(
        expectedCallableRef('process-data', 'process-data'),
      )
      expect(result.code[0]).toContain('["input"] = raw_data')
      expect(result.code[0]).toContain('["mode"] = "transform"')

      // Verify return value extraction
      expect(result.localVars.length).toBeGreaterThanOrEqual(2)
    })
  })
})
