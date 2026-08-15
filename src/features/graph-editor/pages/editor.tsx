import { Redo2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/features/projects/store'
import { useAppSettings } from '@/features/settings/hooks/useAppSettings'
import { Button } from '@/shared/components/ui/button'
import { useNavigationIntentStore } from '@/shared/lib/navigation-intent'
import { getSettingWithDefault, SETTING_DEFAULTS } from '@/shared/lib/settings'
import type { Graph } from '@/shared/types'
import { GraphEditor } from '../components/GraphEditor'
import { GraphManagerProvider } from '../components/GraphManagerContext'
import { GraphSidebar } from '../components/GraphSidebar'
import { GraphTabs } from '../components/GraphTabs'
import {
  emitGraphManagerChanged,
  useGraphManager,
} from '../hooks/useGraphManager'
import { saveGraphContent } from '../storage'
import { useGraphEditorStore, useGraphHistory } from '../store'

export default function GraphEditorPage() {
  const project = useProjectStore((state) => state.currentProject)
  const { graph, clearGraph, loadGraph, setProjectPath } = useGraphEditorStore()
  const { undo, redo, canUndo, canRedo } = useGraphHistory()
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastPersistedUpdatedAtRef = useRef<Map<string, number>>(new Map())
  const hasBootstrappedInitialGraphRef = useRef(false)
  const {
    graphs: availableGraphs,
    disableStates,
    updateGraph,
  } = useGraphManager(project?.absolutePath ?? '')
  const graphManagerContextValue = useMemo(
    () => ({ graphs: availableGraphs, disableStates }),
    [availableGraphs, disableStates],
  )

  // Settings integration
  const { settings } = useAppSettings()
  const autoSaveDelay = settings
    ? getSettingWithDefault(settings, 'autoSaveDelay')
    : SETTING_DEFAULTS.autoSaveDelay

  // Track multiple open graphs
  const [openGraphs, setOpenGraphs] = useState<Graph[]>([])
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null)

  // Set project path in store when project changes
  useEffect(() => {
    if (project?.absolutePath) {
      setProjectPath(project.absolutePath)
      hasBootstrappedInitialGraphRef.current = false
    }
  }, [project?.absolutePath, setProjectPath])

  useEffect(() => {
    if (!graph) {
      return
    }

    hasBootstrappedInitialGraphRef.current = true

    if (!lastPersistedUpdatedAtRef.current.has(graph.id)) {
      lastPersistedUpdatedAtRef.current.set(graph.id, graph.updatedAt)
    }

    setOpenGraphs((previousGraphs) => {
      const existingGraphIndex = previousGraphs.findIndex(
        (g) => g.id === graph.id,
      )

      if (existingGraphIndex === -1) {
        return activeGraphId === null
          ? [...previousGraphs, graph]
          : previousGraphs
      }

      const nextGraphs = [...previousGraphs]
      nextGraphs[existingGraphIndex] = graph
      return nextGraphs
    })

    if (activeGraphId === null) {
      setActiveGraphId(graph.id)
    }
  }, [graph, activeGraphId])

  useEffect(() => {
    if (
      hasBootstrappedInitialGraphRef.current ||
      graph ||
      activeGraphId !== null ||
      availableGraphs.length === 0
    ) {
      return
    }

    const mostRecentGraph = availableGraphs[0]
    if (!mostRecentGraph) {
      return
    }

    lastPersistedUpdatedAtRef.current.set(
      mostRecentGraph.id,
      mostRecentGraph.updatedAt,
    )
    hasBootstrappedInitialGraphRef.current = true
    setOpenGraphs([mostRecentGraph])
    setActiveGraphId(mostRecentGraph.id)
    loadGraph(mostRecentGraph)
  }, [activeGraphId, availableGraphs, graph, loadGraph])

  useEffect(() => {
    if (!project?.absolutePath || !graph) {
      return
    }

    const lastPersistedUpdatedAt = lastPersistedUpdatedAtRef.current.get(
      graph.id,
    )
    if (lastPersistedUpdatedAt === graph.updatedAt) {
      return
    }

    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current)
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const persistedGraph = await saveGraphContent(
            project.absolutePath,
            graph,
          )

          if (persistedGraph === null) {
            console.error(
              `graph missing/invalid while autosaving: graph id ${graph.id}`,
            )
            return
          }

          lastPersistedUpdatedAtRef.current.set(
            persistedGraph.id,
            persistedGraph.updatedAt,
          )
          // Notify GraphManagerContext to refresh so GraphRefNode sees callable graphs
          emitGraphManagerChanged(project.absolutePath, 'updated', [
            persistedGraph.id,
          ])
        } catch (error) {
          console.error('Failed to autosave graph', error)
        }
      })()
    }, autoSaveDelay)

    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [graph, project?.absolutePath, autoSaveDelay])

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current)
      }

      const currentState = useGraphEditorStore.getState()
      const currentProjectPath = project?.absolutePath

      const currentGraph = currentState.graph

      if (!currentProjectPath || !currentGraph) {
        return
      }

      const lastPersistedUpdatedAt = lastPersistedUpdatedAtRef.current.get(
        currentGraph.id,
      )
      if (lastPersistedUpdatedAt === currentGraph.updatedAt) {
        return
      }

      void saveGraphContent(currentProjectPath, currentGraph)
        .then((persistedGraph) => {
          if (persistedGraph === null) {
            console.error(
              `graph missing/invalid while flushing autosave: graph id ${currentGraph.id}`,
            )
            return
          }

          lastPersistedUpdatedAtRef.current.set(
            persistedGraph.id,
            persistedGraph.updatedAt,
          )
          // Notify GraphManagerContext to refresh so GraphRefNode sees callable graphs
          emitGraphManagerChanged(currentProjectPath, 'updated', [
            persistedGraph.id,
          ])
        })
        .catch((error) => {
          console.error('Failed to flush graph autosave', error)
        })
    }
  }, [project?.absolutePath])

  const flushAutosave = useCallback(async (): Promise<void> => {
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }

    const currentProjectPath = project?.absolutePath
    const currentGraph = useGraphEditorStore.getState().graph
    if (!currentProjectPath || !currentGraph) {
      return
    }

    const lastPersistedUpdatedAt = lastPersistedUpdatedAtRef.current.get(
      currentGraph.id,
    )
    if (lastPersistedUpdatedAt === currentGraph.updatedAt) {
      return
    }

    try {
      const persistedGraph = await saveGraphContent(
        currentProjectPath,
        currentGraph,
      )

      if (persistedGraph === null) {
        console.error(
          `graph missing/invalid while flushing autosave: graph id ${currentGraph.id}`,
        )
        return
      }

      lastPersistedUpdatedAtRef.current.set(
        persistedGraph.id,
        persistedGraph.updatedAt,
      )
      // Notify GraphManagerContext to refresh so GraphRefNode sees callable graphs
      emitGraphManagerChanged(currentProjectPath, 'updated', [
        persistedGraph.id,
      ])
    } catch (error) {
      console.error('Failed to flush graph autosave', error)
    }
  }, [project?.absolutePath])

  useEffect(() => {
    const handlePageHide = () => {
      void flushAutosave()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushAutosave()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushAutosave])

  const handleGraphSelect = useCallback(
    (selectedGraph: Graph) => {
      const existingOpenGraph = openGraphs.find(
        (g) => g.id === selectedGraph.id,
      )
      const graphToLoad = existingOpenGraph ?? selectedGraph

      lastPersistedUpdatedAtRef.current.set(
        graphToLoad.id,
        graphToLoad.updatedAt,
      )

      // Add to open tabs if not already open
      if (!existingOpenGraph) {
        setOpenGraphs((prev) => [...prev, selectedGraph])
      }

      void flushAutosave()
      setActiveGraphId(graphToLoad.id)
      loadGraph(graphToLoad)
    },
    [openGraphs, loadGraph, flushAutosave],
  )

  // ── Navigation intent consumption ──────────────────────
  // When navigating from another page (e.g., keymaps) with a focus intent,
  // open the target graph and select the target node.
  // We use a ref to track which intent we've already processed to avoid
  // re-processing on every render.
  const processedIntentRef = useRef<string | null>(null)

  useEffect(() => {
    // Peek at the intent without consuming it yet
    const intent = useNavigationIntentStore.getState().focusNode
    if (!intent || availableGraphs.length === 0) {
      return
    }

    // Check if we've already processed this exact intent
    const intentKey = `${intent.graphId}:${intent.nodeId}`
    if (processedIntentRef.current === intentKey) {
      return
    }

    // Find the target graph
    const targetGraph = availableGraphs.find((g) => g.id === intent.graphId)
    if (!targetGraph) {
      // Graph not found - don't consume yet, it might still be loading
      // Only warn if we have graphs loaded but the target isn't among them
      if (availableGraphs.length > 0) {
        console.warn(`Navigation intent: graph ${intent.graphId} not found`)
        // Consume to prevent infinite warnings
        useNavigationIntentStore.getState().consumeFocusNode()
        processedIntentRef.current = intentKey
      }
      return
    }

    // NOW consume the intent since we found the graph
    useNavigationIntentStore.getState().consumeFocusNode()
    processedIntentRef.current = intentKey

    // Open the graph in a tab
    handleGraphSelect(targetGraph)

    // After the graph loads, select and center on the target node.
    // We need to wait for:
    // 1. The graph to be loaded into the store
    // 2. React Flow to render the nodes
    // 3. The Canvas component to mount and attach event listeners
    // Use requestAnimationFrame + setTimeout to ensure proper timing
    const selectAndCenterNode = (): void => {
      const storeState = useGraphEditorStore.getState()
      const loadedGraph = storeState.graph
      if (!loadedGraph || loadedGraph.id !== intent.graphId) {
        return
      }

      // Find the target node
      const targetNode = loadedGraph.nodes.find((n) => n.id === intent.nodeId)
      if (!targetNode) {
        console.warn(
          `Navigation intent: node ${intent.nodeId} not found in graph ${intent.graphId}`,
        )
        return
      }

      // Select the node (this shows the properties panel)
      storeState.setSelectedNodes([intent.nodeId])

      // Center the viewport on the node
      window.dispatchEvent(
        new CustomEvent('graph-editor:center-on-node', {
          detail: {
            nodeId: intent.nodeId,
            position: targetNode.position,
          },
        }),
      )
    }

    // Wait for React Flow to fully render before selecting/centering
    // Use a longer delay (300ms) to ensure the Canvas component has mounted
    // and attached its event listeners
    const timerId = window.setTimeout(() => {
      // Use requestAnimationFrame to ensure we're after the render cycle
      requestAnimationFrame(() => {
        selectAndCenterNode()
      })
    }, 300)

    return () => window.clearTimeout(timerId)
  }, [availableGraphs, handleGraphSelect])

  const handleTabClick = useCallback(
    (graphId: string) => {
      const g = openGraphs.find((g) => g.id === graphId)
      if (g) {
        lastPersistedUpdatedAtRef.current.set(g.id, g.updatedAt)
        void flushAutosave()
        setActiveGraphId(graphId)
        loadGraph(g)
      }
    },
    [openGraphs, loadGraph, flushAutosave],
  )

  const handleTabClose = useCallback(
    (graphId: string) => {
      setOpenGraphs((prev) => prev.filter((g) => g.id !== graphId))

      // If closing active tab, switch to another
      if (activeGraphId === graphId) {
        void flushAutosave()
        const remaining = openGraphs.filter((g) => g.id !== graphId)
        if (remaining.length > 0) {
          const lastGraph = remaining[remaining.length - 1]
          if (lastGraph) {
            setActiveGraphId(lastGraph.id)
            loadGraph(lastGraph)
          }
        } else {
          setActiveGraphId(null)
          clearGraph()
        }
      }
    },
    [activeGraphId, openGraphs, clearGraph, loadGraph, flushAutosave],
  )

  const handleGraphRename = useCallback(
    async (targetGraph: Graph, name: string): Promise<void> => {
      const trimmedName = name.trim()
      if (!trimmedName || trimmedName === targetGraph.name) {
        return
      }

      const currentGraph = useGraphEditorStore.getState().graph
      const isRenamingActiveGraph = activeGraphId === targetGraph.id

      if (
        isRenamingActiveGraph &&
        currentGraph &&
        currentGraph.id === targetGraph.id
      ) {
        await flushAutosave()
      }

      const sourceGraph =
        isRenamingActiveGraph &&
        currentGraph &&
        currentGraph.id === targetGraph.id
          ? currentGraph
          : targetGraph

      const renamedGraph = await updateGraph({
        ...sourceGraph,
        name: trimmedName,
      })

      lastPersistedUpdatedAtRef.current.set(
        renamedGraph.id,
        renamedGraph.updatedAt,
      )

      setOpenGraphs((prev) =>
        prev.map((g) => (g.id === renamedGraph.id ? renamedGraph : g)),
      )

      if (isRenamingActiveGraph) {
        loadGraph(renamedGraph)
      }
    },
    [activeGraphId, flushAutosave, loadGraph, updateGraph],
  )

  if (!project) {
    return <div className="p-4">No project loaded</div>
  }

  return (
    <GraphManagerProvider value={graphManagerContextValue}>
      <div className="h-full flex">
        {/* Collapsible Sidebar */}
        <GraphSidebar
          projectPath={project.absolutePath}
          onGraphSelect={handleGraphSelect}
          onGraphRename={handleGraphRename}
          selectedGraphId={activeGraphId ?? undefined}
        />

        {/* Main Editor Area */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          {/* Tabs */}
          <GraphTabs
            openGraphs={openGraphs}
            activeGraphId={activeGraphId ?? ''}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
          />

          {/* Header */}
          <header className="h-12 border-b flex items-center justify-between px-4">
            <h2 className="font-medium">{graph?.name ?? 'Select a graph'}</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                title="Undo"
                onClick={undo}
                disabled={!canUndo()}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Redo"
                onClick={redo}
                disabled={!canRedo()}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Canvas */}
          <div className="flex-1 min-h-0">
            {graph ? (
              <GraphEditor />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Select a graph from the sidebar or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </GraphManagerProvider>
  )
}
