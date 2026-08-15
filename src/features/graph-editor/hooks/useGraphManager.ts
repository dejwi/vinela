import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DisableComputationResult,
  Graph,
  GraphMetadataPatch,
  GraphOrderUpdate,
} from '@/shared/types'
import {
  createGraph,
  deleteGraph,
  listGraphs,
  saveGraphContent,
  updateGraphMetadata,
  updateGraphOrderBatch,
} from '../storage'
import { computeDisableStates } from '../utils/graph-disable-state'

export const GRAPH_MANAGER_CHANGED_EVENT = 'graph-manager:changed'

export type GraphManagerChangeReason =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'metadata-updated'
  | 'reordered'

export interface GraphManagerChangedEventDetail {
  projectPath: string
  reason: GraphManagerChangeReason
  graphIds: string[]
}

const GRAPH_MANAGER_CHANGE_REASONS: readonly GraphManagerChangeReason[] = [
  'created',
  'updated',
  'deleted',
  'metadata-updated',
  'reordered',
]

function isGraphManagerChangeReason(
  value: unknown,
): value is GraphManagerChangeReason {
  return (
    typeof value === 'string' &&
    GRAPH_MANAGER_CHANGE_REASONS.includes(value as GraphManagerChangeReason)
  )
}

function isGraphManagerChangedEventDetail(
  value: unknown,
): value is GraphManagerChangedEventDetail {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    projectPath?: unknown
    reason?: unknown
    graphIds?: unknown
  }

  return (
    typeof candidate.projectPath === 'string' &&
    isGraphManagerChangeReason(candidate.reason) &&
    Array.isArray(candidate.graphIds) &&
    candidate.graphIds.every((id) => typeof id === 'string')
  )
}

export function getGraphManagerChangedEventDetail(
  event: Event,
): GraphManagerChangedEventDetail | null {
  if (!(event instanceof CustomEvent)) {
    return null
  }

  return isGraphManagerChangedEventDetail(event.detail) ? event.detail : null
}

export function isGraphManagerChangedEventForProject(
  event: Event,
  projectPath: string,
): boolean {
  const detail = getGraphManagerChangedEventDetail(event)
  return detail?.projectPath === projectPath
}

export function emitGraphManagerChanged(
  projectPath: string,
  reason: GraphManagerChangeReason,
  graphIds: string[],
): void {
  window.dispatchEvent(
    new CustomEvent<GraphManagerChangedEventDetail>(
      GRAPH_MANAGER_CHANGED_EVENT,
      {
        detail: { projectPath, reason, graphIds },
      },
    ),
  )
}

interface UseGraphManagerReturn {
  graphs: Graph[]
  disableStates: DisableComputationResult
  isLoading: boolean
  error: string | null
  createGraph: (name: string) => Promise<Graph>
  updateGraph: (graph: Graph) => Promise<Graph>
  deleteGraph: (graphId: string) => Promise<void>
  /** Toggle the enabled state of a graph (user intent) */
  toggleGraphEnabled: (graphId: string) => Promise<Graph>
  /** Reorder graphs by updating their order values */
  reorderGraphs: (updates: readonly GraphOrderUpdate[]) => Promise<void>
  refreshGraphs: () => Promise<void>
}

