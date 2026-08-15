// src/features/lua-generator/generators/nodes/action/create-autocmd.ts
// Create Autocmd Action Node Generator
// Generates autocmd REGISTRATION only - callback body is in a separate callable graph

import { formatAutocmdCallbackId } from '@/features/lua-generator/lua-utils'
import {
  canonicalizeAutocmdEventName,
  normalizeAutocmdEventNames,
} from '@/shared/data/neovim/events'
import { CALLABLE_REGISTRY_GLOBAL } from '@/shared/lib/app-identity'
import type { ActionNodeDataFor, GraphEdge, GraphNode } from '@/shared/types'
import { createNodeDiagnostic, DiagnosticCodes } from '../shared/diagnostics'
import { emitInlineTable } from '../shared/lua-emit'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

interface ResolvedAutocmdCallback {
  code: string
  isInline: boolean
  bodyCode: string[]
}

/**
 * Generate Lua code for create-autocmd action node.
 *
 * IMPORTANT: This generates REGISTRATION only, not the callback body!
 * The callback body is defined in a separate callable graph.
 *
 * Example output:
 * ```lua
 * vim.api.nvim_create_autocmd("BufEnter", {
 *   pattern = "*.lua",
 *   callback = _G._vinela_callables["graph_callback_123"]
 * })
 * ```
 */
export function generateCreateAutocmd(
  node: GraphNode<ActionNodeDataFor<'create-autocmd'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, toLuaLiteral, emitDiagnostic } = context

  // Validate events
  const validEvents = normalizeAutocmdEventNames(config.events)

  if (validEvents.length === 0) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'error',
        'Create Autocmd node has no events selected',
        graphId,
        node.id,
        'action:create-autocmd',
        'Select at least one valid Neovim autocmd event (for example "BufEnter" or "FileType") before generation.',
      ),
    )
    return createEmptyUnit(node.id, 'action:create-autocmd', indentLevel)
  }

  // Warn about invalid events
  const invalidEvents = config.events.filter((eventName) => {
    const trimmed = eventName.trim()
    return trimmed.length > 0 && canonicalizeAutocmdEventName(trimmed) === null
  })
  for (const invalidEvent of invalidEvents) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'warning',
        `Invalid autocmd event: "${invalidEvent}"`,
        graphId,
        node.id,
        'action:create-autocmd',
        `Event "${invalidEvent}" is not a recognized Neovim autocmd event. It will be skipped.`,
      ),
    )
  }

  // Check for legacy callbackLua (unsupported in IR mode)
  if (config.callbackLua && config.callbackLua.trim().length > 0) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.UNSUPPORTED_LEGACY,
        'warning',
        'Legacy callbackLua is not supported - use callable graph reference instead',
        graphId,
        node.id,
        'action:create-autocmd',
        'The callbackLua field is deprecated. Use a callable graph reference for the callback body.',
      ),
    )
  }

  // Build the options table
  const optionsEntries: Record<string, string | undefined> = {}

  // Pattern - normalize to at least ['*']
  const patterns = config.patterns.length > 0 ? config.patterns : ['*']
  const normalizedPatterns = patterns
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  const finalPatterns =
    normalizedPatterns.length > 0 ? normalizedPatterns : ['*']

  // Check for ~ or $HOME in patterns (API does not auto-expand)
  for (const pattern of finalPatterns) {
    if (pattern.includes('~') || pattern.includes('$HOME')) {
      emitDiagnostic(
        createNodeDiagnostic(
          DiagnosticCodes.INVALID_CONFIG,
          'warning',
          `Pattern "${pattern}" contains unexpanded home directory reference`,
          graphId,
          node.id,
          'action:create-autocmd',
          'The autocmd API does not auto-expand ~ or $HOME. Use an absolute path or vim.fn.expand().',
        ),
      )
    }
  }

  if (finalPatterns.length === 1) {
    const firstPattern = finalPatterns[0]
    if (firstPattern !== undefined) {
      optionsEntries['pattern'] = toLuaLiteral(firstPattern)
    }
  } else {
    optionsEntries['pattern'] = toLuaLiteral(finalPatterns)
  }

  // Group name (optional)
  if (config.groupName && config.groupName.trim().length > 0) {
    optionsEntries['group'] = toLuaLiteral(config.groupName.trim())
  }

  // Once flag
  if (config.once) {
    optionsEntries['once'] = 'true'
  }

  // Nested flag
  if (config.nested) {
    optionsEntries['nested'] = 'true'
  }

  // Callback - required via on-event execution port.
  const callback = resolveCallbackSymbol(node, context)
  if (callback === null) {
    return createEmptyUnit(node.id, 'action:create-autocmd', indentLevel)
  }
  optionsEntries['callback'] = callback.code

  // Build the events argument
  const eventsArg =
    validEvents.length === 1
      ? toLuaLiteral(validEvents[0])
      : toLuaLiteral(validEvents)

  // Build the full autocmd call
  const optionsTable = emitInlineTable(optionsEntries)
  const autocmdCode = `vim.api.nvim_create_autocmd(${eventsArg}, ${optionsTable})`

  const code: string[] = []

  if (!callback.isInline) {
    const callbackKey = callback.code
    code.push(`${callbackKey} = function()`)
    for (const line of callback.bodyCode) {
      code.push(`  ${line}`)
    }
    code.push('end')
  }

  code.push(autocmdCode)

  return {
    nodeId: node.id,
    nodeType: 'action:create-autocmd',
    code,
    localVars: [],
    inputBindings: {},
    outputBindings: { done: 'nil' }, // done port just signals completion
    indentLevel,
  }
}

