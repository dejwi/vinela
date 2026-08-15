// src/features/lua-generator/generators/nodes/builtin/check-feature.ts
// Check Feature builtin - tests for Neovim feature availability

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createEmptyUnit, createUnit } from '../types'

/**
 * Valid Neovim feature names for vim.fn.has()
 * @see :help feature-list
 */
const VALID_FEATURES = new Set([
  // GUI features
  'gui_running',
  'gui',
  // Lua features
  'lua',
  'nvim',
  // Clipboard
  'clipboard',
  // Language support
  'python',
  'python3',
  'ruby',
  'perl',
  'tcl',
  // Terminal
  'ttyin',
  'ttyout',
  // Misc
  'syntax',
  'conceal',
  'reltime',
  'float',
  'job',
  'channel',
  'textobjects',
  'quickfix',
  'cscope',
  'terminfo',
  'builtin_terms',
  'iconv',
  'xfontset',
  'xim',
  'xpm',
  'xpm_w32',
  'arabic',
  'farsi',
  'hangul_input',
  'multi_byte',
  'multi_byte_ime',
  'winaltkeys',
])

/**
 * Builtin generator for checking Neovim features.
 *
 * Config:
 * - feature: string (required) - The feature name to check
 *
 * Generates:
 * ```lua
 * local <var> = vim.fn.has('<feature>') == 1
 * ```
 */
export const checkFeatureGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data

    // Extract feature name from config
    const feature =
      typeof config['feature'] === 'string'
        ? (config['feature'] as string).trim()
        : ''

    // Validate: Feature name is required
    if (feature.length === 0) {
      context.emitDiagnostic({
        id: 'builtin-check-feature-missing',
        severity: 'error',
        category: 'config',
        message: 'Check feature builtin has no feature specified',
        details: `Node '${nodeId}' is a check feature builtin but has no feature name configured.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: ['Set the feature name (e.g., "clipboard", "python3")'],
      })
      return createEmptyUnit(nodeId, 'builtin', context.indentLevel)
    }

    // Warning: Unknown feature
    if (!VALID_FEATURES.has(feature.toLowerCase())) {
      context.emitDiagnostic({
        id: 'builtin-check-feature-unknown',
        severity: 'warning',
        category: 'config',
        message: `Unknown feature: '${feature}'`,
        details: `Feature '${feature}' is not a known Neovim feature. The check may always return false.`,
        source: {
          graphId: context.graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Check :help feature-list for valid feature names',
          'Common features: clipboard, python3, nvim, gui_running',
        ],
      })
    }

    // Generate a local variable name for the result
    const varName = context.getVariableName('has')

    // Escape the feature name for Lua string literal
    const escapedFeature = feature.replace(/'/g, "\\'")

    // Generate: local varName = vim.fn.has('feature') == 1
    const code = `local ${varName} = vim.fn.has('${escapedFeature}') == 1`

    return createUnit(nodeId, 'builtin', [code], context.indentLevel, [varName])
  },
}
