import { AlertCircle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { useGraphManager } from '@/features/graph-editor/hooks/useGraphManager'
import { saveGraph } from '@/features/graph-editor/storage'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { useNavigationIntentStore } from '@/shared/lib/navigation-intent'
import type { Graph } from '@/shared/types'
import {
  extractCallableContract,
  type GraphCallableContract,
  type GraphEffectiveState,
} from '@/shared/types'

interface RunCustomActionEditorProps {
  graphId: string
  graphName: string
  onChange: (graphId: string, graphName: string) => void
  projectPath: string
  /** Called when quick-creating a new action. Receives the new action data. */
  onQuickCreate?: (newGraphId: string, newGraphName: string) => Promise<void>
  /** Returns validation errors for the keymap form (modes + keySequence). Empty array means valid. */
  getKeymapValidationErrors?: () => string[]
}

function getDisableDisplayReason(effective: GraphEffectiveState): string {
  switch (effective.kind) {
    case 'user-disabled':
      return 'Disabled by you'
    case 'dependency-disabled':
      return `Blocked by: ${effective.blockedByRootName}`
    default:
      return ''
  }
}

export function RunCustomActionEditor({
  graphId,
  onChange,
  projectPath,
  onQuickCreate,
  getKeymapValidationErrors,
}: RunCustomActionEditorProps): React.JSX.Element {
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [newActionName, setNewActionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()
  const { graphs, disableStates, isLoading, refreshGraphs } =
    useGraphManager(projectPath)

  // Filter to only effectively enabled callable graphs
  const effectivelyEnabledCallableGraphs = useMemo(() => {
    return graphs
      .filter((g: Graph) => {
        // Check if effectively enabled
        const state = disableStates.statesByGraphId.get(g.id)
        if (state !== undefined && state.effective.kind !== 'enabled') {
          return false
        }
        // Check if callable
        return g.nodes.some((n) => n.data.nodeType === 'callable-entry')
      })
      .map(extractCallableContract)
      .filter((c): c is GraphCallableContract => c !== null)
  }, [graphs, disableStates])

  const zeroParameterCallableGraphs = useMemo(
    () =>
      effectivelyEnabledCallableGraphs.filter(
        (contract) => contract.parameters.length === 0,
      ),
    [effectivelyEnabledCallableGraphs],
  )

  const parameterizedCallableGraphs = useMemo(
    () =>
      effectivelyEnabledCallableGraphs.filter(
        (contract) => contract.parameters.length > 0,
      ),
    [effectivelyEnabledCallableGraphs],
  )

  // Check if currently selected graph is disabled
  const selectedGraphState = graphId
    ? disableStates.statesByGraphId.get(graphId)
    : undefined
  const selectedGraphMissing =
    graphId.length > 0 && !graphs.some((graph) => graph.id === graphId)
  const selectedGraphDisabled =
    selectedGraphState !== undefined &&
    selectedGraphState.effective.kind !== 'enabled'
  const selectedGraphDisableReason = selectedGraphState?.effective
    ? getDisableDisplayReason(selectedGraphState.effective)
    : ''

  async function handleQuickCreate(): Promise<void> {
    if (newActionName.trim().length === 0) return

    // Validate keymap form before creating graph
    if (getKeymapValidationErrors) {
      const keymapErrors = getKeymapValidationErrors()
      if (keymapErrors.length > 0) {
        toast.error(keymapErrors[0])
        return
      }
    }

    setIsCreating(true)

    try {
      // 1. Create a new graph with enabled: true and proper order
      const newGraphId = uuidv4()
      const entryNodeId = uuidv4()
      const now = Date.now()

      // Get next order value from existing graphs
      const maxOrder =
        graphs.length > 0 ? Math.max(...graphs.map((g) => g.order)) : -1

      const newGraph: Graph = {
        id: newGraphId,
        name: newActionName.trim(),
        nodes: [
          {
            id: entryNodeId,
            type: 'callable-entry',
            definitionId: 'callable-entry',
            position: { x: 250, y: 150 },
            data: {
              nodeType: 'callable-entry',
              parameters: [],
            },
          },
        ],
        edges: [],
        createdAt: now,
        updatedAt: now,
        enabled: true,
        order: maxOrder + 1,
      }

      // 2. Save graph to disk
      await saveGraph(projectPath, newGraph)
      await refreshGraphs()

      const trimmedName = newActionName.trim()

      // 3. Update the action to point to the new graph (for UI consistency)
      onChange(newGraphId, trimmedName)

      // 4. Persist the keymap with the new action data directly
      if (onQuickCreate) {
        await onQuickCreate(newGraphId, trimmedName)
      }

      // 5. Set navigation intent
      useNavigationIntentStore.getState().setFocusNode({
        graphId: newGraphId,
        nodeId: entryNodeId,
      })

      // 6. Navigate to Graph Editor
      navigate('/editor')
    } catch (error) {
      console.error('Failed to create custom action:', error)
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Custom Action</p>
        <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
          Loading custom actions...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Custom Action</p>

      {zeroParameterCallableGraphs.length === 0 &&
      parameterizedCallableGraphs.length === 0 &&
      !showCreateInput ? (
        /* ── Empty State ── */
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No custom actions yet</p>
          <p className="mt-1">
            Custom actions let you combine multiple steps into a single shortcut
            — like "format, then save."
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setShowCreateInput(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create a custom action
          </Button>
          <div className="mt-3 pt-3 border-t border-dashed">
            <p className="text-xs">
              You can also build them in the{' '}
              <button
                type="button"
                onClick={() => navigate('/editor')}
                className="text-primary hover:underline"
              >
                Graph Editor
              </button>{' '}
              page and they&apos;ll appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        /* ── Picker + Create ── */
        <>
          <div className="space-y-2">
            {zeroParameterCallableGraphs.length > 0 && (
              <Select
                value={graphId}
                onValueChange={(id) => {
                  const contract = zeroParameterCallableGraphs.find(
                    (c) => c.graphId === id,
                  )
                  onChange(id, contract?.graphName ?? '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a custom action..." />
                </SelectTrigger>
                <SelectContent>
                  {zeroParameterCallableGraphs.map((contract) => (
                    <SelectItem key={contract.graphId} value={contract.graphId}>
                      {contract.graphName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedGraphMissing && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>Target graph missing</span>
              </div>
            )}

            {graphId && selectedGraphDisabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <AlertCircle className="w-3 h-3" />
                      <span>
                        Target graph disabled: {selectedGraphDisableReason}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      This keymap will be excluded from Lua generation until the
                      target graph is enabled.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {parameterizedCallableGraphs.length > 0 && (
            <div className="rounded-md border border-dashed bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">
                Unavailable for keyboard shortcuts
              </p>
              <p className="text-xs text-muted-foreground">
                These custom actions require parameters and cannot be triggered
                directly from shortcuts yet.
              </p>
              <div className="space-y-1">
                {parameterizedCallableGraphs.map((contract) => (
                  <div
                    key={contract.graphId}
                    className="flex items-center justify-between rounded border bg-background/70 px-2 py-1 text-xs opacity-70"
                  >
                    <span>{contract.graphName}</span>
                    <span className="text-muted-foreground">
                      Requires parameters (not supported for keyboard shortcuts)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showCreateInput ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateInput(true)}
              aria-label="Create a new custom action"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create a new custom action
            </Button>
          ) : (
            /* ── Inline Create Input ── */
            <div className="rounded-md border bg-muted/10 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Name your custom action:
              </p>
              <div className="flex gap-2">
                <Input
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder="e.g., Format and Save"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleQuickCreate()
                    if (e.key === 'Escape') setShowCreateInput(false)
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => void handleQuickCreate()}
                  disabled={newActionName.trim().length === 0 || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create & Open →'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateInput(false)
                    setNewActionName('')
                  }}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This will open the Graph Editor where you can build your
                multi-step action.
              </p>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Run a multi-step action you built in the Graph Editor.
      </p>
    </div>
  )
}
