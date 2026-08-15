import { useMemo } from 'react'
import type { ParamConnectionStatus } from '@/shared/components/function-param-defaults'
import type { RunFunctionParamSignature } from '@/shared/types'
import { useGraphEditorStore } from '../store'

/**
 * Check connection status for all params of a run-function node.
 * Returns a Record<paramName, boolean> indicating which params have incoming edges.
 *
 * Uses a single store selector (not per-param hooks) to avoid Rules of Hooks violations.
 * Port IDs for run-function params use the format `param:<name>` (see store.ts).
 */
export function useParamConnectionStatus(
  nodeId: string,
  params: readonly RunFunctionParamSignature[],
): ParamConnectionStatus {
  const edges = useGraphEditorStore((state) => state.graph?.edges)

  return useMemo(() => {
    if (!edges) {
      return {}
    }

    const result: Record<string, boolean> = {}
    const paramPortToName = new Map<string, string>()

    for (const param of params) {
      const portId = `param:${param.name}`
      paramPortToName.set(portId, param.name)
      result[param.name] = false
    }

    for (const edge of edges) {
      if (edge.target !== nodeId) {
        continue
      }

      const paramName = paramPortToName.get(edge.targetPort)
      if (paramName !== undefined) {
        result[paramName] = true
      }
    }

    return result
  }, [edges, nodeId, params])
}
