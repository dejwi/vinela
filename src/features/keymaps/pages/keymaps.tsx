import { AlertTriangle, Plus, Settings2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GRAPH_MANAGER_CHANGED_EVENT,
  isGraphManagerChangedEventForProject,
  useGraphManager,
} from '@/features/graph-editor/hooks/useGraphManager'
import {
  getActiveProfileIds,
  ProfileManagerDialog,
  useProjectProfilesStore,
} from '@/features/profiles'
import { useProjectStore } from '@/features/projects/store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { useNavigationIntentStore } from '@/shared/lib/navigation-intent'
import { isInitReady, type KeymapMode } from '@/shared/types'
import { EmptyState } from '../components/EmptyState'
import { KeymapEditorDialog } from '../components/KeymapEditorDialog'
import { KeymapList } from '../components/KeymapList'
import { MODE_LABELS, MODE_ORDER, SOURCE_LABELS } from '../constants'
import { resolveRunCustomActionTargetStatus } from '../custom-action-target-status'
import { useKeymapConflicts } from '../hooks/useKeymapConflicts'
import { useFilteredKeymaps } from '../hooks/useKeymapSearch'
import { useKeymapStore } from '../store'
import type {
  KeymapEntry,
  KeymapFilters,
  KeymapSort,
  ManualKeymapEntry,
  ProjectKeymap,
} from '../types'

const DEFAULT_FILTERS: KeymapFilters = {
  search: '',
  modeFilter: 'all',
  sourceFilter: 'all',
  actionTypeFilter: 'all',
  profileFilter: 'all',
}

const DEFAULT_SORT: KeymapSort = {
  field: 'keySequence',
  direction: 'asc',
}

