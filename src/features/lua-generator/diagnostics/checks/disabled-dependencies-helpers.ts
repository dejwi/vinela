import type { Graph } from '@/shared/types'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

interface DisabledDependencyReport {
  graphId: string
  graphName: string
  reason: string
  blockedByRootName?: string
}

export function buildGraphReferenceMap(
  graphs: readonly Graph[],
): Map<string, Set<string>> {
  const references = new Map<string, Set<string>>()

  for (const graph of graphs) {
    const referencedGraphs = new Set<string>()

    for (const node of graph.nodes) {
      if (node.data.nodeType === 'graph-ref') {
        const targetId = node.data.referencedGraphId
        if (targetId.length > 0) {
          referencedGraphs.add(targetId)
        }
      }
    }

    references.set(graph.id, referencedGraphs)
  }

  return references
}

export function collectDisabledDependencies(
  _graph: Graph,
  referencedGraphs: ReadonlySet<string>,
  ctx: PreGenerationContext,
): DisabledDependencyReport[] {
  const disabledDependencies: DisabledDependencyReport[] = []

  for (const targetId of referencedGraphs) {
    const targetState = ctx.disableStates.get(targetId)
    const targetGraph = ctx.graphsById.get(targetId)

    if (!targetState || !targetGraph) {
      continue
    }

    if (targetState.effective.kind !== 'enabled') {
      let reason: string
      let blockedByRootName: string | undefined

      if (targetState.effective.kind === 'user-disabled') {
        reason = 'disabled by user'
      } else {
        reason = 'disabled due to dependency chain'
        blockedByRootName = targetState.effective.blockedByRootName
      }

      disabledDependencies.push({
        graphId: targetId,
        graphName: targetGraph.name,
        reason,
        ...(blockedByRootName !== undefined ? { blockedByRootName } : {}),
      })
    }
  }

  return disabledDependencies
}

export function reportDisabledDependencies(
  graph: Graph,
  disabledDependencies: readonly DisabledDependencyReport[],
  collector: DiagnosticsCollector,
): void {
  for (const dep of disabledDependencies) {
    const chainMessage = dep.blockedByRootName
      ? `Dependency chain: ${dep.graphName} depends on ${dep.blockedByRootName}`
      : ''

    collector.addWarning({
      id: 'WARN_DEPENDENCY_DISABLED_GRAPH',
      category: 'reference',
      message: `Graph "${graph.name}" depends on disabled graph "${dep.graphName}"`,
      details: `The graph "${dep.graphName}" is ${dep.reason}. This may cause runtime errors or unexpected behavior. ${chainMessage}`,
      source: {
        graphId: graph.id,
        graphName: graph.name,
      },
      suggestions: [
        `Enable the "${dep.graphName}" graph`,
        'Remove the dependency on this graph',
        `Handle the disabled state in "${graph.name}" logic`,
      ],
    })
  }
}
