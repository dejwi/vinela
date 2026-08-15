// src/features/lua-generator/generators/nodes/action/call-function.ts
// Call Function Action Node Generator
// Generates calls to Lua or Vim functions

import type { ActionNodeData, GraphNode } from '@/shared/types'
import { createNodeDiagnostic, DiagnosticCodes } from '../shared/diagnostics'
import type { CompilationUnit, GenerationContext } from '../types'
import { createEmptyUnit } from '../types'

/**
 * Function context type for call-function.
 * - 'lua': Call a Lua function directly (my_function(args))
 * - 'vim': Call a Vim function via vim.fn (vim.fn.function_name(args))
 */
export type FunctionContext = 'lua' | 'vim'

/**
 * Config type for call-function action.
 * This is a requested feature that may be used as an alias for run-function
 * or as a separate node type in the future.
 */
export interface CallFunctionActionConfig {
  readonly actionConfigType: 'call-function'
  functionName: string
  arguments: unknown[]
  context: FunctionContext
}

/**
 * Type guard for CallFunctionActionConfig.
 */
function isCallFunctionConfig(
  config: unknown,
): config is CallFunctionActionConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }
  const record = config as Record<string, unknown>
  return (
    record['actionConfigType'] === 'call-function' &&
    typeof record['functionName'] === 'string'
  )
}

/**
 * Generate Lua code for call-function action node.
 *
 * Config:
 * - functionName: The name of the function to call
 * - arguments: Array of argument expressions (strings that are emitted as-is)
 * - context: 'lua' for Lua functions, 'vim' for Vim functions
 *
 * Examples:
 * ```lua
 * -- Lua function:
 * my_function(arg1, arg2)
 *
 * -- Vim function:
 * vim.fn.function_name(arg1, arg2)
 * ```
 */
export function generateCallFunction(
  node: GraphNode<ActionNodeData>,
  context: GenerationContext,
): CompilationUnit {
  // Type guard to ensure this is a call-function config
  const rawConfig = node.data.actionConfig
  if (!isCallFunctionConfig(rawConfig)) {
    context.emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'error',
        'Call Function node has invalid configuration',
        context.graphId,
        node.id,
        'action:call-function',
        'The actionConfig must be a valid CallFunctionActionConfig.',
      ),
    )
    return createEmptyUnit(node.id, 'action:call-function', context.indentLevel)
  }

  // Now TypeScript knows rawConfig is CallFunctionActionConfig
  const config: CallFunctionActionConfig = rawConfig
  const { graphId, indentLevel, toLuaLiteral, emitDiagnostic } = context

  // Validate function name
  const functionName = config.functionName?.trim() ?? ''
  if (functionName.length === 0) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'error',
        'Call Function node requires a function name',
        graphId,
        node.id,
        'action:call-function',
        'Provide a function name like "my_function" or "has".',
      ),
    )
    return createEmptyUnit(node.id, 'action:call-function', indentLevel)
  }

  // Validate context
  const ctx: FunctionContext =
    config.context === 'vim' ? 'vim' : config.context === 'lua' ? 'lua' : 'lua'

  // Process arguments
  const args: string[] = []
  if (config.arguments && Array.isArray(config.arguments)) {
    for (const arg of config.arguments) {
      if (typeof arg === 'string') {
        args.push(arg)
      } else {
        // Serialize non-string arguments
        args.push(toLuaLiteral(arg))
      }
    }
  }

  // Warn about potentially unknown functions
  if (!isKnownFunction(functionName, ctx)) {
    emitDiagnostic(
      createNodeDiagnostic(
        DiagnosticCodes.INVALID_CONFIG,
        'warning',
        `Function "${functionName}" may not exist`,
        graphId,
        node.id,
        'action:call-function',
        ctx === 'vim'
          ? `Check that vim.fn.${functionName} exists in Neovim.`
          : `Ensure that ${functionName} is defined before this call.`,
      ),
    )
  }

  // Generate the call
  const callCode = buildFunctionCall(functionName, args, ctx)

  return {
    nodeId: node.id,
    nodeType: 'action:call-function',
    code: [callCode],
    localVars: [],
    inputBindings: {},
    outputBindings: { done: 'nil' },
    indentLevel,
  }
}

/**
 * Build the function call code.
 */
function buildFunctionCall(
  functionName: string,
  args: string[],
  context: FunctionContext,
): string {
  const argsStr = args.join(', ')

  if (context === 'vim') {
    // Vim function: vim.fn.function_name(args)
    return `vim.fn.${functionName}(${argsStr})`
  }

  // Lua function: function_name(args)
  return `${functionName}(${argsStr})`
}

/**
 * Check if a function is in the known function catalog.
 * This is a basic heuristic - not exhaustive.
 */
function isKnownFunction(
  functionName: string,
  context: FunctionContext,
): boolean {
  if (context === 'vim') {
    // Common vim functions
    const knownVimFunctions = new Set([
      'has',
      'exists',
      'expand',
      'fnamemodify',
      'getcwd',
      'glob',
      'globpath',
      'hostname',
      'isdirectory',
      'filereadable',
      'filewritable',
      'getline',
      'setline',
      'append',
      'argc',
      'argv',
      'bufexists',
      'buflisted',
      'bufloaded',
      'bufname',
      'bufnr',
      'winnr',
      'winbufnr',
      'tabpagenr',
      'input',
      'inputlist',
      'inputsecret',
      'confirm',
      'executable',
      'system',
      'systemlist',
      'tempname',
      'stdpath',
      'haslocaldir',
      'getfsize',
      'getftime',
      'strftime',
      'strptime',
      'reltime',
      'reltimestr',
      'localtime',
      'getreg',
      'setreg',
      'getregtype',
      'reg_recording',
      'reg_executing',
      'shiftwidth',
      'col',
      'virtcol',
      'line',
      'winline',
      'indent',
      'cindent',
      'lispindent',
      'foldlevel',
      'foldclosed',
      'foldclosedend',
      'foldtext',
      'foldtextresult',
      'charidx',
      'byteidx',
      'byteidxcomp',
      'str2nr',
      'str2float',
      'printf',
      'sprintf',
      'match',
      'matchend',
      'matchstr',
      'matchstrpos',
      'matchlist',
      'split',
      'join',
      'escape',
      'shellescape',
      'fnameescape',
      'tr',
      'strtrans',
      'tolower',
      'toupper',
    ])

    return knownVimFunctions.has(functionName)
  }

  // For Lua functions, we can't know all possibilities
  // Assume valid if it looks like a valid identifier
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)
}

/**
 * NodeGenerator-compatible export for call-function.
 */
export const callFunctionGenerator = {
  generate: generateCallFunction,
}
