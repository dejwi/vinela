// src/features/lua-generator/generators/nodes/advanced/plugin-action.ts
// Plugin Action node generator - LEGACY/DEPRECATED
//
// PluginAction nodes are deprecated in Step 10. Plugin configuration
// should be done in the Plugin section (Domain 4) instead.
// This generator emits a diagnostic and generates no Lua code.

import type { GraphNode } from '@/shared/types'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

interface LegacyPluginActionData {
  readonly nodeType: 'plugin-action'
  readonly pluginId?: string
  readonly displayName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Normalize persisted legacy plugin-action node data.
 * Invalid optional label fields are omitted rather than coerced.
 */
export function readLegacyPluginActionData(
  data: unknown,
): LegacyPluginActionData | undefined {
  if (!isRecord(data) || data['nodeType'] !== 'plugin-action') {
    return undefined
  }

  const displayName =
    typeof data['displayName'] === 'string' ? data['displayName'] : undefined
  const pluginId =
    typeof data['pluginId'] === 'string' ? data['pluginId'] : undefined

  if (displayName !== undefined && pluginId !== undefined) {
    return { nodeType: 'plugin-action', displayName, pluginId }
  }
  if (displayName !== undefined) {
    return { nodeType: 'plugin-action', displayName }
  }
  if (pluginId !== undefined) {
    return { nodeType: 'plugin-action', pluginId }
  }
  return { nodeType: 'plugin-action' }
}

/**
 * Structural identity check for legacy plugin-action node data stored on graphs
 * that predate removal from the canonical NodeData union.
 */
export function isLegacyPluginActionData(data: unknown): boolean {
  return readLegacyPluginActionData(data) !== undefined
}

function resolveLegacyPluginActionLabel(data: LegacyPluginActionData): string {
  const displayName = data.displayName?.trim()
  if (displayName !== undefined && displayName.length > 0) {
    return displayName
  }
  const pluginId = data.pluginId?.trim()
  if (pluginId !== undefined && pluginId.length > 0) {
    return pluginId
  }
  return 'unnamed'
}

/**
 * Generate code for a legacy Plugin Action node.
 *
 * PluginAction is deprecated. Most plugin configurations should go in the
 * Plugin section (Domain 4) instead of being node-based.
 *
 * This generator:
 * 1. Emits a hard diagnostic error about the deprecated node type
 * 2. Returns an empty compilation unit (no Lua code generated)
 *
 * No runtime migration is performed. Users must manually recreate these
 * nodes as appropriate (usually as Plugin section entries).
 */
export function generatePluginActionCode(
  node: GraphNode,
  context: GenerationContext,
): CompilationUnit {
  const nodeId = node.id
  const legacyData = readLegacyPluginActionData(node.data)
  const label =
    legacyData !== undefined
      ? resolveLegacyPluginActionLabel(legacyData)
      : 'unnamed'

  // Emit hard diagnostic about deprecated node type
  context.emitDiagnostic({
    id: 'plugin-action-deprecated',
    severity: 'error',
    category: 'config',
    message: `Node '${label}' uses deprecated plugin-action type`,
    details:
      `Node '${nodeId}' uses the deprecated 'plugin-action' node type. ` +
      `PluginAction nodes are no longer supported. ` +
      `Please delete this node and re-create the configuration in the Plugin section ` +
      `or use a 'run-function' node for plugin-specific actions.`,
    source: {
      graphId: context.graphId,
      nodeId,
      nodeType: 'plugin-action',
    },
    suggestions: [
      'Delete this node and configure the plugin in the Plugins panel instead',
      'For plugin function calls, use a "run-function" node',
      'For custom Lua code, use a "code-block" node',
    ],
  })

  // Return empty unit - no Lua code generated for deprecated nodes
  return createEmptyUnit(nodeId, 'plugin-action', context.indentLevel)
}

/**
 * Type guard to check if a node is a PluginAction node.
 * Used by the dispatcher to route to this generator.
 * Note: This checks for the legacy 'plugin-action' node type which is
 * NOT part of the canonical NodeData union.
 */
export function isPluginActionNode(node: GraphNode): boolean {
  return isLegacyPluginActionData(node.data)
}
