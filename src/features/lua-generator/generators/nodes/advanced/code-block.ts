// src/features/lua-generator/generators/nodes/advanced/code-block.ts
// Code Block node generator - wraps user Lua code in a local function

import {
  sanitizeLuaIdentifierList,
  stripLuaLongBracketLiterals,
} from '@/features/lua-generator/lua-utils'
import type { CodeBlockNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createEmptyUnit } from '../types'

/**
 * Reserved Lua words that need special handling
 */
const LUA_RESERVED_WORDS = new Set([
  'and',
  'break',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'goto',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while',
])

/**
 * Count block keyword occurrences in Lua code.
 * Returns counts for paired keywords to detect mismatches.
 */
function countBlockKeywords(code: string): {
  doEnd: number
  ifThenEnd: number
  functionEnd: number
  repeatUntil: number
} {
  // Simple regex-based counting - not perfect but catches obvious mismatches
  const strippedCode = stripLuaLongBracketLiterals(code)
  const doEnd =
    (strippedCode.match(/\bdo\b/g) ?? []).length -
    (strippedCode.match(/\bend\b/g) ?? []).length
  const ifThenEnd =
    (strippedCode.match(/\bthen\b/g) ?? []).length -
    (strippedCode.match(/\bend\b/g) ?? []).length
  const functionEnd =
    (strippedCode.match(/\bfunction\b/g) ?? []).length -
    (strippedCode.match(/\bend\b/g) ?? []).length
  const repeatUntil =
    (strippedCode.match(/\brepeat\b/g) ?? []).length -
    (strippedCode.match(/\buntil\b/g) ?? []).length

  return { doEnd, ifThenEnd, functionEnd, repeatUntil }
}

/**
 * Check if code contains a return statement.
 * This is a simple check - it looks for the word 'return' at statement level.
 */
function hasReturnStatement(code: string): boolean {
  // Remove strings and comments for accurate checking
  const cleanedCode = code
    .replace(/"(?:[^"\\]|\\.)*"/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, ' ')
    .replace(/\[\[.*?\]\]/gs, ' ')
    .replace(/--[^\n]*/g, ' ')

  return /\breturn\b/.test(cleanedCode)
}

/**
 * Validate port names for duplicates (case-insensitive)
 * Empty/whitespace-only names are excluded from duplicate checking
 * since they will be sanitized to _unnamed with collision suffixes.
 */
function findDuplicatePortNames(
  inputs: { name: string }[],
  outputs: { name: string }[],
): string[] {
  const allNames = [...inputs, ...outputs]
    .map((p) => p.name.toLowerCase().trim())
    .filter((name) => name.length > 0) // Exclude empty names
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const name of allNames) {
    if (seen.has(name)) {
      duplicates.add(name)
    }
    seen.add(name)
  }

  return [...duplicates]
}

/**
 * Find port names that are Lua reserved words.
 */
function findReservedWordPortNames(ports: { name: string }[]): string[] {
  return ports
    .map((p) => p.name.trim())
    .filter((name) => LUA_RESERVED_WORDS.has(name))
}

/**
 * Node generator for Code Block nodes.
 *
 * Generates a local function from user-provided code body and a call site
 * that captures outputs as local variables.
 */
