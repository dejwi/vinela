// src/features/lua-generator/generators/nodes/builtin/prompt.ts
// input.prompt builtin generator — generates vim.fn.input() calls

import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import type {
  CompilationUnit,
  GenerationContext,
  NodeGenerator,
} from '../types'

/**
 * Escape a string value for use as a Lua double-quoted string literal.
 */
function escapeLuaString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Builtin generator for input.prompt.
 *
 * Config:
 * - prompt: string (default: 'Input: ')
 * - defaultValue: string (default: '')
 *
 * Outputs: `value` (string) — the user's input
 *
 * Generates:
 * ```lua
 * local value_abc = vim.fn.input("Input: ", "default")
 * -- or without default:
 * local value_abc = vim.fn.input("Input: ")
 * ```
 */
export const promptGenerator: NodeGenerator<BuiltinNodeData> = {
  generate(
    node: GraphNode<BuiltinNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { config } = data
    const { indentLevel } = context

    // Resolve prompt text from config
    const promptText =
      typeof config['prompt'] === 'string' ? config['prompt'] : 'Input: '

    // Resolve default value from config
    const defaultValue =
      typeof config['defaultValue'] === 'string' ? config['defaultValue'] : ''

    // Generate a unique local variable for the result
    const varName = context.getVariableName('value')

    // Build the vim.fn.input() call
    const promptArg = `"${escapeLuaString(promptText)}"`
    let call: string
    if (defaultValue.length > 0) {
      const defaultArg = `"${escapeLuaString(defaultValue)}"`
      call = `local ${varName} = vim.fn.input(${promptArg}, ${defaultArg})`
    } else {
      call = `local ${varName} = vim.fn.input(${promptArg})`
    }

    return {
      nodeId,
      nodeType: 'builtin:input.prompt',
      code: [call],
      localVars: [varName],
      inputBindings: {},
      outputBindings: {
        value: varName,
        done: 'nil',
      },
      indentLevel,
    }
  },
}