export default function KeymapsPage(): React.JSX.Element {
  const project = useProjectStore((state) => state.currentProject)
  const manualKeymaps = useKeymapStore((state) => state.manualKeymaps)
  const graphKeymaps = useKeymapStore((state) => state.graphKeymaps)
  const error = useKeymapStore((state) => state.error)
  const initStatus = useKeymapStore((state) => state.initStatus)
  const loadAllKeymaps = useKeymapStore((state) => state.loadAllKeymaps)
  const refreshGraphKeymaps = useKeymapStore(
    (state) => state.refreshGraphKeymaps,
  )
  const deleteManualKeymap = useKeymapStore((state) => state.deleteManualKeymap)
  const toggleManualKeymap = useKeymapStore((state) => state.toggleManualKeymap)
  const updateManualKeymap = useKeymapStore((state) => state.updateManualKeymap)
  const clearError = useKeymapStore((state) => state.clearError)
  const profiles = useProjectProfilesStore((state) => state.profiles)
  const overrides = useProjectProfilesStore((state) => state.overrides)
  const profileInitStatus = useProjectProfilesStore((state) => state.initStatus)
  const profileError = useProjectProfilesStore((state) => state.error)
  const initializeProfiles = useProjectProfilesStore(
    (state) => state.initializeProfiles,
  )
  const clearProfileError = useProjectProfilesStore((state) => state.clearError)
  const projectPath = project?.absolutePath ?? ''

  // Treat both 'idle' and 'loading' as loading states — idle means not yet started
  const isLoading =
    initStatus.status === 'loading' || initStatus.status === 'idle'
  const { graphs, disableStates } = useGraphManager(projectPath)

  const navigate = useNavigate()

  const [filters, setFilters] = useState<KeymapFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<KeymapSort>(DEFAULT_SORT)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingKeymap, setEditingKeymap] = useState<ProjectKeymap | null>(null)
  const [deletingKeymap, setDeletingKeymap] = useState<ProjectKeymap | null>(
    null,
  )
  const [profileManagerOpen, setProfileManagerOpen] = useState(false)
  const profilesReady = isInitReady(profileInitStatus, projectPath)
  const activeProfileIds = getActiveProfileIds(profiles, overrides)

  // Build unified entries list
  const allEntries: KeymapEntry[] = useMemo(
    () => [
      ...graphKeymaps,
      ...manualKeymaps.map(
        (k): ManualKeymapEntry => ({
          source: 'project',
          keymapId: k.id,
          keymap: k,
        }),
      ),
    ],
    [graphKeymaps, manualKeymaps],
  )

  // Apply filters and sort
  const filteredEntries = useFilteredKeymaps(allEntries, filters, sort)

  // Detect conflicts
  const conflicts = useKeymapConflicts(
    allEntries,
    profiles,
    activeProfileIds,
    profilesReady,
  )

  useEffect(() => {
    if (projectPath) {
      void loadAllKeymaps(projectPath)
      void initializeProfiles(projectPath)
    }
  }, [projectPath, loadAllKeymaps, initializeProfiles])

  useEffect(() => {
    if (!projectPath) {
      return
    }

    const handleGraphManagerChanged = (event: Event): void => {
      if (!isGraphManagerChangedEventForProject(event, projectPath)) {
        return
      }

      void refreshGraphKeymaps(projectPath)
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
  }, [projectPath, refreshGraphKeymaps])

  // Tutorial DOM event listeners
  useEffect(() => {
    const handleResetKeymapsPageState = (): void => {
      setFilters(DEFAULT_FILTERS)
      setSort(DEFAULT_SORT)
    }

    const handleOpenKeymapEditor = (): void => {
      setEditingKeymap(null)
      setEditorOpen(true)
    }

    const handleCloseKeymapEditor = (): void => {
      setEditorOpen(false)
    }

    window.addEventListener(
      'tutorial:reset-keymaps-page-state',
      handleResetKeymapsPageState,
    )
    window.addEventListener(
      'tutorial:open-keymap-editor',
      handleOpenKeymapEditor,
    )
    window.addEventListener(
      'tutorial:close-keymap-editor',
      handleCloseKeymapEditor,
    )

    return () => {
      window.removeEventListener(
        'tutorial:reset-keymaps-page-state',
        handleResetKeymapsPageState,
      )
      window.removeEventListener(
        'tutorial:open-keymap-editor',
        handleOpenKeymapEditor,
      )
      window.removeEventListener(
        'tutorial:close-keymap-editor',
        handleCloseKeymapEditor,
      )
    }
  }, [])

  const graphsById = useMemo(() => {
    return new Map(graphs.map((graph) => [graph.id, graph]))
  }, [graphs])

  const getRunCustomActionTargetStatus = useCallback(
    (graphId: string) =>
      resolveRunCustomActionTargetStatus(
        graphId,
        graphsById,
        disableStates.statesByGraphId,
      ),
    [disableStates.statesByGraphId, graphsById],
  )

  const handleNavigateToNode = useCallback(
    (graphId: string, nodeId: string): void => {
      useNavigationIntentStore.getState().setFocusNode({ graphId, nodeId })
      navigate('/editor')
    },
    [navigate],
  )

  const handleNavigateToGraph = useCallback(
    (graphId: string): void => {
      // Navigate to graph without focusing a specific node
      // The graph editor will open the graph in a new tab
      useNavigationIntentStore.getState().setFocusNode({ graphId, nodeId: '' })
      navigate('/editor')
    },
    [navigate],
  )

  const handleEdit = useCallback((keymap: ProjectKeymap): void => {
    setEditingKeymap(keymap)
    setEditorOpen(true)
  }, [])

  const handleDeleteRequest = useCallback((keymap: ProjectKeymap): void => {
    setDeletingKeymap(keymap)
  }, [])

  const handleDeleteConfirm = useCallback((): void => {
    if (deletingKeymap) {
      void deleteManualKeymap(deletingKeymap.id)
      setDeletingKeymap(null)
    }
  }, [deletingKeymap, deleteManualKeymap])

  const handleToggle = useCallback(
    (keymapId: string): void => {
      void toggleManualKeymap(keymapId)
    },
    [toggleManualKeymap],
  )

  const handleEnabledOverrideChange = useCallback(
    (keymapId: string, enabledOverride: boolean | undefined): void => {
      void updateManualKeymap(keymapId, { enabledOverride })
    },
    [updateManualKeymap],
  )

  const handleCreateClick = useCallback((): void => {
    setEditingKeymap(null)
    setEditorOpen(true)
  }, [])

  if (!project) {
    return <div className="p-4">No project loaded</div>
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col" data-tutorial="keymaps-page">
        {/* Header */}
        <header className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Keyboard Shortcuts</h1>
              <p className="text-sm text-muted-foreground">
                Manage keyboard shortcuts for your Neovim configuration
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setProfileManagerOpen(true)}
                disabled={!profilesReady}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Profiles
              </Button>
              <Button
                onClick={handleCreateClick}
                disabled={isLoading}
                data-tutorial="keymaps-new-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Shortcut
              </Button>
            </div>
          </div>

          {/* Filters row — disabled while loading */}
          <div className="flex items-center gap-3 mt-4">
            <Input
              placeholder="Search shortcuts..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="max-w-xs"
              disabled={isLoading}
            />
            <Select
              value={filters.modeFilter}
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  modeFilter: v as KeymapMode | 'all',
                }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                {MODE_ORDER.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.sourceFilter}
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  sourceFilter: v as 'all' | 'graph' | 'project',
                }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="graph">{SOURCE_LABELS.graph}</SelectItem>
                <SelectItem value="project">{SOURCE_LABELS.project}</SelectItem>
              </SelectContent>
            </Select>
            {profiles.length > 0 && (
              <Select
                value={filters.profileFilter}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, profileFilter: v }))
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All profiles</SelectItem>
                  <SelectItem value="none">No profile</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: profile.color }}
                        />
                        {profile.name.trim() || 'Unnamed profile'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
          {/* Error banner */}
          {(error || profileError) && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center justify-between">
              <span>{error ?? profileError}</span>
              <button
                type="button"
                onClick={() => {
                  clearError()
                  clearProfileError()
                }}
                className="p-1 hover:bg-destructive/20 rounded"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isLoading && allEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="text-sm">Loading shortcuts...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              hasKeymaps={allEntries.length > 0}
              onCreateClick={handleCreateClick}
            />
          ) : (
            <KeymapList
              entries={filteredEntries}
              conflicts={conflicts}
              sort={sort}
              onSortChange={setSort}
              onEdit={handleEdit}
              onDeleteRequest={handleDeleteRequest}
              onToggle={handleToggle}
              onEnabledOverrideChange={handleEnabledOverrideChange}
              profilesReady={profilesReady}
              onNavigateToNode={handleNavigateToNode}
              onNavigateToGraph={handleNavigateToGraph}
              getRunCustomActionTargetStatus={getRunCustomActionTargetStatus}
            />
          )}

          {/* Conflict summary */}
          {conflicts.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {conflicts.length} conflict
                    {conflicts.length > 1 ? 's' : ''} detected.
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    In Neovim, the last-defined shortcut wins — the other will
                    be overridden. Consider using a different key.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Editor dialog */}
        <KeymapEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          editingKeymap={editingKeymap}
          projectPath={project.absolutePath}
        />
        <ProfileManagerDialog
          open={profileManagerOpen}
          onOpenChange={setProfileManagerOpen}
          projectPath={projectPath}
        />

        {/* Delete confirmation dialog */}
        <AlertDialog
          open={deletingKeymap !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingKeymap(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete shortcut?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the shortcut for "
                {deletingKeymap?.keySequence}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
