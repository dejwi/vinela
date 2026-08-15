// Set Keymap Action Node Generator
// Generates Lua code for vim.keymap.set calls

import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import { createNodeDiagnostic } from '../shared/diagnostics'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Generate Lua code for a set-keymap action node.
 *
 * Generates vim.keymap.set() calls for configuring key mappings.
 *
 * Examples:
 * - vim.keymap.set("n", "<leader>f", ":vsplit<cr>", { silent = true })
 * - vim.keymap.set({"n", "v"}, "<leader>x", function() ... end, opts)
 */
export function generateSetKeymap(
  node: GraphNode<ActionNodeDataFor<'set-keymap'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, inputBindings, toLuaLiteral, emitDiagnostic } =
    context

  // Validate key sequence
  const keySequence = inputBindings['key-sequence'] ?? config.keySequence.trim()
  if (!keySequence || keySequence === '') {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        'Set Keymap node requires a key sequence',
        graphId,
        node.id,
        'action:set-keymap',
        'Configure a key sequence like "<leader>f" or "gd"',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-keymap', indentLevel)
  }

  // Validate command/action
  const command = inputBindings['on-press'] ?? config.command.trim()
  if (!command || command === '') {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        'Set Keymap node requires a command or action',
        graphId,
        node.id,
        'action:set-keymap',
        'Configure a command like ":vsplit<cr>" or a function',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-keymap', indentLevel)
  }

  // Validate modes
  if (!config.modes || config.modes.length === 0) {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        'Set Keymap node requires at least one mode',
        graphId,
        node.id,
        'action:set-keymap',
        'Select at least one mode: n (normal), i (insert), v (visual), etc.',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-keymap', indentLevel)
  }

  // Build mode string
  const modeStr = formatModes(config.modes)

  // Build opts table
  const opts: Record<string, boolean | string> = {
    silent: config.silent,
    expr: config.expr,
    remap: !config.noremap, // noremap = true means remap = false
  }
  if (config.description && config.description.trim() !== '') {
    opts['desc'] = config.description.trim()
  }
  const optsStr = formatOpts(opts, toLuaLiteral)

  // Escape the key sequence for Lua string
  const escapedKeySequence = escapeKeySequence(keySequence)

  // Build the keymap.set call
  // Determine if command is a Lua function or Ex command
  const rhs = formatRhs(command, config.expr)

  const code = `vim.keymap.set(${modeStr}, "${escapedKeySequence}", ${rhs}${optsStr})`

  return {
    nodeId: node.id,
    nodeType: 'action:set-keymap',
    code: [code],
    localVars: [],
    inputBindings: {
      'key-sequence': escapedKeySequence,
      'on-press': command,
    },
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Format modes array for Lua.
 * Single mode: "n"
 * Multiple modes: {"n", "v"}
 */
function formatModes(modes: string[]): string {
  if (modes.length === 1) {
    return `"${modes[0]}"`
  }
  const modeList = modes.map((m) => `"${m}"`).join(', ')
  return `{${modeList}}`
}

/**
 * Format options table for keymap.set.
 * Returns empty string if no options, otherwise returns ", { opts... }"
 */
function formatOpts(
  opts: Record<string, boolean | string>,
  toLuaLiteral: (value: unknown) => string,
): string {
  const entries: string[] = []

  for (const [key, value] of Object.entries(opts)) {
    if (typeof value === 'boolean') {
      entries.push(`${key} = ${value}`)
    } else if (typeof value === 'string') {
      entries.push(`${key} = ${toLuaLiteral(value)}`)
    }
  }

  if (entries.length === 0) {
    return ''
  }

  return `, { ${entries.join(', ')} }`
}

/**
 * Escape a key sequence for use in a Lua string literal.
 */
function escapeKeySequence(seq: string): string {
  return seq
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Format the right-hand side of a keymap.
 * If it looks like a Lua function, use it directly.
 * Otherwise, wrap as an Ex command string.
 */
function formatRhs(command: string, expr: boolean): string {
  const trimmed = command.trim()

  // Check if it's already a function expression
  if (
    trimmed.startsWith('function') ||
    trimmed.startsWith('function(') ||
    trimmed.startsWith('()') ||
    trimmed.includes('function(')
  ) {
    return trimmed
  }

  // Check if it's a Lua expression (starts with "() =>" or similar)
  if (trimmed.startsWith('()') || trimmed.includes('=>')) {
    // Convert arrow function to Lua function
    return convertArrowToLuaFunction(trimmed)
  }

  // If it's a command starting with :, wrap in angle brackets or use as-is
  if (trimmed.startsWith(':')) {
    // Convert :command to <cmd>command<cr> format for silent execution
    return `"${escapeKeySequence(trimmed)}"`
  }

  // For expr mappings, the command should be a function or expression
  if (expr) {
    return `"${escapeKeySequence(trimmed)}"`
  }

  // Default: wrap as string command
  return `"${escapeKeySequence(trimmed)}"`
}

/**
 * Convert JavaScript/TypeScript arrow function syntax to Lua function.
 * This is a basic converter for simple cases.
 */
function convertArrowToLuaFunction(arrow: string): string {
  // Basic conversion: () => expr  ->  function() return expr end
  // () => { statements }  ->  function() statements end

  const arrowMatch = /^\s*\(\s*\)\s*=>\s*(.+)$/s.exec(arrow)
  if (arrowMatch) {
    const capturedGroup = arrowMatch[1]
    if (capturedGroup === undefined) {
      return arrow
    }
    const body = capturedGroup.trim()
    if (!body.startsWith('{')) {
      // Expression body: () => expr
      return `function() return ${body} end`
    }
    // Block body: () => { ... }
    // Remove outer braces and convert
    const innerBody = body.slice(1, -1).trim()
    return `function()\n  ${innerBody}\nend`
  }

  // If we can't parse it, return as-is and hope it's valid Lua
  return arrow
}
