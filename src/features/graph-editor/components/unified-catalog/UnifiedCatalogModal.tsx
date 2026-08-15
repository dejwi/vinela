import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContentNoClose,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { resolveActionTemplate } from '@/shared/data/neovim/action-catalog'
import type {
  ActionNodeData,
  RunActionActionConfig,
  RunFunctionNodeData,
} from '@/shared/types'
import type {
  CatalogCategory,
  CatalogEntry,
  CatalogSource,
} from '@/shared/types/catalog'
import { useCatalog } from '../../hooks/useCatalog'
import { CatalogContent } from './CatalogContent'
import { CatalogDetailPanel } from './CatalogDetailPanel'
import { CatalogSearch } from './CatalogSearch'
import { CatalogSidebar } from './CatalogSidebar'
import { useCatalogSelection } from './hooks/useCatalogSelection'

export type CatalogView = 'popular' | 'all' | 'category' | 'source'

/**
 * Check if all required params have values.
 * Functions don't need validation here (params filled in properties panel).
 */
function hasAllRequiredParams(
  entry: CatalogEntry | null,
  paramValues: Record<string, string>,
): boolean {
  if (!entry) return false
  if (entry.type === 'function') {
    // Function params are filled in properties panel, not here
    return true
  }
  // For command/keys, check required params
  for (const param of entry.params) {
    if (param.required && !paramValues[param.name]?.trim()) {
      return false
    }
  }
  return true
}

export interface UnifiedCatalogModalProps {
  open: boolean
  onClose: () => void
  onSelect: (
    nodeData: RunFunctionNodeData | ActionNodeData,
    position?: { x: number; y: number },
  ) => void
}

