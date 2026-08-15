// src/features/lua-generator/generators/nodes/builtin/ui-notify.ts
// ui.notify builtin generator — generates vim.notify() calls

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'
import { createUnit } from '../types'

/** Map ui.notify level config values to vim.log.levels.* constants */
function levelToVimConstant(level: string): string {
  switch (level) {
    case 'warn':
      return 'vim.log.levels.WARN'
    case 'error':
      return 'vim.log.levels.ERROR'
    case 'debug':
      return 'vim.log.levels.DEBUG'
    case 'trace':
      return 'vim.log.levels.TRACE'
    default:
      return 'vim.log.levels.INFO'
  }
}

/**
 * Builtin generator for ui.notify (vim.notify).
 *
 * Config:
 * - message: string (required, default: 'Configuration updated')
 * - level: 'info' | 'warn' | 'error' | 'debug' | 'trace' (default: 'info')
 * - title: string (optional)
 *
 * Data input ports: `message` (string), `title` (string)
 *
 * Generates:
 * ```lua
 * vim.notify("Configuration updated", vim.log.levels.INFO)
 * vim.notify("msg", vim.log.levels.WARN, { title = "My Title" })
 * ```
 */
export const uiNotifyGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data
    const { inputBindings, indentLevel, toLuaLiteral } = context

    // Resolve message: connected data port takes priority over config
    const connectedMessage = inputBindings['message']
    const configMessage =
      typeof config['message'] === 'string'
        ? config['message']
        : 'Configuration updated'
    const messageExpr =
      connectedMessage !== undefined && connectedMessage.length > 0
        ? connectedMessage
        : toLuaLiteral(configMessage)

    // Resolve level from config
    const configLevel =
      typeof config['level'] === 'string' ? config['level'] : 'info'
    const levelExpr = levelToVimConstant(configLevel)

    // Resolve title: connected data port takes priority over config
    const connectedTitle = inputBindings['title']
    const configTitle =
      typeof config['title'] === 'string' ? config['title'] : ''
    const hasTitle =
      (connectedTitle !== undefined && connectedTitle.length > 0) ||
      configTitle.length > 0
    const titleExpr =
      connectedTitle !== undefined && connectedTitle.length > 0
        ? connectedTitle
        : toLuaLiteral(configTitle)

    // Build the vim.notify() call
    let call: string
    if (hasTitle) {
      call = `vim.notify(${messageExpr}, ${levelExpr}, { title = ${titleExpr} })`
    } else {
      call = `vim.notify(${messageExpr}, ${levelExpr})`
    }

    return createUnit(nodeId, 'builtin:ui.notify', [call], indentLevel)
  },
}
