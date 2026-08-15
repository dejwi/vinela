import { describe, expect, it } from 'vitest'
import type { Graph, GraphEdge, GraphNode } from '@/shared/types'
import { checkCodeBlocks } from '../checks/code-block-validation'
import { DiagnosticsCollector } from '../collector'
import { buildPreGenerationContext } from '../index'

function createCodeBlockNode(
  id: string,
  code: string,
  inputs: Array<{
    id: string
    name: string
    dataType: 'any'
  }> = [],
  outputs: Array<{
    id: string
    name: string
    dataType: 'any'
  }> = [],
): GraphNode {
  return {
    id,
    type: 'code-block',
    definitionId: 'code-block-exec',
    position: { x: 100, y: 100 },
    data: {
      nodeType: 'code-block',
      code,
      inputs,
      outputs,
    },
  }
}

function createTestGraph(id: string, name: string, nodes: GraphNode[]): Graph {
  return {
    id,
    name,
    nodes,
    edges: [] as GraphEdge[],
    enabled: true,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('checkCodeBlocks characterization', () => {
  it('preserves exact diagnostic order and payloads across multiple graphs', () => {
    const codeBlockOne = createCodeBlockNode(
      'cb-1',
      'do print("a")',
      [
        { id: 'in-end', name: 'end', dataType: 'any' },
        { id: 'in-dup', name: 'Value', dataType: 'any' },
        { id: 'in-dup2', name: 'value', dataType: 'any' },
      ],
      [{ id: 'out1', name: 'result', dataType: 'any' }],
    )
    const codeBlockTwo = createCodeBlockNode(
      'cb-2',
      'function bad',
      [{ id: 'in-local', name: 'local', dataType: 'any' }],
      [{ id: 'out2', name: 'value', dataType: 'any' }],
    )

    const graphOne = createTestGraph('g-char-1', 'Char One', [codeBlockOne])
    const graphTwo = createTestGraph('g-char-2', 'Char Two', [codeBlockTwo])
    const ctx = buildPreGenerationContext({ graphs: [graphOne, graphTwo] })
    const collector = new DiagnosticsCollector()

    checkCodeBlocks(ctx, collector)

    expect(collector.getAll()).toEqual([
      {
        id: 'ERR_CONFIG_CODEBLOCK_DUPLICATE_PORT',
        category: 'config',
        message: 'Code Block "cb-1" has duplicate port names',
        details:
          'Duplicate port names (case-insensitive): "value" (input). Port names must be unique across inputs and outputs.',
        source: {
          graphId: 'g-char-1',
          graphName: 'Char One',
          nodeId: 'cb-1',
          nodeType: 'code-block',
        },
        suggestions: [
          'Rename ports so each name is unique',
          'Use different casing only for different purposes',
          'Remove duplicate ports if they are not needed',
        ],
        severity: 'error',
      },
      {
        id: 'WARN_CONFIG_CODEBLOCK_RESERVED_PORT',
        category: 'config',
        message: 'Code Block "cb-1" uses Lua reserved words as port names',
        details:
          'Reserved words used: "end". These will be prefixed with underscore in generated code, which may be confusing.',
        source: {
          graphId: 'g-char-1',
          graphName: 'Char One',
          nodeId: 'cb-1',
          nodeType: 'code-block',
        },
        suggestions: [
          'Rename ports to avoid Lua reserved words',
          'Use descriptive names (e.g., "input_end" instead of "end")',
          'See the list of Lua reserved words in documentation',
        ],
        severity: 'warning',
      },
      {
        id: 'WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS',
        category: 'syntax',
        message: 'Code Block "cb-1" has mismatched do/end keywords',
        details:
          'Mismatched block keywords: 1 block opener(s) (do/if/for/while/function), 0 end',
        source: {
          graphId: 'g-char-1',
          nodeId: 'cb-1',
          nodeType: 'code-block',
        },
        suggestions: [
          'Ensure every do has a matching end',
          'Check for typos in block keywords',
          'Use proper Lua syntax for block structures',
        ],
        severity: 'warning',
      },
      {
        id: 'WARN_CONFIG_CODEBLOCK_MISSING_RETURN',
        category: 'config',
        message: 'Code Block "cb-1" is missing return statement',
        details:
          'This code block has 1 output port(s) but no return statement. Output values will be undefined unless you add a return statement matching the output port order.',
        source: {
          graphId: 'g-char-1',
          nodeId: 'cb-1',
          nodeType: 'code-block',
        },
        suggestions: [
          'Add a return statement with 1 value(s)',
          'Example: return result',
          'Remove output ports if no values need to be returned',
        ],
        severity: 'warning',
      },
      {
        id: 'WARN_CONFIG_CODEBLOCK_RESERVED_PORT',
        category: 'config',
        message: 'Code Block "cb-2" uses Lua reserved words as port names',
        details:
          'Reserved words used: "local". These will be prefixed with underscore in generated code, which may be confusing.',
        source: {
          graphId: 'g-char-2',
          graphName: 'Char Two',
          nodeId: 'cb-2',
          nodeType: 'code-block',
        },
        suggestions: [
          'Rename ports to avoid Lua reserved words',
          'Use descriptive names (e.g., "input_end" instead of "end")',
          'See the list of Lua reserved words in documentation',
        ],
        severity: 'warning',
      },
      {
        id: 'WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS',
        category: 'syntax',
        message: 'Code Block "cb-2" has mismatched do/end keywords',
        details:
          'Mismatched block keywords: 1 block opener(s) (do/if/for/while/function), 0 end',
        source: {
          graphId: 'g-char-2',
          nodeId: 'cb-2',
          nodeType: 'code-block',
        },
        suggestions: [
          'Ensure every do has a matching end',
          'Check for typos in block keywords',
          'Use proper Lua syntax for block structures',
        ],
        severity: 'warning',
      },
      {
        id: 'WARN_CONFIG_CODEBLOCK_MISSING_RETURN',
        category: 'config',
        message: 'Code Block "cb-2" is missing return statement',
        details:
          'This code block has 1 output port(s) but no return statement. Output values will be undefined unless you add a return statement matching the output port order.',
        source: {
          graphId: 'g-char-2',
          nodeId: 'cb-2',
          nodeType: 'code-block',
        },
        suggestions: [
          'Add a return statement with 1 value(s)',
          'Example: return value',
          'Remove output ports if no values need to be returned',
        ],
        severity: 'warning',
      },
    ])
  })
})
