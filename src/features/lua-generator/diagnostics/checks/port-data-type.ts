import { getBuiltinActionPortSpec } from '@/shared/lib/builtin-actions'
import type { GraphNode, PortDataType } from '@/shared/types'

function getTriggerPortDataType(
  _portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    return 'void'
  }
  return undefined
}

function getCallableEntryPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'callable-entry' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    const param = node.parameters.find((entry) => entry.id === portId)
    return param?.dataType ?? 'any'
  }
  return undefined
}

function getReturnPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'return' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (!isSource) {
    const retVal = node.returnValues.find((entry) => entry.id === portId)
    return retVal?.dataType ?? 'any'
  }
  return 'void'
}

function getActionPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'action' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    if (portId === 'done' || portId === 'on-event') {
      return 'void'
    }
    if (node.actionType === 'get-variable') {
      return 'any'
    }
    return undefined
  }

  if (portId === 'exec') {
    return 'void'
  }
  return undefined
}

function getConditionPortDataType(
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    return portId === 'true' || portId === 'false' ? 'void' : undefined
  }
  return portId === 'a' || portId === 'b' ? 'any' : undefined
}

function getLoopPortDataType(
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    return portId === 'loop' || portId === 'done' ? 'void' : undefined
  }
  return portId === 'iterable' ? 'table' : undefined
}

function getCodeBlockPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'code-block' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    const output = node.outputs.find((entry) => entry.id === portId)
    return output?.dataType ?? 'void'
  }
  const input = node.inputs.find((entry) => entry.id === portId)
  return input?.dataType ?? undefined
}

function getGraphRefPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'graph-ref' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    if (portId === 'done') {
      return 'void'
    }
    const cachedReturn = node.cachedContract?.returnValues
    const retVal = cachedReturn?.find((entry) => entry.id === portId)
    return retVal?.dataType ?? 'any'
  }

  if (portId === 'exec') {
    return 'void'
  }
  const cachedParams = node.cachedContract?.parameters
  const param = cachedParams?.find((entry) => entry.id === portId)
  return param?.dataType ?? 'any'
}

function getRunFunctionPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'run-function' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (isSource) {
    return portId === 'result' ? 'any' : undefined
  }

  const signature = node.signature
  if (signature?.params) {
    const param = signature.params.find(
      (entry) => `param:${entry.name}` === portId,
    )
    if (param) {
      return (param.type as PortDataType) ?? 'any'
    }
  }
  return undefined
}

function getBuiltinPortDataType(
  node: Extract<GraphNode['data'], { nodeType: 'builtin' }>,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  if (portId === 'exec' && !isSource) return 'void'
  if (portId === 'done' && isSource) return 'void'

  const spec = getBuiltinActionPortSpec(node.builtinId)
  if (spec) {
    const ports = isSource ? spec.outputs : spec.inputs
    const port = ports.find((entry) => entry.id === portId)
    if (port) return port.dataType as PortDataType
  }

  return 'any'
}

export function getPortDataType(
  node: GraphNode,
  portId: string,
  isSource: boolean,
): PortDataType | undefined {
  switch (node.data.nodeType) {
    case 'trigger':
      return getTriggerPortDataType(portId, isSource)
    case 'callable-entry':
      return getCallableEntryPortDataType(node.data, portId, isSource)
    case 'return':
      return getReturnPortDataType(node.data, portId, isSource)
    case 'action':
      return getActionPortDataType(node.data, portId, isSource)
    case 'condition':
      return getConditionPortDataType(portId, isSource)
    case 'loop':
      return getLoopPortDataType(portId, isSource)
    case 'code-block':
      return getCodeBlockPortDataType(node.data, portId, isSource)
    case 'graph-ref':
      return getGraphRefPortDataType(node.data, portId, isSource)
    case 'run-function':
      return getRunFunctionPortDataType(node.data, portId, isSource)
    case 'builtin':
      return getBuiltinPortDataType(node.data, portId, isSource)
    default:
      return undefined
  }
}
