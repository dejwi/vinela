// src/features/lua-generator/generators/nodes/builtin/open-file.ts
// buffers.open-file builtin generator — opens a file via vim.cmd

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createUnit } from '../types'

/** Valid open modes for the open-file builtin */
type OpenMode = 'edit' | 'split' | 'vsplit' | 'tabedit'

function isValidMode(value: string): value is OpenMode {
  return (
    value === 'edit' ||
    value === 'split' ||
    value === 'vsplit' ||
    value === 'tabedit'
  )
}

/**
 * Builtin generator for buffers.open-file.
 *
 * Config:
 * - path: string (required)
 * - mode: 'edit' | 'split' | 'vsplit' | 'tabedit' (default: 'edit')
 *
 * Data input ports: `path` (string)
 *
 * Generates:
 * ```lua
 * vim.cmd('edit ' .. vim.fn.fnameescape("/path/to/file"))
 * vim.cmd('vsplit ' .. vim.fn.fnameescape(path_var))
 * ```
 */
export const openFileGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data
    const {
      inputBindings,
      indentLevel,
      toLuaLiteral,
      emitDiagnostic,
      graphId,
    } = context

    // Resolve path: connected data port takes priority over config
    const connectedPath = inputBindings['path']
    const configPath = typeof config['path'] === 'string' ? config['path'] : ''

    const hasConnectedPath =
      connectedPath !== undefined && connectedPath.length > 0
    const hasConfigPath = configPath.length > 0

    // Warn if path is empty and no data connection
    if (!hasConnectedPath && !hasConfigPath) {
      emitDiagnostic({
        id: 'builtin-open-file-missing-path',
        severity: 'warning',
        category: 'config',
        message: 'Open File builtin has no path specified',
        details: `Node '${nodeId}' will open an empty path. Connect a path input or configure a path value.`,
        source: {
          graphId,
          nodeId,
          nodeType: 'builtin',
        },
        suggestions: [
          'Connect a string value to the path input port',
          'Set a file path in the node configuration',
        ],
      })
    }

    // Build path expression
    const pathExpr = hasConnectedPath ? connectedPath : toLuaLiteral(configPath)

    // Resolve open mode
    const configMode =
      typeof config['mode'] === 'string' ? config['mode'] : 'edit'
    const mode: OpenMode = isValidMode(configMode) ? configMode : 'edit'

    // Generate: vim.cmd('<mode> ' .. vim.fn.fnameescape(<path>))
    const call = `vim.cmd('${mode} ' .. vim.fn.fnameescape(${pathExpr}))`

    return createUnit(nodeId, 'builtin:buffers.open-file', [call], indentLevel)
  },
}
