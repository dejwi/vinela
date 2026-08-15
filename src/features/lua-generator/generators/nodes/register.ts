import type { GraphNode, NodeData } from '@/shared/types'
import { callFunctionGenerator } from './action/call-function'
import { createAutocmdGenerator } from './action/create-autocmd'
import { getVariableActionGenerator } from './action/get-variable'
import { generateRunAction } from './action/run-command'
import { setHighlightGenerator } from './action/set-highlight'
import { generateSetKeymap } from './action/set-keymap'
import { generateSetOption } from './action/set-option'
import { generateSetVariable } from './action/set-variable'
import { codeBlockGenerator } from './advanced/code-block'
import { graphRefGenerator } from './advanced/graph-ref'
import { generatePluginActionCode } from './advanced/plugin-action'
import { checkFeatureGenerator } from './builtin/check-feature'
import { checkPlatformGenerator } from './builtin/check-platform'
import { delayGenerator } from './builtin/delay'
import { getVariableGenerator } from './builtin/get-variable'
import { openFileGenerator } from './builtin/open-file'
import { promptGenerator } from './builtin/prompt'
import { requireModuleGenerator } from './builtin/require-module'
import { uiNotifyGenerator } from './builtin/ui-notify'
import { callableEntryGenerator } from './callable-entry'
import { conditionGenerator } from './control/condition'
import { loopGenerator } from './control/loop'
import { returnGenerator } from './return'
import { runFunctionGenerator } from './run-function'
import { onStartupGenerator } from './trigger/on-startup'
import type { NodeGenerator } from './types'

const generatorRegistry = new Map<string, NodeGenerator<NodeData>>()

let initialized = false

export function registerGenerator<T extends NodeData>(
  nodeType: string,
  generator: NodeGenerator<T>,
): void {
  generatorRegistry.set(nodeType, generator as NodeGenerator<NodeData>)
}

export function getGenerator(
  nodeType: string,
): NodeGenerator<NodeData> | undefined {
  return generatorRegistry.get(nodeType)
}

export function resolveGeneratorType(node: GraphNode): string {
  switch (node.data.nodeType) {
    case 'trigger':
      return `trigger:${node.data.triggerType}`

    case 'action':
      return `action:${node.data.actionType}`

    case 'builtin': {
      const builtinId = node.data.builtinId.trim()
      if (builtinId.length === 0) {
        return 'builtin'
      }
      return `builtin:${builtinId}`
    }

    case 'condition':
    case 'loop':
    case 'code-block':
    case 'graph-ref':
    case 'run-function':
    case 'callable-entry':
    case 'return':
      return node.data.nodeType
  }
}

export function initializeGenerators(): void {
  if (initialized) {
    return
  }

  initialized = true

  // Trigger
  registerGenerator('trigger:startup', onStartupGenerator)
  registerGenerator('trigger:on-startup', onStartupGenerator)
  registerGenerator('trigger', onStartupGenerator)
  registerGenerator('onStartup', onStartupGenerator)

  // Control flow
  registerGenerator('condition', conditionGenerator)
  registerGenerator('loop', loopGenerator)
  registerGenerator('callable-entry', callableEntryGenerator)
  registerGenerator('callableEntry', callableEntryGenerator)
  registerGenerator('return', returnGenerator)

  // Action nodes
  registerGenerator('action:set-option', { generate: generateSetOption })
  registerGenerator('action:set-keymap', { generate: generateSetKeymap })
  registerGenerator('action:set-variable', { generate: generateSetVariable })
  registerGenerator('action:run-action', { generate: generateRunAction })
  registerGenerator('action:run-command', { generate: generateRunAction })
  registerGenerator('action:create-autocmd', createAutocmdGenerator)
  registerGenerator('action:set-highlight', setHighlightGenerator)
  registerGenerator('action:get-variable', getVariableActionGenerator)
  registerGenerator('action:call-function', callFunctionGenerator)

  // Action aliases
  registerGenerator('setOption', { generate: generateSetOption })
  registerGenerator('setKeymap', { generate: generateSetKeymap })
  registerGenerator('setVariable', { generate: generateSetVariable })
  registerGenerator('runCommand', { generate: generateRunAction })
  registerGenerator('createAutocmd', createAutocmdGenerator)
  registerGenerator('setHighlight', setHighlightGenerator)
  registerGenerator('callFunction', callFunctionGenerator)

  // Advanced
  registerGenerator('code-block', codeBlockGenerator)
  registerGenerator('codeBlock', codeBlockGenerator)
  registerGenerator('graph-ref', graphRefGenerator)
  registerGenerator('graphRef', graphRefGenerator)
  registerGenerator('run-function', runFunctionGenerator)

  // Builtins
  registerGenerator('builtin:require-module', requireModuleGenerator)
  registerGenerator('builtin:requireModule', requireModuleGenerator)
  registerGenerator('builtin:check-feature', checkFeatureGenerator)
  registerGenerator('builtin:checkFeature', checkFeatureGenerator)
  registerGenerator('builtin:check-platform', checkPlatformGenerator)
  registerGenerator('builtin:checkPlatform', checkPlatformGenerator)
  registerGenerator('builtin:get-variable', getVariableGenerator)
  registerGenerator('builtin:getVariable', getVariableGenerator)
  registerGenerator('builtin:ui.notify', uiNotifyGenerator)
  registerGenerator('builtin:buffers.open-file', openFileGenerator)
  registerGenerator('builtin:automation.delay', delayGenerator)
  registerGenerator('builtin:input.prompt', promptGenerator)

  // Builtin aliases
  registerGenerator('requireModule', requireModuleGenerator)
  registerGenerator('checkFeature', checkFeatureGenerator)
  registerGenerator('checkPlatform', checkPlatformGenerator)
  registerGenerator('getVariable', getVariableGenerator)

  // Legacy node type
  registerGenerator('plugin-action', { generate: generatePluginActionCode })
}

initializeGenerators()
