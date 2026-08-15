// ============================================
// Check 7: Invalid Config Values
// ============================================

import {
  isValidAutocmdEventName,
  normalizeAutocmdEventNames,
} from '@/shared/data/neovim/events'
import { getOptionDefinition } from '@/shared/lib/neovim-options/catalog'
import type { GraphNode } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

/**
 * Check ID constant for invalid config values.
 */
export const INVALID_CONFIG_CHECK_ID = 'check-invalid-config'

/**
 * Get display name for a node.
 */
function getNodeDisplayName(node: GraphNode): string {
  const displayName =
    'displayName' in node.data
      ? (node.data.displayName as string | undefined)
      : undefined
  return displayName?.trim() || node.id.slice(0, 8)
}

/**
 * Validate a key sequence format.
 * Basic validation: must not be empty and should contain valid key notation.
 */
function validateKeySequence(sequence: string): string | null {
  const trimmed = sequence.trim()
  if (trimmed.length === 0) {
    return 'Key sequence cannot be empty'
  }

  // Check for unbalanced angle brackets (common mistake)
  const openBrackets = (trimmed.match(/</g) || []).length
  const closeBrackets = (trimmed.match(/>/g) || []).length
  if (openBrackets !== closeBrackets) {
    return 'Unbalanced angle brackets in key sequence'
  }

  return null
}

/**
 * Validate autocmd events.
 */
function validateAutocmdEvents(events: readonly string[]): string | null {
  const normalizedEvents = normalizeAutocmdEventNames(events)

  if (normalizedEvents.length === 0) {
    return 'No autocmd events selected. Select at least one event before generating.'
  }

  const invalidEvents: string[] = []
  for (const event of events) {
    const normalizedEvent = event.trim()
    if (normalizedEvent.length === 0) {
      continue
    }
    if (!isValidAutocmdEventName(normalizedEvent)) {
      invalidEvents.push(event)
    }
  }

  if (invalidEvents.length > 0) {
    return `Unknown autocmd events: ${invalidEvents.join(', ')}`
  }

  return null
}

