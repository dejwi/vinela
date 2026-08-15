// src/features/lua-generator/generators/nodes/action/set-highlight.ts
// Set Highlight Action Node Generator
// Generates vim.api.nvim_set_hl calls with merge semantics

import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import { createNodeDiagnostic, DiagnosticCodes } from '../shared/diagnostics'
import { emitInlineTable } from '../shared/lua-emit'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Generate Lua code for set-highlight action node.
 *
 * Uses merge semantics: later calls override earlier for the same group.
 * First fetches existing highlight, then merges with user values.
 *
 * Example output:
 * ```lua
 * -- With colors:
 * local ok, existing = pcall(vim.api.nvim_get_hl, 0, { name = "Normal", link = false })
 * vim.api.nvim_set_hl(0, "Normal", vim.tbl_extend("force", existing or {}, { fg = "#ffffff", bg = "#000000" }))
 *
 * -- With link:
 * vim.api.nvim_set_hl(0, "Normal", { link = "OtherGroup" })
 * ```
 */
export function generateSetHighlight(
  node: GraphNode<ActionNodeDataFor<'set-highlight'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, toLuaLiteral, emitDiagnostic } = context

  // Validate group name
  const groupName = config.groupName.trim()
  if (groupName.length === 0) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'error',
        'Set Highlight node requires a highlight group name',
        graphId,
        node.id,
        'action:set-highlight',
        'Provide a highlight group name like "Normal", "Comment", "Keyword", etc.',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-highlight', indentLevel)
  }

  // Build user values table
  const userValues: Record<string, string | undefined> = {}

  // Colors
  if (config.foreground && config.foreground.trim().length > 0) {
    const fg = config.foreground.trim()
    if (!isValidColor(fg)) {
      emitDiagnostic(
        createNodeDiagnostic(
          DiagnosticCodes.INVALID_CONFIG,
          'warning',
          `Foreground color "${fg}" may be invalid`,
          graphId,
          node.id,
          'action:set-highlight',
          'Colors should be hex format like "#ffffff" or named colors like "red".',
        ),
      )
    }
    userValues['fg'] = toLuaLiteral(fg)
  }

  if (config.background && config.background.trim().length > 0) {
    const bg = config.background.trim()
    if (!isValidColor(bg)) {
      emitDiagnostic(
        createNodeDiagnostic(
          DiagnosticCodes.INVALID_CONFIG,
          'warning',
          `Background color "${bg}" may be invalid`,
          graphId,
          node.id,
          'action:set-highlight',
          'Colors should be hex format like "#000000" or named colors like "black".',
        ),
      )
    }
    userValues['bg'] = toLuaLiteral(bg)
  }

  // Styles
  if (config.bold) {
    userValues['bold'] = 'true'
  }
  if (config.italic) {
    userValues['italic'] = 'true'
  }
  if (config.underline) {
    userValues['underline'] = 'true'
  }

  // Check if we have any values to set
  const hasUserValues = Object.keys(userValues).length > 0

  if (!hasUserValues) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'warning',
        `Set Highlight node for '${groupName}' has no highlight attributes`,
        graphId,
        node.id,
        'action:set-highlight',
        'Configure at least one attribute: foreground, background, bold, italic, or underline.',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-highlight', indentLevel)
  }

  // Generate code with merge semantics
  const code = buildHighlightWithMerge(groupName, userValues)

  return {
    nodeId: node.id,
    nodeType: 'action:set-highlight',
    code: code.split('\n'),
    localVars: [],
    inputBindings: {},
    outputBindings: { done: 'nil' },
    indentLevel,
  }
}

/**
 * Build highlight code with merge semantics.
 * Fetches existing highlight and merges with user values.
 */
function buildHighlightWithMerge(
  groupName: string,
  userValues: Record<string, string | undefined>,
): string {
  const userTable = emitInlineTable(userValues)

  // Use merge pattern for proper override semantics
  // local ok, existing = pcall(vim.api.nvim_get_hl, 0, { name = "Group", link = false })
  // vim.api.nvim_set_hl(0, "Group", vim.tbl_extend("force", existing or {}, { ...user values }))

  const existingVar = `_existing_${sanitizeIdentifier(groupName)}`

  // Multi-line version for clarity
  return `local ok, ${existingVar} = pcall(vim.api.nvim_get_hl, 0, { name = ${JSON.stringify(groupName)}, link = false })
vim.api.nvim_set_hl(0, ${JSON.stringify(groupName)}, vim.tbl_extend("force", ${existingVar} or {}, ${userTable}))`
}

/**
 * Basic color validation.
 * Accepts hex colors (#rgb, #rrggbb) and named colors.
 */
function isValidColor(color: string): boolean {
  const trimmed = color.trim()

  // Empty is not valid
  if (trimmed.length === 0) {
    return false
  }

  // Hex colors: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    return (
      hex.length === 3 ||
      hex.length === 4 ||
      hex.length === 6 ||
      hex.length === 8
    )
  }

  // Named colors (common ones)
  const namedColors = new Set([
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'gray',
    'grey',
    'orange',
    'purple',
    'pink',
    'brown',
    'lightred',
    'lightgreen',
    'lightyellow',
    'lightblue',
    'lightmagenta',
    'lightcyan',
    'lightgray',
    'lightgrey',
    'darkgray',
    'darkgrey',
    'darkred',
    'darkgreen',
    'darkblue',
    'none',
  ])

  if (namedColors.has(trimmed.toLowerCase())) {
    return true
  }

  // Numbers (terminal colors 0-255)
  const num = Number(trimmed)
  if (!Number.isNaN(num) && num >= 0 && num <= 255) {
    return true
  }

  return false
}

/**
 * Sanitize a string for use in a Lua variable name.
 */
function sanitizeIdentifier(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, '_')
}

/**
 * NodeGenerator-compatible export for set-highlight.
 */
export const setHighlightGenerator = {
  generate: generateSetHighlight,
}
