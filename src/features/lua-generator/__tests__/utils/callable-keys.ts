import {
  formatAutocmdCallbackId,
  formatCallableId,
} from '@/features/lua-generator/lua-utils'

export function expectedCallableKey(name: string, id: string): string {
  return formatCallableId(name, id)
}

export function expectedCallableRef(name: string, id: string): string {
  return `_G._vinela_callables[${JSON.stringify(expectedCallableKey(name, id))}]`
}

export function expectedCallableRefByKey(callableKey: string): string {
  return `_G._vinela_callables[${JSON.stringify(callableKey)}]`
}

export function expectedCallableRefRegex(name: string, id: string): string {
  return expectedCallableRef(name, id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function expectedAutocmdCallbackKey(
  graphName: string,
  nodeId: string,
): string {
  return formatAutocmdCallbackId(graphName, nodeId)
}

export function expectedAutocmdCallbackRef(
  graphName: string,
  nodeId: string,
): string {
  return `_G._vinela_callables[${JSON.stringify(expectedAutocmdCallbackKey(graphName, nodeId))}]`
}