/**
 * Resolve the callback symbol for the autocmd.
 * Uses the on-event execution port as the callback source.
 *
 * - Simple single-action callbacks are inlined as `function() ... end`
 * - Complex callbacks use a callable reference symbol
 */
function resolveCallbackSymbol(
  node: GraphNode,
  context: GenerationContext,
): ResolvedAutocmdCallback | null {
  const callbackEdge = resolveCallbackEdge(node, context)

  if (callbackEdge === null) {
    context.emitDiagnostic({
      id: 'ERR_AUTOCMD_NO_CALLBACK',
      severity: 'error',
      category: 'connectivity',
      message: 'Autocmd has no callback connected',
      details:
        'Connect the "On Event" output port to at least one action so the autocmd can execute behavior when triggered.',
      source: {
        graphId: context.graphId,
        nodeId: node.id,
        nodeType: 'action:create-autocmd',
        portId: 'on-event',
      },
      suggestions: [
        'Connect the "On Event" output to an action node',
        'Remove the autocmd node if no callback behavior is needed',
      ],
    })
    return null
  }

  const callbackTarget = context.nodeById.get(callbackEdge.target)
  if (callbackTarget === undefined) {
    context.emitDiagnostic({
      id: 'ERR_AUTOCMD_CALLBACK_TARGET_MISSING',
      severity: 'error',
      category: 'structure',
      message: 'Autocmd callback target node is missing',
      details: `Edge '${callbackEdge.id}' points to missing node '${callbackEdge.target}'.`,
      source: {
        graphId: context.graphId,
        nodeId: node.id,
        nodeType: 'action:create-autocmd',
        portId: 'on-event',
      },
      suggestions: [
        'Reconnect the "On Event" output to an existing node',
        'Delete broken edges from the graph',
      ],
    })
    return null
  }

  if (isSimpleAction(callbackTarget, context)) {
    const bodyCode = context.renderExecFromPort(node.id, 'on-event')
    return {
      code: buildInlineCallback(bodyCode),
      isInline: true,
      bodyCode,
    }
  }

  const callableId = formatAutocmdCallbackId(context.graphName, node.id)
  const bodyCode = context.renderExecFromPort(node.id, 'on-event')

  return {
    code: `_G.${CALLABLE_REGISTRY_GLOBAL}[${context.toLuaLiteral(callableId)}]`,
    isInline: false,
    bodyCode,
  }
}

function resolveCallbackEdge(
  node: GraphNode,
  context: GenerationContext,
): GraphEdge | null {
  const indexedEdges = context.indexes?.execEdges.get(node.id)
  const fromIndexes = indexedEdges?.find(
    (edge) =>
      edge.sourcePort === 'on-event' || edge.sourcePort === 'on-trigger',
  )

  if (fromIndexes !== undefined) {
    return fromIndexes
  }

  const fromEdges = context.edges.find(
    (edge) =>
      edge.source === node.id &&
      (edge.sourcePort === 'on-event' || edge.sourcePort === 'on-trigger'),
  )

  return fromEdges ?? null
}

function isSimpleAction(node: GraphNode, context: GenerationContext): boolean {
  if (node.data.nodeType !== 'action') {
    return false
  }

  const hasExecContinuation = context.edges.some(
    (edge) => edge.source === node.id && isExecPort(node, edge.sourcePort),
  )

  return !hasExecContinuation
}

function isExecPort(node: GraphNode, portId: string): boolean {
  switch (node.data.nodeType) {
    case 'trigger':
      return portId === 'exec' || portId === 'out'
    case 'action':
      return portId === 'done' || portId === 'out' || portId === 'on-event'
    case 'condition':
      return portId === 'true' || portId === 'false'
    case 'loop':
      return portId === 'body' || portId === 'loop' || portId === 'done'
    case 'code-block':
      return portId === 'done' || portId === 'out'
    case 'graph-ref':
    case 'run-function':
    case 'builtin':
      return portId === 'done' || portId === 'out'
    case 'callable-entry':
      return portId === 'exec' || portId === 'out'
    case 'return':
      return false
  }
}

function buildInlineCallback(lines: readonly string[]): string {
  const body = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (body.length === 0) {
    return 'function() end'
  }

  return `function() ${body.join('; ')} end`
}

/**
 * NodeGenerator-compatible export for create-autocmd.
 */
export const createAutocmdGenerator = {
  generate: generateCreateAutocmd,
}
