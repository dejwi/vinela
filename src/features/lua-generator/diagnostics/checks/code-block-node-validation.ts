import { isLuaReservedWord } from '@/features/lua-generator/lua-utils'
import type { GraphNode } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import { checkMismatchedKeywords } from './code-block-keyword-analysis'

function getNodeDisplayName(node: GraphNode): string {
  const displayName =
    'displayName' in node.data
      ? (node.data.displayName as string | undefined)
      : undefined
  return displayName?.trim() || node.id.slice(0, 8)
}

function emitEmptyCodeBlockError(
  graph: { id: string; name: string },
  node: GraphNode,
  nodeName: string,
  collector: DiagnosticsCollector,
): void {
  collector.addError({
    id: 'ERR_CONFIG_CODEBLOCK_EMPTY',
    category: 'config',
    message: `Code Block "${nodeName}" is empty`,
    details:
      'Code blocks must contain Lua code to be valid. Empty code blocks will not generate any output.',
    source: {
      graphId: graph.id,
      graphName: graph.name,
      nodeId: node.id,
      nodeType: 'code-block',
    },
    suggestions: [
      'Add Lua code to the code block',
      'Remove the code block if it is not needed',
      'Use a different node type if no custom code is required',
    ],
  })
}

function emitDuplicatePortErrors(
  graph: { id: string; name: string },
  node: GraphNode,
  nodeName: string,
  inputs: ReadonlyArray<{ name: string }>,
  outputs: ReadonlyArray<{ name: string }>,
  collector: DiagnosticsCollector,
): void {
  const allPortNames = new Map<string, string>()
  const duplicates: Array<{ name: string; type: 'input' | 'output' }> = []

  for (const input of inputs) {
    const lowerName = input.name.toLowerCase()
    if (allPortNames.has(lowerName)) {
      duplicates.push({ name: input.name, type: 'input' })
    } else {
      allPortNames.set(lowerName, input.name)
    }
  }

  for (const output of outputs) {
    const lowerName = output.name.toLowerCase()
    if (allPortNames.has(lowerName)) {
      duplicates.push({ name: output.name, type: 'output' })
    } else {
      allPortNames.set(lowerName, output.name)
    }
  }

  if (duplicates.length === 0) {
    return
  }

  const dupNames = duplicates
    .map((duplicate) => `"${duplicate.name}" (${duplicate.type})`)
    .join(', ')
  collector.addError({
    id: 'ERR_CONFIG_CODEBLOCK_DUPLICATE_PORT',
    category: 'config',
    message: `Code Block "${nodeName}" has duplicate port names`,
    details: `Duplicate port names (case-insensitive): ${dupNames}. Port names must be unique across inputs and outputs.`,
    source: {
      graphId: graph.id,
      graphName: graph.name,
      nodeId: node.id,
      nodeType: 'code-block',
    },
    suggestions: [
      'Rename ports so each name is unique',
      'Use different casing only for different purposes',
      'Remove duplicate ports if they are not needed',
    ],
  })
}

function emitReservedPortWarnings(
  graph: { id: string; name: string },
  node: GraphNode,
  nodeName: string,
  inputs: ReadonlyArray<{ name: string }>,
  outputs: ReadonlyArray<{ name: string }>,
  collector: DiagnosticsCollector,
): void {
  const reservedPorts: Array<{ name: string; type: 'input' | 'output' }> = []

  for (const input of inputs) {
    if (isLuaReservedWord(input.name)) {
      reservedPorts.push({ name: input.name, type: 'input' })
    }
  }

  for (const output of outputs) {
    if (isLuaReservedWord(output.name)) {
      reservedPorts.push({ name: output.name, type: 'output' })
    }
  }

  if (reservedPorts.length === 0) {
    return
  }

  const reservedNames = reservedPorts.map((port) => `"${port.name}"`).join(', ')
  collector.addWarning({
    id: 'WARN_CONFIG_CODEBLOCK_RESERVED_PORT',
    category: 'config',
    message: `Code Block "${nodeName}" uses Lua reserved words as port names`,
    details: `Reserved words used: ${reservedNames}. These will be prefixed with underscore in generated code, which may be confusing.`,
    source: {
      graphId: graph.id,
      graphName: graph.name,
      nodeId: node.id,
      nodeType: 'code-block',
    },
    suggestions: [
      'Rename ports to avoid Lua reserved words',
      'Use descriptive names (e.g., "input_end" instead of "end")',
      'See the list of Lua reserved words in documentation',
    ],
  })
}

function emitKeywordMismatchWarnings(
  graph: { id: string },
  node: GraphNode,
  nodeName: string,
  code: string,
  collector: DiagnosticsCollector,
): void {
  const keywordWarnings = checkMismatchedKeywords(code)
  for (const warning of keywordWarnings) {
    collector.addWarning({
      id: 'WARN_CONFIG_CODEBLOCK_MISMATCHED_KEYWORDS',
      category: 'syntax',
      message: `Code Block "${nodeName}" has mismatched ${warning.keyword} keywords`,
      details: warning.message,
      source: {
        graphId: graph.id,
        nodeId: node.id,
        nodeType: 'code-block',
      },
      suggestions: [
        `Ensure every ${warning.keyword.split('/')[0]} has a matching ${warning.keyword.split('/')[1]}`,
        'Check for typos in block keywords',
        'Use proper Lua syntax for block structures',
      ],
    })
  }
}

function emitMissingReturnWarning(
  graph: { id: string },
  node: GraphNode,
  nodeName: string,
  code: string,
  outputs: ReadonlyArray<{ name: string }>,
  collector: DiagnosticsCollector,
): void {
  if (
    outputs.length === 0 ||
    code.trim().length === 0 ||
    code.includes('return')
  ) {
    return
  }

  collector.addWarning({
    id: 'WARN_CONFIG_CODEBLOCK_MISSING_RETURN',
    category: 'config',
    message: `Code Block "${nodeName}" is missing return statement`,
    details: `This code block has ${outputs.length} output port(s) but no return statement. Output values will be undefined unless you add a return statement matching the output port order.`,
    source: {
      graphId: graph.id,
      nodeId: node.id,
      nodeType: 'code-block',
    },
    suggestions: [
      `Add a return statement with ${outputs.length} value(s)`,
      `Example: return ${outputs.map((output) => output.name).join(', ')}`,
      'Remove output ports if no values need to be returned',
    ],
  })
}

export function validateCodeBlockNode(
  graph: { id: string; name: string },
  node: GraphNode,
  collector: DiagnosticsCollector,
): void {
  if (node.data.nodeType !== 'code-block') {
    return
  }

  const nodeName = getNodeDisplayName(node)
  const { code, inputs, outputs } = node.data

  if (code.trim().length === 0) {
    emitEmptyCodeBlockError(graph, node, nodeName, collector)
  }

  emitDuplicatePortErrors(graph, node, nodeName, inputs, outputs, collector)
  emitReservedPortWarnings(graph, node, nodeName, inputs, outputs, collector)

  if (code.trim().length > 0) {
    emitKeywordMismatchWarnings(graph, node, nodeName, code, collector)
  }

  emitMissingReturnWarning(graph, node, nodeName, code, outputs, collector)
}
