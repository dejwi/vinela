// src/features/lua-generator/generators/nodes/builtin/check-platform.ts
// Check Platform builtin - detects operating system

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createEmptyUnit, createUnit } from '../types'

/**
 * Valid platform identifiers for vim.fn.has()
 */
const VALID_PLATFORMS = new Set([
  'win32',
  'win64',
  'win32unix',
  'mac',
  'macunix',
  'unix',
  'linux',
  'bsd',
  'sun',
  'vms',
  'haiku',
  'qnx',
  'beos',
  'amiga',
  'os2',
])

/**
 * Builtin generator for checking the operating system platform.
 *
 * Config:
 * - platform: string (required) - The platform to check for
 *
 * Generates:
 * ```lua
 * local <var> = vim.fn.has('<platform>') == 1
 * ```
 */
export const checkPlatformGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data

    // Extract platform from config
    const platform =
      typeof config['platform'] === 'string'
        ? (config['platform'] as string).trim()
        : ''

    // Validate: Platform is required
    if (platform.length === 0) {
      context.emitDiagnostic({
        id: 'builtin-check-platform-missing',
        severity: 'error',
        category: 'config',
        message: 'Check platform builtin has no platform specified',
        details: `Node '${nodeId}' is a check platform builtin but has no platform configured.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Set the platform (e.g., "win32", "mac", "unix", "linux")',
        ],
      })
      return createEmptyUnit(nodeId, 'builtin', context.indentLevel)
    }

    // Warning: Unknown platform
    if (!VALID_PLATFORMS.has(platform.toLowerCase())) {
      context.emitDiagnostic({
        id: 'builtin-check-platform-unknown',
        severity: 'warning',
        category: 'config',
        message: `Unknown platform: '${platform}'`,
        details: `Platform '${platform}' is not a known platform identifier.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Common platforms: win32, mac, macunix, unix, linux',
          'Check :help feature-list for platform identifiers',
        ],
      })
    }

    // Generate a local variable name for the result
    const varName = context.getVariableName('is')

    // Escape the platform for Lua string literal
    const escapedPlatform = platform.replace(/'/g, "\\'")

    // Generate: local varName = vim.fn.has('platform') == 1
    const code = `local ${varName} = vim.fn.has('${escapedPlatform}') == 1`

    return createUnit(nodeId, 'builtin', [code], context.indentLevel, [varName])
  },
}