export function useGraphManager(projectPath: string): UseGraphManagerReturn {
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(projectPath))
  const [error, setError] = useState<string | null>(null)

  const disableStates = useMemo(() => computeDisableStates(graphs), [graphs])

  const refreshGraphs = useCallback(async () => {
    if (!projectPath) {
      setGraphs([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const loadedGraphs = await listGraphs(projectPath)
      setGraphs(loadedGraphs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graphs')
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    refreshGraphs()
  }, [refreshGraphs])

  useEffect(() => {
    if (!projectPath) {
      return
    }

    const handleGraphManagerChanged = (event: Event): void => {
      if (!isGraphManagerChangedEventForProject(event, projectPath)) {
        return
      }

      void refreshGraphs()
    }

    window.addEventListener(
      GRAPH_MANAGER_CHANGED_EVENT,
      handleGraphManagerChanged,
    )

    return () => {
      window.removeEventListener(
        GRAPH_MANAGER_CHANGED_EVENT,
        handleGraphManagerChanged,
      )
    }
  }, [projectPath, refreshGraphs])

  const handleCreateGraph = useCallback(
    async (name: string): Promise<Graph> => {
      const newGraph = await createGraph(projectPath, name)
      setGraphs((prev) => [...prev, newGraph])
      emitGraphManagerChanged(projectPath, 'created', [newGraph.id])
      return newGraph
    },
    [projectPath],
  )

  const handleUpdateGraph = useCallback(
    async (graph: Graph): Promise<Graph> => {
      const updated = { ...graph, updatedAt: Date.now() }
      const persisted = await saveGraphContent(projectPath, updated)

      if (persisted === null) {
        const errorMessage = `Failed to save graph "${graph.name}" - graph missing or invalid on disk`
        setError(errorMessage)
        // Re-sync local state to recover from potential stale data
        await refreshGraphs()
        throw new Error(errorMessage)
      }

      setGraphs((prev) => prev.map((g) => (g.id === graph.id ? persisted : g)))
      emitGraphManagerChanged(projectPath, 'updated', [graph.id])
      return persisted
    },
    [projectPath, refreshGraphs],
  )

  const handleDeleteGraph = useCallback(
    async (graphId: string): Promise<void> => {
      await deleteGraph(projectPath, graphId)
      setGraphs((prev) => prev.filter((g) => g.id !== graphId))
      emitGraphManagerChanged(projectPath, 'deleted', [graphId])
    },
    [projectPath],
  )

  const handleToggleGraphEnabled = useCallback(
    async (graphId: string): Promise<Graph> => {
      const graph = graphs.find((g) => g.id === graphId)
      if (!graph) {
        throw new Error(`Graph ${graphId} not found`)
      }

      const patch: GraphMetadataPatch = {
        graphId,
        enabled: !graph.enabled,
      }

      const updated = await updateGraphMetadata(projectPath, patch)

      if (updated === null) {
        const errorMessage = `Failed to update graph "${graph.name}" metadata - graph missing or invalid on disk`
        setError(errorMessage)
        // Re-sync local state to recover from potential stale data
        await refreshGraphs()
        throw new Error(errorMessage)
      }

      setGraphs((prev) => prev.map((g) => (g.id === graphId ? updated : g)))
      emitGraphManagerChanged(projectPath, 'metadata-updated', [graphId])
      return updated
    },
    [projectPath, graphs, refreshGraphs],
  )

  const handleReorderGraphs = useCallback(
    async (updates: readonly GraphOrderUpdate[]): Promise<void> => {
      if (updates.length === 0) return

      const result = await updateGraphOrderBatch(projectPath, updates)

      if (!result.success) {
        const errorMessage = `Failed to reorder graphs: ${result.error}`
        setError(errorMessage)
        // Re-sync local state to recover from partial writes
        await refreshGraphs()
        throw new Error(errorMessage)
      }

      // Update local state on success
      setGraphs((prev) => {
        const updatesMap = new Map(updates.map((u) => [u.graphId, u.order]))
        return prev.map((g) => {
          const newOrder = updatesMap.get(g.id)
          if (newOrder !== undefined) {
            return { ...g, order: newOrder }
          }
          return g
        })
      })

      emitGraphManagerChanged(
        projectPath,
        'reordered',
        updates.map((u) => u.graphId),
      )
    },
    [projectPath, refreshGraphs],
  )

  return {
    graphs,
    disableStates,
    isLoading,
    error,
    createGraph: handleCreateGraph,
    updateGraph: handleUpdateGraph,
    deleteGraph: handleDeleteGraph,
    toggleGraphEnabled: handleToggleGraphEnabled,
    reorderGraphs: handleReorderGraphs,
    refreshGraphs,
  }
}