export const codeBlockGenerator: NodeGenerator<CodeBlockNodeData> = {
  generate(
    node: GraphNode<CodeBlockNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { code, inputs, outputs } = data

    // Validate: Empty code is an error
    if (code.trim().length === 0) {
      context.emitDiagnostic({
        id: 'code-block-empty-code',
        severity: 'error',
        category: 'config',
        message: 'Code block has no code body',
        details: `Node '${nodeId}' has an empty code body. Please add Lua code to this block.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'code-block',
        },
        suggestions: ['Add Lua code to the code block editor'],
      })
      return createEmptyUnit(nodeId, 'code-block', context.indentLevel)
    }

    // Validate: Check for duplicate port names (case-insensitive)
    const duplicates = findDuplicatePortNames(inputs, outputs)
    if (duplicates.length > 0) {
      context.emitDiagnostic({
        id: 'code-block-duplicate-port-names',
        severity: 'error',
        category: 'config',
        message: `Duplicate port names: ${duplicates.join(', ')}`,
        details: `Node '${nodeId}' has duplicate port names (case-insensitive). Each port must have a unique name.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'code-block',
        },
        suggestions: ['Rename ports to have unique names'],
      })
      return createEmptyUnit(nodeId, 'code-block', context.indentLevel)
    }

    // Warning: Check for reserved word port names
    const reservedInputs = findReservedWordPortNames(inputs)
    const reservedOutputs = findReservedWordPortNames(outputs)
    const reservedWords = [...reservedInputs, ...reservedOutputs]

    if (reservedWords.length > 0) {
      context.emitDiagnostic({
        id: 'code-block-reserved-word-ports',
        severity: 'warning',
        category: 'config',
        message: `Port names are Lua reserved words and will be sanitized: ${reservedWords.join(', ')}`,
        details: `Node '${nodeId}' uses Lua reserved words as port names. These will be prefixed with '_' in the generated code.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'code-block',
        },
        suggestions: ['Consider renaming ports to avoid reserved words'],
      })
    }

    // Warning: Check for mismatched block keywords
    const keywordCounts = countBlockKeywords(code)
    const mismatchedBlocks = [
      keywordCounts.doEnd !== 0
        ? `do/end mismatch (${keywordCounts.doEnd})`
        : null,
      keywordCounts.ifThenEnd > 0 ? `unclosed if/then` : null,
      keywordCounts.functionEnd > 0 ? `unclosed function` : null,
      keywordCounts.repeatUntil !== 0
        ? `repeat/until mismatch (${keywordCounts.repeatUntil})`
        : null,
    ].filter(Boolean)

    if (mismatchedBlocks.length > 0) {
      context.emitDiagnostic({
        id: 'code-block-mismatched-keywords',
        severity: 'warning',
        category: 'syntax',
        message: `Potential block keyword mismatch: ${mismatchedBlocks.join(', ')}`,
        details: `Node '${nodeId}' may have unclosed blocks. Please check your code for missing 'end' or 'until' keywords.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'code-block',
        },
        suggestions: ['Check that all blocks are properly closed'],
      })
    }

    // Warning: Check for missing return statement when outputs are expected
    if (outputs.length > 0 && !hasReturnStatement(code)) {
      context.emitDiagnostic({
        id: 'code-block-missing-return',
        severity: 'warning',
        category: 'syntax',
        message: `Code block has ${outputs.length} output(s) but no return statement`,
        details: `Node '${nodeId}' expects ${outputs.length} return value(s) but no 'return' statement was found in the code.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'code-block',
        },
        suggestions: [
          `Add a return statement: return ${outputs.map((o) => o.name).join(', ')}`,
        ],
      })
    }

    // Sanitize input port names to valid Lua identifiers
    const inputParamNames = sanitizeLuaIdentifierList(inputs.map((i) => i.name))

    // Sanitize output port names for variable capture
    const outputVarNames = sanitizeLuaIdentifierList(outputs.map((o) => o.name))

    // Sanitize node ID for function name (replace hyphens and other chars)
    const sanitizedNodeId = context.sanitizeIdentifier(nodeId)
    const functionName = `_code_block_${sanitizedNodeId}`

    // Build the function definition
    const functionDefLines: string[] = [
      `local function ${functionName}(${inputParamNames.join(', ')})`,
      ...code.split('\n').map((line) => `  ${line}`),
      'end',
    ]

    // Build the call site with output capture
    let callSiteLine: string
    if (outputs.length === 0) {
      // No outputs - just call the function
      callSiteLine = `${functionName}(${inputParamNames.join(', ')})`
    } else if (outputs.length === 1) {
      // Single output - simple local declaration
      callSiteLine = `local ${outputVarNames[0]} = ${functionName}(${inputParamNames.join(', ')})`
    } else {
      // Multiple outputs - multiple assignment
      callSiteLine = `local ${outputVarNames.join(', ')} = ${functionName}(${inputParamNames.join(', ')})`
    }

    // Build input bindings from context.inputBindings
    const inputBindings: Record<string, string> = {}
    for (const input of inputs) {
      const binding = context.inputBindings[input.id]
      if (binding !== undefined) {
        inputBindings[input.id] = binding
      }
      // Otherwise, the parameter will use its sanitized name as the variable
    }

    // Build output bindings
    const outputBindings: Record<string, string> = {}
    for (const [index, output] of outputs.entries()) {
      outputBindings[output.id] = outputVarNames[index] ?? `_${index}`
    }

    const allCodeLines = [...functionDefLines, callSiteLine]

    // Manually construct CompilationUnit to include bindings
    const unit: CompilationUnit = {
      nodeId,
      nodeType: 'code-block',
      code: allCodeLines,
      localVars: outputVarNames,
      inputBindings,
      outputBindings,
      indentLevel: context.indentLevel,
    }

    return unit
  },
}