/**
 * Check for invalid config values.
 *
 * - Schema validation for plugin configs
 * - Keymap format validation (valid mode, lhs syntax)
 * - Option name validation (exists in Neovim)
 * - Autocmd event validation (valid event names)
 *
 * Complexity: O(N) where N = total nodes across all graphs
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ordered multi-graph diagnostic emission with per-node-kind validation branches; decomposition risks reordering or dropping correlated warnings
export function checkInvalidConfig(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    // Skip disabled graphs
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    // Build a set of "nodeId:portId" keys for all outbound edge sources.
    // Used to check whether a node's output port is actually connected.
    const connectedOutboundPorts = new Set<string>()
    for (const edge of graph.edges) {
      connectedOutboundPorts.add(`${edge.source}:${edge.sourcePort}`)
    }

    for (const node of graph.nodes) {
      const nodeName = getNodeDisplayName(node)

      switch (node.data.nodeType) {
        case 'action': {
          const actionConfig = node.data.actionConfig

          switch (actionConfig.actionConfigType) {
            case 'set-option': {
              // Validate option name exists
              const optionName = actionConfig.optionName.trim()
              if (optionName.length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_EMPTY_OPTION_NAME',
                  category: 'config',
                  message: `Node "${nodeName}" has empty option name`,
                  details:
                    'The option name must be specified for Set Option actions.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Enter a valid Neovim option name (e.g., "number", "tabstop")',
                    'Use the option picker to select from known options',
                  ],
                })
              } else {
                const optionDef = getOptionDefinition(optionName)
                if (optionDef === null) {
                  collector.addWarning({
                    id: 'WARN_CONFIG_UNKNOWN_OPTION',
                    category: 'config',
                    message: `Node "${nodeName}" uses unknown option "${optionName}"`,
                    details: `The option "${optionName}" is not in the known Neovim options catalog. It may be a custom option or a typo.`,
                    source: {
                      graphId: graph.id,
                      nodeId: node.id,
                      nodeType: 'action',
                    },
                    suggestions: [
                      'Verify the option name is spelled correctly',
                      'Check that the option exists in your Neovim version',
                      'Consider using a variable instead of an unknown option',
                    ],
                  })
                }
              }
              break
            }

            case 'set-keymap': {
              // Validate key sequence
              const keyError = validateKeySequence(actionConfig.keySequence)
              if (keyError) {
                collector.addError({
                  id: 'ERR_CONFIG_INVALID_KEYMAP',
                  category: 'config',
                  message: `Node "${nodeName}" has invalid key sequence`,
                  details: keyError,
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Use valid key notation (e.g., "<leader>", "<C-s>", "<Esc>")',
                    'Ensure angle brackets are balanced',
                    'Refer to :help key-notation in Neovim',
                  ],
                })
              }

              // Validate modes
              if (actionConfig.modes.length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_NO_KEYMAP_MODES',
                  category: 'config',
                  message: `Node "${nodeName}" has no keymap modes selected`,
                  details: 'At least one mode must be selected for the keymap.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Select at least one mode (n = normal, i = insert, v = visual)',
                    'Use "n" for normal mode if unsure',
                  ],
                })
              }

              // Validate command/action
              if (actionConfig.command.trim().length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_EMPTY_KEYMAP_COMMAND',
                  category: 'config',
                  message: `Node "${nodeName}" has empty command`,
                  details:
                    'The command or action to execute must be specified.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Enter a valid Vim command (e.g., ":w", ":q", "<cmd>echo hello<CR>")',
                    'Use <cmd> prefix for Lua function calls',
                  ],
                })
              }
              break
            }

            case 'create-autocmd': {
              // Validate events
              const eventsError = validateAutocmdEvents(actionConfig.events)
              if (eventsError) {
                collector.addError({
                  id: 'ERR_CONFIG_INVALID_AUTOCDM_EVENTS',
                  category: 'config',
                  message: `Node "${nodeName}" has invalid autocmd event configuration`,
                  details: eventsError,
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Select at least one event when the event list is empty',
                    'Use known Neovim autocmd events (e.g., "BufEnter", "FileType")',
                    'Check :help autocmd-events in Neovim for valid events',
                  ],
                })
              }

              // Validate callback or output connection
              const hasCallback = actionConfig.callbackLua.trim().length > 0
              // Suppress the warning when the "on-event" output port is connected,
              // because that's the correct pattern for driving autocmd behavior
              // from the graph (the callback is generated from the connected nodes).
              const hasOnEventConnection = connectedOutboundPorts.has(
                `${node.id}:on-event`,
              )
              if (!hasCallback && !hasOnEventConnection) {
                collector.addWarning({
                  id: 'WARN_CONFIG_EMPTY_AUTOCDM_CALLBACK',
                  category: 'config',
                  message: `Node "${nodeName}" has empty autocmd callback`,
                  details:
                    'The autocmd has no callback Lua code. It will be registered but do nothing when triggered (unless the On Event port is connected).',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Add Lua code to the callback field',
                    'Connect the "On Event" output port to define behavior',
                    'Remove the autocmd if it is not needed',
                  ],
                })
              }
              break
            }

            case 'set-variable': {
              // Validate variable name
              const varName = actionConfig.variableName.trim()
              if (varName.length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_EMPTY_VARIABLE_NAME',
                  category: 'config',
                  message: `Node "${nodeName}" has empty variable name`,
                  details: 'The variable name must be specified.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Enter a valid variable name (e.g., "my_var", "config")',
                    'Use snake_case naming convention for Lua variables',
                  ],
                })
              }
              break
            }

            case 'get-variable': {
              // Validate variable name
              const varName = actionConfig.variableName.trim()
              if (varName.length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_EMPTY_VARIABLE_NAME',
                  category: 'config',
                  message: `Node "${nodeName}" has empty variable name`,
                  details: 'The variable name must be specified.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: ['Enter a valid variable name to retrieve'],
                })
              }
              break
            }

            case 'set-highlight': {
              // Validate highlight group name
              const groupName = actionConfig.groupName.trim()
              if (groupName.length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_EMPTY_HIGHLIGHT_GROUP',
                  category: 'config',
                  message: `Node "${nodeName}" has empty highlight group name`,
                  details: 'The highlight group name must be specified.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Enter a valid highlight group name (e.g., "Normal", "Comment")',
                    'Use :highlight in Neovim to see existing groups',
                  ],
                })
              }

              // Warn if no colors are set
              const hasForeground = actionConfig.foreground.trim().length > 0
              const hasBackground = actionConfig.background.trim().length > 0
              const hasStyle =
                actionConfig.bold ||
                actionConfig.italic ||
                actionConfig.underline

              if (!hasForeground && !hasBackground && !hasStyle) {
                collector.addWarning({
                  id: 'WARN_CONFIG_NO_HIGHLIGHT_ATTRIBUTES',
                  category: 'config',
                  message: `Node "${nodeName}" has no highlight attributes set`,
                  details:
                    'The highlight group has no foreground color, background color, or text style defined.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Set a foreground color (e.g., "#ff0000" or "red")',
                    'Set a background color',
                    'Enable text styles (bold, italic, underline)',
                  ],
                })
              }
              break
            }

            case 'run-action': {
              // Validate action
              if (actionConfig.action.trim().length === 0) {
                collector.addError({
                  id: 'ERR_CONFIG_EMPTY_ACTION',
                  category: 'config',
                  message: `Node "${nodeName}" has empty action`,
                  details: 'The action to run must be specified.',
                  source: {
                    graphId: graph.id,
                    graphName: graph.name,
                    nodeId: node.id,
                    nodeType: 'action',
                  },
                  suggestions: [
                    'Select an action from the catalog or enter a custom command',
                  ],
                })
              }
              break
            }
          }
          break
        }

        case 'loop': {
          // Validate iterator variable name
          const iterVar = node.data.iteratorVariable.trim()
          if (iterVar.length === 0) {
            collector.addError({
              id: 'ERR_CONFIG_EMPTY_ITERATOR_VAR',
              category: 'config',
              message: `Node "${nodeName}" has empty iterator variable`,
              details:
                'The iterator variable name must be specified for the loop.',
              source: {
                graphId: graph.id,
                graphName: graph.name,
                nodeId: node.id,
                nodeType: 'loop',
              },
              suggestions: [
                'Enter a valid variable name (e.g., "i", "item", "key")',
              ],
            })
          }
          break
        }
      }
    }
  }
}
