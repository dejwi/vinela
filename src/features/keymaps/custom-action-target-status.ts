import { getDisableReason } from '@/features/graph-editor/utils/graph-disable-state'
import type { Graph, GraphDisableState } from '@/shared/types'
import { extractCallableContract } from '@/shared/types'

export type RunCustomActionTargetStatus =
  | { kind: 'enabled' }
  | { kind: 'disabled'; reason: string }
  | { kind: 'missing' }
  | { kind: 'not-callable' }

export function resolveRunCustomActionTargetStatus(
  graphId: string,
  graphsById: ReadonlyMap<string, Graph>,
  statesByGraphId: ReadonlyMap<string, GraphDisableState>,
): RunCustomActionTargetStatus {
  if (graphId.length === 0) {
    return { kind: 'missing' }
  }

  const graph = graphsById.get(graphId)
  if (!graph) {
    return { kind: 'missing' }
  }

  if (extractCallableContract(graph) === null) {
    return { kind: 'not-callable' }
  }

  const disableState = statesByGraphId.get(graphId)
  if (disableState !== undefined && disableState.effective.kind !== 'enabled') {
    const reason = getDisableReason(disableState)
    return {
      kind: 'disabled',
      reason: reason.length > 0 ? reason : 'Disabled',
    }
  }

  return { kind: 'enabled' }
}
