// Run Action/Command Action Node Generator
// Generates Lua code for vim.cmd and vim.api.nvim_feedkeys calls

import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import { createNodeDiagnostic } from '../shared/diagnostics'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Generate Lua code for a run-action node (run command or feed keys).
 *
 * Generates vim.cmd() for Ex commands or vim.api.nvim_feedkeys() for key sequences.
 *
 * Examples:
 * - vim.cmd("vsplit")
 * - vim.cmd("edit " .. vim.fn.fnameescape(filepath))
 * - vim.api.nvim_feedkeys(vim.keycode("<CR>"), "m", false)
 */
export function generateRunAction(
  node: GraphNode<ActionNodeDataFor<'run-action'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, emitDiagnostic } = context

  // Validate action string
  const action = config.action.trim()
  if (!action || action === '') {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        'Run Action node requires a command or key sequence',
        graphId,
        node.id,
        'action:run-action',
        'Configure a command like ":vsplit" or a key sequence like "<CR>"',
      ),
    )
    return createEmptyUnit(node.id, 'action:run-action', indentLevel)
  }

  // Check for multiline commands (warning)
  if (action.includes('\n') || action.includes('\r')) {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'warning',
        'Run Action command contains newlines which may cause issues',
        graphId,
        node.id,
        'action:run-action',
        'Consider breaking this into multiple Run Action nodes',
      ),
    )
  }

  // Generate based on action type
  if (config.actionType === 'keys') {
    return generateFeedKeys(node.id, action, indentLevel)
  }

  // Default: command type
  return generateVimCmd(node.id, action, indentLevel)
}

/**
 * Generate vim.cmd() call for Ex commands.
 */
function generateVimCmd(
  nodeId: string,
  command: string,
  indentLevel: number,
): CompilationUnit {
  // Normalize command - ensure it starts with :
  const normalizedCommand = command.startsWith(':') ? command.slice(1) : command

  // Escape for Lua string
  const escaped = escapeLuaString(normalizedCommand)

  // For simple commands, use vim.cmd("command")
  // For commands that may need dynamic values, this could be extended
  const code = `vim.cmd("${escaped}")`

  return {
    nodeId,
    nodeType: 'action:run-action',
    code: [code],
    localVars: [],
    inputBindings: {},
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Generate vim.api.nvim_feedkeys() call for key sequences.
 */
function generateFeedKeys(
  nodeId: string,
  keys: string,
  indentLevel: number,
): CompilationUnit {
  // Escape the keys for Lua string
  const escaped = escapeLuaString(keys)

  // Use vim.keycode to handle special keys like <CR>, <Esc>, etc.
  // Mode "m" = remap (let mappings apply), false = don't insert into typeahead buffer
  const code = `vim.api.nvim_feedkeys(vim.keycode("${escaped}"), "m", false)`

  return {
    nodeId,
    nodeType: 'action:run-action',
    code: [code],
    localVars: [],
    inputBindings: {},
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Escape a string for use in a Lua double-quoted string literal.
 */
function escapeLuaString(value: string): string {
  return (
    value
      // Backslash must be escaped first
      .replace(/\\/g, '\\\\')
      // Double quote
      .replace(/"/g, '\\"')
      // Newlines
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      // Tabs
      .replace(/\t/g, '\\t')
  )
}
