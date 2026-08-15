// src/features/lua-generator/generators/nodes/run-function.ts
// Run Function node generator — calls core or plugin Lua functions via luaCall template

import { validateTemplate } from '@/shared/lib/lua-template'
import type { GraphNode, RunFunctionNodeData } from '@/shared/types'
import {
  hasResolvedValueForParam,
  normalizeRunFunctionParamDefaults,
  renderRunFunctionLua,
} from '../../utils/run-function-render'
import type { CompilationUnit, GenerationContext, NodeGenerator } from './types'
import { createEmptyUnit } from './types'

/**
 * Node generator for run-function nodes.
 *
 * Resolves input bindings for each param:<name> port,
 * expands the luaCall template, and handles return value binding.
 *
 * Examples:
 * ```lua
 * -- Core function, no params:
 * vim.lsp.buf.hover()
 *
 * -- Plugin function with return value:
 * local result_abc = require('telescope.builtin').find_files({ cwd = "/home" })
 * ```
 */
export const runFunctionGenerator: NodeGenerator<RunFunctionNodeData> = {
  generate(
    node: GraphNode<RunFunctionNodeData>,
    context: GenerationContext,
  ): CompilationUnit {
    const { data, id: nodeId } = node
    const { signature, paramDefaults } = data
    const { graphId, indentLevel, inputBindings, emitDiagnostic } = context

    // Validate: signature must be present (captured at node creation time)
    if (signature === null) {
      emitDiagnostic({
        id: 'run-function-missing-signature',
        severity: 'error',
        category: 'config',
        message: 'Run Function node has no signature captured',
        details: `Node '${nodeId}' was created without a valid function signature. Re-select the function to refresh the signature.`,
        source: {
          graphId,
          nodeId,
          nodeType: 'run-function',
        },
        suggestions: [
          'Open the node properties and re-select the target function',
          'Delete and recreate the run-function node',
        ],
      })
      return createEmptyUnit(nodeId, 'run-function', indentLevel)
    }

    const { params, returns, luaCall } = signature

    // Validate the template against declared params
    const validationResult = validateTemplate(luaCall, params)
    if (!validationResult.valid) {
      emitDiagnostic({
        id: 'run-function-invalid-template',
        severity: 'error',
        category: 'config',
        message: `Run Function node has an invalid luaCall template: ${validationResult.errors.join('; ')}`,
        details: `Node '${nodeId}' template: "${luaCall}"`,
        source: {
          graphId,
          nodeId,
          nodeType: 'run-function',
        },
        suggestions: [
          'The function template may be corrupted — delete and recreate the node',
        ],
      })
      return createEmptyUnit(nodeId, 'run-function', indentLevel)
    }

    // Build connected values map: param:<name> ports → expression
    const connectedValues: Record<string, string> = {}
    for (const param of params) {
      const portId = `param:${param.name}`
      const bound = inputBindings[portId]
      if (bound !== undefined && bound.length > 0) {
        connectedValues[param.name] = bound
      }
    }

    const normalizedDefaultsResult = normalizeRunFunctionParamDefaults({
      params,
      paramDefaults,
      context: {
        ownerKind: 'graph-node',
        ownerLabel: nodeId,
        functionLabel: data.selectedFunctionKey,
      },
    })

    for (const diagnostic of normalizedDefaultsResult.diagnostics) {
      emitDiagnostic({
        id: diagnostic.code,
        severity: diagnostic.severity,
        category: 'config',
        message: diagnostic.message,
        ...(diagnostic.details !== undefined
          ? { details: diagnostic.details }
          : {}),
        source: {
          graphId,
          nodeId,
          nodeType: 'run-function',
          portId: `param:${diagnostic.paramName}`,
        },
        suggestions: [
          'Re-save the node defaults or re-select the function to refresh stale parameter metadata',
        ],
      })
    }

    // Validate required params (no connection and no usable default)
    for (const param of params) {
      const isOptional = param.optional ?? false
      if (isOptional) continue

      if (
        !hasResolvedValueForParam(
          param,
          normalizedDefaultsResult.defaults,
          connectedValues,
        )
      ) {
        emitDiagnostic({
          id: 'run-function-missing-required-param',
          severity: 'error',
          category: 'config',
          message: `Run Function node is missing required parameter '${param.name}'`,
          details: `Node '${nodeId}' calls '${data.selectedFunctionKey}' but parameter '${param.name}' has no connected input or default value.`,
          source: {
            graphId,
            nodeId,
            nodeType: 'run-function',
            portId: `param:${param.name}`,
          },
          suggestions: [
            `Connect a value to the '${param.name}' input port`,
            `Set a default value for '${param.name}' in the node properties`,
          ],
        })
        return createEmptyUnit(nodeId, 'run-function', indentLevel)
      }
    }

    const renderResult = renderRunFunctionLua({
      luaCall,
      params,
      paramDefaults: normalizedDefaultsResult.defaults,
      connectedValues,
    })

    if (!renderResult.success) {
      emitDiagnostic({
        id: 'run-function-render-failed',
        severity: 'error',
        category: 'config',
        message: `Run Function node failed to render template: ${renderResult.error}`,
        details: `Node '${nodeId}' template: "${luaCall}"`,
        source: {
          graphId,
          nodeId,
          nodeType: 'run-function',
        },
        suggestions: ['Delete and recreate the run-function node'],
      })
      return createEmptyUnit(nodeId, 'run-function', indentLevel)
    }

    const luaExpression = renderResult.lua

    // Generate code
    const code: string[] = []
    const localVars: string[] = []
    const outputBindings: Record<string, string> = {}

    if (returns !== 'void') {
      // Assign result to a local variable so downstream nodes can reference it
      const varName = context.getVariableName('result')
      code.push(`local ${varName} = ${luaExpression}`)
      localVars.push(varName)
      outputBindings['result'] = varName
    } else {
      code.push(luaExpression)
    }

    // done output always exists
    outputBindings['done'] = 'nil'

    return {
      nodeId,
      nodeType: 'run-function',
      code,
      localVars,
      inputBindings: { ...connectedValues },
      outputBindings,
      indentLevel,
    }
  },
}
