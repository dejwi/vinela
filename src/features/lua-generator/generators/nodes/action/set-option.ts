// Set Option Action Node Generator
// Generates Lua code for vim.opt/vim.opt_local assignments

import type {
  ActionNodeDataFor,
  GraphNode,
  SetOptionValueConfig,
} from '@/shared/types'
import { createNodeDiagnostic } from '../shared/diagnostics'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Generate Lua code for a set-option action node.
 *
 * Generates vim.opt/vim.opt_local assignments based on scope configuration.
 *
 * Examples:
 * - vim.opt.number = true
 * - vim.opt_local.number = false
 * - vim.opt.tabstop = 4
 */
export function generateSetOption(
  node: GraphNode<ActionNodeDataFor<'set-option'>>,
  context: GenerationContext,
): CompilationUnit {
  const config = node.data.actionConfig
  const { graphId, indentLevel, inputBindings, toLuaLiteral, emitDiagnostic } =
    context

  // Validate config
  if (!config.optionName || config.optionName.trim() === '') {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        'Set Option node requires an option name',
        graphId,
        node.id,
        'action:set-option',
        'Provide an option name like "number", "relativenumber", or "tabstop"',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-option', indentLevel)
  }

  const optionName = config.optionName.trim()

  // Resolve value - connected input takes precedence over config
  const valueExpression = resolveValueExpression(
    config.valueConfig,
    inputBindings['value'],
    toLuaLiteral,
  )

  if (valueExpression === null) {
    emitDiagnostic(
      createNodeDiagnostic(
        'node-invalid-config',
        'error',
        `Set Option node for '${optionName}' has no value configured`,
        graphId,
        node.id,
        'action:set-option',
        'Connect a value input or configure a value in the node settings',
      ),
    )
    return createEmptyUnit(node.id, 'action:set-option', indentLevel)
  }

  // Generate the assignment based on scope
  const target = config.scope === 'local' ? 'vim.opt_local' : 'vim.opt'
  const code = `${target}.${optionName} = ${valueExpression}`

  return {
    nodeId: node.id,
    nodeType: 'action:set-option',
    code: [code],
    localVars: [],
    inputBindings: { value: valueExpression },
    outputBindings: {},
    indentLevel,
  }
}

/**
 * Resolve the value expression for set-option.
 * Priority: connected input > config value
 */
function resolveValueExpression(
  valueConfig: SetOptionValueConfig,
  connectedValue: string | undefined,
  toLuaLiteral: (value: unknown) => string,
): string | null {
  // Connected input takes precedence
  if (connectedValue !== undefined && connectedValue !== '') {
    return connectedValue
  }

  // Fall back to config value
  if (valueConfig.valueMode === 'suggested') {
    return toLuaLiteral(valueConfig.suggestedValue)
  }

  // Raw mode - emit the expression as-is
  if (valueConfig.valueMode === 'raw') {
    const raw = valueConfig.rawValue.trim()
    if (raw === '') {
      return null
    }
    return raw
  }

  return null
}