export function UnifiedCatalogModal({
  open,
  onClose,
  onSelect,
}: UnifiedCatalogModalProps): React.JSX.Element {
  // Get full catalog from hook
  const fullCatalog = useCatalog()

  // View state
  const [catalogView, setCatalogView] = useState<CatalogView>('popular')
  const [selectedCategory, setSelectedCategory] =
    useState<CatalogCategory | null>(null)
  const [selectedSource, setSelectedSource] = useState<CatalogSource | null>(
    null,
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Selection state
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})

  // Get unique sources from catalog
  const sources = useMemo(() => {
    const sourceMap = new Map<string, CatalogSource>()
    for (const entry of fullCatalog) {
      const key =
        entry.source.sourceType === 'core' ? 'core' : entry.source.pluginId
      if (!sourceMap.has(key)) {
        sourceMap.set(key, entry.source)
      }
    }
    return Array.from(sourceMap.values())
  }, [fullCatalog])

  // Filter catalog based on view
  const displayedEntries = useMemo(() => {
    let filtered = fullCatalog

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (entry) =>
          entry.label.toLowerCase().includes(query) ||
          entry.shortDescription.toLowerCase().includes(query) ||
          entry.aliases.some((alias) => alias.toLowerCase().includes(query)),
      )
    }

    // Apply view filter
    switch (catalogView) {
      case 'popular':
        filtered = filtered.filter((entry) => entry.isPopular)
        break
      case 'category':
        if (selectedCategory) {
          filtered = filtered.filter(
            (entry) => entry.category === selectedCategory,
          )
        }
        break
      case 'source':
        if (selectedSource) {
          filtered = filtered.filter((entry) => {
            if (selectedSource.sourceType === 'core') {
              return entry.source.sourceType === 'core'
            }
            return (
              entry.source.sourceType === 'plugin' &&
              entry.source.pluginId === selectedSource.pluginId
            )
          })
        }
        break
      case 'all':
        // No additional filtering
        break
    }

    return filtered
  }, [fullCatalog, catalogView, selectedCategory, selectedSource, searchQuery])

  // Keyboard navigation
  const { focusedIndex, setFocusedIndex } = useCatalogSelection({
    itemCount: displayedEntries.length,
    onSelect: (index) => {
      const entry = displayedEntries[index]
      if (entry) handleSelectEntry(entry)
      setFocusedIndex(index)
    },
    onEscape: onClose,
    enabled: open,
  })

  // Handle search focus with /
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('catalog-search')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCatalogView('popular')
      setSelectedCategory(null)
      setSelectedSource(null)
      setSearchQuery('')
      setSelectedEntry(null)
      setParamValues({})
      setFocusedIndex(0)
    }
  }, [open, setFocusedIndex])

  // Handle category selection
  const handleCategorySelect = (category: CatalogCategory) => {
    setSelectedCategory(category)
    setCatalogView('category')
    setSelectedSource(null)
  }

  // Handle source selection
  const handleSourceSelect = (source: CatalogSource) => {
    setSelectedSource(source)
    setCatalogView('source')
    setSelectedCategory(null)
  }

  // Handle view change
  const handleViewChange = (view: CatalogView) => {
    setCatalogView(view)
    if (view !== 'category') setSelectedCategory(null)
    if (view !== 'source') setSelectedSource(null)
  }

  // Handle insert
  const handleInsert = () => {
    if (!selectedEntry) return

    if (selectedEntry.type === 'function') {
      // Create RunFunctionNode
      const nodeData: RunFunctionNodeData = {
        nodeType: 'run-function',
        displayName: selectedEntry.label,
        selectedFunctionKey: selectedEntry.key,
        functionSource: {
          type: 'plugin',
          pluginId: selectedEntry.pluginId,
          functionName: selectedEntry.functionName,
        },
        // NOTE: Signature is initially null because the catalog entry doesn't include
        // full function signature details (params with types, luaCall template). The
        // properties panel lazily loads and hydrates the signature when the node is
        // selected. This is Option B from the design decision (2026-02-21).
        // TODO: Option C - Consider including signature in CatalogEntry for instant UX.
        signature: null,
        paramDefaults: {},
      }
      onSelect(nodeData)
    } else {
      // Create ActionNode for command or keys
      const resolvedAction = resolveActionTemplate(
        selectedEntry.template,
        paramValues,
        selectedEntry.params,
      )

      const actionConfig: RunActionActionConfig = {
        actionConfigType: 'run-action',
        mode: 'catalog',
        actionType: selectedEntry.type, // 'command' or 'keys'
        action: resolvedAction,
        selectedActionKey: selectedEntry.key,
        paramValues,
      }

      const nodeData: ActionNodeData = {
        nodeType: 'action',
        label: selectedEntry.label,
        actionType: 'run-action',
        actionConfig,
      }
      onSelect(nodeData)
    }

    onClose()
  }

  function handleSelectEntry(entry: CatalogEntry): void {
    setSelectedEntry(entry)
    if (entry.type !== 'function') {
      setParamValues(
        Object.fromEntries(
          entry.params.flatMap((param) =>
            param.default === undefined ? [] : [[param.name, param.default]],
          ),
        ),
      )
    }
  }

  // Check if insert is enabled (entry selected + all required params filled)
  const canInsert = hasAllRequiredParams(selectedEntry, paramValues)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContentNoClose className="max-w-6xl h-[80vh] flex flex-col p-0">
        {/* Accessibility: Hidden title and description for screen readers */}
        <DialogTitle className="sr-only">Action & Function Catalog</DialogTitle>
        <DialogDescription className="sr-only">
          Browse and search available actions and functions to add to your
          graph.
        </DialogDescription>

        {/* Search Header */}
        <div className="p-4 border-b">
          <CatalogSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search actions and functions..."
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <CatalogSidebar
            catalogView={catalogView}
            onViewChange={handleViewChange}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            selectedSource={selectedSource}
            onSourceSelect={handleSourceSelect}
            sources={sources}
            catalog={fullCatalog}
          />

          {/* Content Grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <CatalogContent
              entries={displayedEntries}
              selectedEntry={selectedEntry}
              onSelectEntry={handleSelectEntry}
              focusedIndex={focusedIndex}
              searchQuery={searchQuery}
            />

            {/* Detail Panel */}
            {selectedEntry && (
              <CatalogDetailPanel
                entry={selectedEntry}
                paramValues={paramValues}
                onParamValuesChange={setParamValues}
                onInsert={handleInsert}
                canInsert={canInsert}
              />
            )}
          </div>
        </div>
      </DialogContentNoClose>
    </Dialog>
  )
}
