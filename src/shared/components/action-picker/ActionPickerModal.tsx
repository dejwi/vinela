import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContentNoClose } from '@/shared/components/ui/dialog'
import { resolveActionTemplate } from '@/shared/data/neovim/action-catalog'
import {
  addRecentlyUsedAction,
  getRecentlyUsedActions,
} from '@/shared/lib/recently-used-actions'
import type {
  CatalogActionEntry,
  CatalogCategory,
} from '@/shared/types/catalog'
import { ActionPickerCustom } from './ActionPickerCustom'
import { ActionPickerGrid } from './ActionPickerGrid'
import { ActionPickerPreviewCompact } from './ActionPickerPreviewCompact'
import { ActionPickerSearch } from './ActionPickerSearch'
import { ActionPickerSidebar } from './ActionPickerSidebar'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import type {
  ActionPickerModalProps,
  ActionPickerPluginGroup,
  CatalogView,
  InputMode,
} from './types'

export function ActionPickerModal({
  open,
  onOpenChange,
  value,
  onConfirm,
  initialMode,
  catalog,
}: ActionPickerModalProps): React.JSX.Element {
  // Canonical state model - use initialMode prop if provided
  const initialInputMode: InputMode = initialMode
    ? initialMode
    : value.mode.startsWith('custom')
      ? 'custom'
      : 'preset'
  const [inputMode, setInputMode] = useState<InputMode>(initialInputMode)
  const [catalogView, setCatalogView] = useState<CatalogView>('popular')

  const [selectedCategory, setSelectedCategory] =
    useState<CatalogCategory | null>(null)
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Selection state
  const [selectedAction, setSelectedAction] =
    useState<CatalogActionEntry | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})

  // Custom mode state (simplified - no mode tabs, just single input)
  const [customAction, setCustomAction] = useState(value.action)

  // Recently used
  const [recentActions, setRecentActions] = useState(() =>
    getRecentlyUsedActions(),
  )

  // Preview collapse state (persists across action selections)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false)

  // Store catalog state for restoration when switching back from custom
  const catalogStateRef = useRef<{
    selectedAction: CatalogActionEntry | null
    paramValues: Record<string, string>
    catalogView: CatalogView
    selectedCategory: CatalogCategory | null
    selectedPluginId: string | null
    searchQuery: string
  }>({
    selectedAction: null,
    paramValues: {},
    catalogView: 'popular',
    selectedCategory: null,
    selectedPluginId: null,
    searchQuery: '',
  })

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const action of catalog) {
      counts[action.category] = (counts[action.category] ?? 0) + 1
    }
    return counts
  }, [catalog])

  const pluginGroups = useMemo((): readonly ActionPickerPluginGroup[] => {
    const groups = new Map<string, ActionPickerPluginGroup>()
    for (const action of catalog) {
      if (action.source.sourceType === 'core') continue
      const group = groups.get(action.source.pluginId)
      groups.set(action.source.pluginId, {
        pluginId: action.source.pluginId,
        pluginName: action.source.pluginName,
        count: (group?.count ?? 0) + 1,
      })
    }
    return [...groups.values()].sort(
      (left, right) =>
        left.pluginName.localeCompare(right.pluginName) ||
        left.pluginId.localeCompare(right.pluginId),
    )
  }, [catalog])

  // Get displayed actions based on catalog view
  const displayedActions = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return catalog.filter(
        (action) =>
          action.label.toLowerCase().includes(query) ||
          action.shortDescription.toLowerCase().includes(query) ||
          action.aliases.some((alias) => alias.toLowerCase().includes(query)),
      )
    }

    switch (catalogView) {
      case 'popular':
        return catalog.filter((action) => action.isPopular)
      case 'all':
        return catalog
      case 'category':
        return selectedCategory
          ? catalog.filter((action) => action.category === selectedCategory)
          : []
      case 'plugin':
        return selectedPluginId
          ? catalog.filter(
              (action) =>
                action.source.sourceType === 'plugin' &&
                action.source.pluginId === selectedPluginId,
            )
          : []
      default:
        return []
    }
  }, [catalog, catalogView, selectedCategory, selectedPluginId, searchQuery])

  // Handle search focus with /
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && inputMode === 'preset') {
        e.preventDefault()
        document.getElementById('action-search')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, inputMode])

  // Load recent actions when modal opens
  useEffect(() => {
    if (open) {
      setRecentActions(getRecentlyUsedActions())
    }
  }, [open])

  // Reset state when modal opens with new value
  useEffect(() => {
    if (open) {
      // Compute next input mode respecting caller's initialMode preference
      const nextInputMode: InputMode =
        initialMode ?? (value.mode.startsWith('custom') ? 'custom' : 'preset')
      setInputMode(nextInputMode)
      setCatalogView('popular')
      setSelectedCategory(null)
      setSelectedPluginId(null)

      // Restore selection if value has a selected action key (only in preset mode)
      if (nextInputMode === 'preset' && value.selectedActionKey) {
        const action = catalog.find(
          (entry) => entry.key === value.selectedActionKey,
        )
        if (action) {
          setSelectedAction(action)
          setParamValues(value.paramValues)
        }
      }
      setCustomAction(value.action)
    }
  }, [catalog, open, value, initialMode])

  // Handle edit action from preview (switches to custom mode)
  const handleEditPreviewAction = (actionValue: string) => {
    catalogStateRef.current = {
      selectedAction,
      paramValues,
      catalogView,
      selectedCategory,
      selectedPluginId,
      searchQuery,
    }

    // Switch to custom mode with the edited value
    setInputMode('custom')
    setCustomAction(actionValue)
  }

  // Handle confirm
  const handleConfirm = () => {
    if (inputMode === 'custom') {
      const isCommand = customAction.startsWith(':')
      onConfirm({
        mode: isCommand ? 'custom-command' : 'custom-keys',
        actionType: isCommand ? 'command' : 'keys',
        action: customAction,
        selectedActionKey: '',
        paramValues: {},
      })
    } else if (selectedAction) {
      const resolvedAction = resolveActionTemplate(
        selectedAction.template,
        paramValues,
        selectedAction.params,
      )
      addRecentlyUsedAction(selectedAction.key)
      onConfirm({
        mode: 'catalog',
        actionType: selectedAction.type,
        action: resolvedAction,
        selectedActionKey: selectedAction.key,
        paramValues,
      })
    }
    onOpenChange(false)
  }

  // Check for missing required parameters
  const missingRequiredParams = useMemo(() => {
    if (inputMode === 'custom' || !selectedAction?.params) return []

    return selectedAction.params
      .filter((p) => p.required)
      .filter((p) => !paramValues[p.name]?.trim())
  }, [selectedAction, paramValues, inputMode])

  const canConfirm =
    inputMode === 'custom'
      ? customAction.trim().length > 0
      : selectedAction !== null && missingRequiredParams.length === 0

  // Handle switching to custom mode
  const handleSwitchToCustom = () => {
    // Save catalog state before switching
    catalogStateRef.current = {
      selectedAction,
      paramValues,
      catalogView,
      selectedCategory,
      selectedPluginId,
      searchQuery,
    }
    // Switch to custom mode
    setInputMode('custom')
    setSelectedCategory(null)
    setSelectedPluginId(null)
    setSearchQuery('')
  }

  // Handle switching back to preset from custom
  const handleSwitchToPreset = () => {
    // Restore state captured before switching into custom mode
    const restoredState = catalogStateRef.current
    setInputMode('preset')
    setCatalogView(restoredState.catalogView)
    setSelectedCategory(
      restoredState.catalogView === 'category'
        ? restoredState.selectedCategory
        : null,
    )
    setSelectedPluginId(
      restoredState.catalogView === 'plugin'
        ? restoredState.selectedPluginId
        : null,
    )
    setSearchQuery(restoredState.searchQuery)
    setSelectedAction(restoredState.selectedAction)
    setParamValues(restoredState.paramValues)
  }

  // Handle preset view selection (popular, all, category)
  const handleSelectPresetView = (view: 'popular' | 'all') => {
    setInputMode('preset')
    setCatalogView(view)
    setSelectedCategory(null)
    setSelectedPluginId(null)
    setSearchQuery('')
    setSelectedAction(null)
    setParamValues({})
  }

  // Handle category selection
  const handleSelectCategory = (category: CatalogCategory) => {
    setInputMode('preset')
    setCatalogView('category')
    setSelectedCategory(category)
    setSelectedPluginId(null)
    setSearchQuery('')
    setSelectedAction(null)
    setParamValues({})
  }

  const handleSelectPlugin = (pluginId: string): void => {
    setInputMode('preset')
    setCatalogView('plugin')
    setSelectedPluginId(pluginId)
    setSelectedCategory(null)
    setSearchQuery('')
    setSelectedAction(null)
    setParamValues({})
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    if (q.trim()) {
      setCatalogView('all')
    }
  }

  const handleSelectAction = (action: CatalogActionEntry): void => {
    setSelectedAction(action)
    setParamValues(
      Object.fromEntries(
        action.params.flatMap((param) =>
          param.default === undefined ? [] : [[param.name, param.default]],
        ),
      ),
    )
  }

  // Keyboard navigation
  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation({
    itemCount: displayedActions.length,
    onSelect: (index) => {
      const action = displayedActions[index]
      if (action) handleSelectAction(action)
    },
    onEscape: () => onOpenChange(false),
    enabled: inputMode === 'preset',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoClose className="max-w-4xl h-[600px] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* Sidebar */}
          <ActionPickerSidebar
            inputMode={inputMode}
            catalogView={catalogView}
            selectedCategory={selectedCategory}
            selectedPluginId={selectedPluginId}
            pluginGroups={pluginGroups}
            onSwitchToCustom={handleSwitchToCustom}
            onSwitchToPreset={handleSwitchToPreset}
            onSelectPresetView={handleSelectPresetView}
            onSelectCategory={handleSelectCategory}
            onSelectPlugin={handleSelectPlugin}
            categoryCounts={categoryCounts}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {/* Header with search */}
            <div className="p-4 border-b flex items-center gap-4 shrink-0">
              <ActionPickerSearch
                id="action-search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search actions... (press / to focus)"
                disabled={inputMode === 'custom'}
              />

              {/* Catalog view toggle (only in preset mode) */}
              {inputMode === 'preset' && !searchQuery && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant={catalogView === 'popular' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleSelectPresetView('popular')}
                  >
                    Popular
                  </Button>
                  <Button
                    variant={catalogView === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleSelectPresetView('all')}
                  >
                    All Actions
                  </Button>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {inputMode === 'custom' ? (
                <div className="flex-1 overflow-auto">
                  <ActionPickerCustom
                    value={customAction}
                    onChange={setCustomAction}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Recently Used (hidden when action is selected) */}
                  {!selectedAction &&
                    catalogView === 'popular' &&
                    !searchQuery &&
                    recentActions.length > 0 && (
                      <div className="px-4 pt-4 shrink-0">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Recently Used
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {recentActions.map((recent) => {
                            const action = catalog.find(
                              (entry) => entry.key === recent.key,
                            )
                            if (!action) return null
                            return (
                              <Button
                                key={recent.key}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSelectAction(action)}
                              >
                                {action.label}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                  {/* Catalog grid stays visible until expanded details fill the body. */}
                  {(selectedAction === null || isPreviewCollapsed) && (
                    <div className="flex-[2_1_0%] min-h-32 min-w-0">
                      <ActionPickerGrid
                        actions={displayedActions}
                        selectedAction={selectedAction}
                        focusedIndex={focusedIndex}
                        onSelectAction={handleSelectAction}
                        onFocusChange={setFocusedIndex}
                      />
                    </div>
                  )}

                  {/* Expanded configuration fills and scrolls within the available body. */}
                  {selectedAction && (
                    <ActionPickerPreviewCompact
                      action={selectedAction}
                      paramValues={paramValues}
                      onParamChange={(name: string, value: string) =>
                        setParamValues((prev) => ({ ...prev, [name]: value }))
                      }
                      onEditAction={handleEditPreviewAction}
                      isCollapsed={isPreviewCollapsed}
                      onCollapseChange={setIsPreviewCollapsed}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Missing required params warning */}
            {missingRequiredParams.length > 0 && (
              <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 shrink-0">
                <p className="text-xs text-destructive">
                  Required:{' '}
                  {missingRequiredParams.map((p) => p.label).join(', ')}
                </p>
              </div>
            )}

            {/* Footer - always visible */}
            <div className="p-4 border-t flex items-center justify-between shrink-0">
              <p className="text-xs text-muted-foreground">
                {inputMode === 'preset' && (
                  <>
                    <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                      ↑↓
                    </kbd>{' '}
                    navigate{' '}
                    <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                      Enter
                    </kbd>{' '}
                    select{' '}
                    <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                      /
                    </kbd>{' '}
                    search{' '}
                    <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                      Esc
                    </kbd>{' '}
                    close
                  </>
                )}
                {inputMode === 'custom' && (
                  <span>Commands start with : (e.g., :write, :quit)</span>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={!canConfirm}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContentNoClose>
    </Dialog>
  )
}
