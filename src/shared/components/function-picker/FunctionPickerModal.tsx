import { Code2, Grid, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CatalogPickerGrid,
  CatalogPickerSearch,
  CatalogPickerSidebar,
  type CatalogPickerSidebarSection,
  useKeyboardNavigation,
} from '@/shared/components/catalog-picker'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContentNoClose } from '@/shared/components/ui/dialog'
import type { FunctionCatalog } from '@/shared/data/function-catalog-builder'
import {
  findFunctionByKey,
  getFunctionCategoryCounts,
  getFunctionsByCategory,
  getPopularFunctions,
  searchFunctions,
} from '@/shared/data/function-catalog-builder'
import type { FunctionCatalogEntry } from '@/shared/data/function-catalog-types'
import {
  addRecentlyUsedFunction,
  getRecentlyUsedFunctions,
} from '@/shared/lib/recently-used-functions'
import { FunctionInfoTooltip } from './FunctionInfoTooltipContent'

// ============================================
// Props
// ============================================

export interface FunctionPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: FunctionCatalog
  /** Currently selected function key (for pre-selection) */
  selectedFunctionKey: string
  /** Called when user confirms a function selection */
  onConfirm: (entry: FunctionCatalogEntry) => void
}

// ============================================
// View keys
// ============================================

const VIEW_POPULAR = '__popular__'
const VIEW_ALL = '__all__'

// Minimum popular entries to show the Popular view
const MIN_POPULAR_FOR_VIEW = 3

// ============================================
// Component
// ============================================

export function FunctionPickerModal({
  open,
  onOpenChange,
  catalog,
  selectedFunctionKey,
  onConfirm,
}: FunctionPickerModalProps): React.JSX.Element {
  const [activeView, setActiveView] = useState(VIEW_ALL)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntry, setSelectedEntry] =
    useState<FunctionCatalogEntry | null>(null)
  const wasOpenRef = useRef(false)
  const [recentFunctions, setRecentFunctions] = useState(() =>
    getRecentlyUsedFunctions(),
  )

  // Popular entries (excluding advancedOnly)
  const popularEntries = useMemo(() => getPopularFunctions(catalog), [catalog])

  // Fallback: if fewer than MIN_POPULAR_FOR_VIEW popular entries, skip Popular view
  const showPopularView = popularEntries.length >= MIN_POPULAR_FOR_VIEW

  // Category counts
  const categoryCounts = useMemo(
    () => getFunctionCategoryCounts(catalog),
    [catalog],
  )

  // Sidebar data
  const views: CatalogPickerSidebarSection[] = useMemo(
    () => [
      ...(showPopularView
        ? [
            {
              key: VIEW_POPULAR,
              label: 'Popular',
              icon: <Star className="h-4 w-4" />,
              count: popularEntries.length,
            },
          ]
        : []),
      {
        key: VIEW_ALL,
        label: 'All Functions',
        icon: <Grid className="h-4 w-4" />,
        count: catalog.entries.length,
      },
    ],
    [catalog.entries.length, popularEntries.length, showPopularView],
  )

  const sidebarCategories: CatalogPickerSidebarSection[] = useMemo(
    () =>
      catalog.categories.map((cat) => ({
        key: cat.key,
        label: cat.label,
        icon: cat.icon ? <Code2 className="h-4 w-4" /> : undefined,
        count: categoryCounts[cat.key],
      })),
    [catalog.categories, categoryCounts],
  )

  // Displayed entries
  const displayedEntries = useMemo(() => {
    if (searchQuery.trim()) {
      return searchFunctions(catalog, searchQuery)
    }
    if (activeView === VIEW_POPULAR) {
      return popularEntries
    }
    if (activeView === VIEW_ALL) {
      return catalog.entries
    }
    // Category view
    return getFunctionsByCategory(catalog, activeView)
  }, [catalog, activeView, searchQuery, popularEntries])

  // Keyboard nav
  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation({
    itemCount: displayedEntries.length,
    onSelect: (index) => {
      const entry = displayedEntries[index]
      if (entry) setSelectedEntry(entry)
    },
    onEscape: () => onOpenChange(false),
    enabled: open,
  })

  // Search focus shortcut
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('function-search')?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Load recents on open
  useEffect(() => {
    if (open) setRecentFunctions(getRecentlyUsedFunctions())
  }, [open])

  // Reset picker state on open (pre-select from props when available)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const entry =
        selectedFunctionKey.length > 0
          ? (findFunctionByKey(catalog, selectedFunctionKey) ?? null)
          : null

      // Default to Popular view on open (if available), else All
      setActiveView(showPopularView ? VIEW_POPULAR : VIEW_ALL)
      setSearchQuery('')
      setSelectedEntry(entry)
      setFocusedIndex(0)
    }

    wasOpenRef.current = open
  }, [catalog, open, selectedFunctionKey, setFocusedIndex, showPopularView])

  // Confirm handler
  const handleConfirm = () => {
    if (!selectedEntry) return
    addRecentlyUsedFunction(selectedEntry.key)
    onConfirm(selectedEntry)
    onOpenChange(false)
  }

  // Sidebar select
  const handleSidebarSelect = (key: string) => {
    setActiveView(key)
    setSearchQuery('')
    setSelectedEntry(null)
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    if (q.trim()) setActiveView(VIEW_ALL)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoClose className="max-w-4xl h-[600px] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* Sidebar */}
          <CatalogPickerSidebar
            title="Functions"
            activeView={activeView}
            views={views}
            categories={sidebarCategories}
            onSelect={handleSidebarSelect}
            showClose
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-4 shrink-0">
              <CatalogPickerSearch
                id="function-search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search functions... (press / to focus)"
              />
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Recently Used */}
              {!selectedEntry &&
                activeView !== VIEW_POPULAR &&
                activeView === VIEW_ALL &&
                !searchQuery &&
                recentFunctions.length > 0 && (
                  <div className="px-4 pt-4 shrink-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Recently Used
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {recentFunctions.map((recent) => {
                        const entry = findFunctionByKey(catalog, recent.key)
                        if (!entry) return null
                        return (
                          <Button
                            key={recent.key}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            {entry.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}

              {/* Grid */}
              <div className="flex-1 min-h-0">
                <CatalogPickerGrid<FunctionCatalogEntry>
                  items={displayedEntries}
                  selectedKey={selectedEntry?.key ?? null}
                  focusedIndex={focusedIndex}
                  onSelect={setSelectedEntry}
                  onFocusChange={setFocusedIndex}
                  renderInfoSlot={(item) => (
                    <FunctionInfoTooltip entry={item} />
                  )}
                  emptyMessage="No functions found"
                />
              </div>

              {/* Selected function preview */}
              {selectedEntry && (
                <div className="p-4 border-t bg-muted/30 shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {selectedEntry.label}
                        </p>
                        {selectedEntry.isTemplate === true && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium">
                            Template
                          </span>
                        )}
                        {selectedEntry.isPlugin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-medium">
                            Plugin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedEntry.whatItDoes ?? selectedEntry.notes}
                      </p>
                      {selectedEntry.technicalNote !== undefined && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
                          {selectedEntry.technicalNote}
                        </p>
                      )}
                    </div>
                    <code className="text-[10px] text-muted-foreground shrink-0">
                      {selectedEntry.sourceDoc}
                    </code>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex items-center justify-between shrink-0">
              <p className="text-xs text-muted-foreground">
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
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={!selectedEntry}>
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
