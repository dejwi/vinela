import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  type CatalogEntry,
} from '@/shared/types/catalog'
import { CatalogEntryCard } from './CatalogEntryCard'

export interface CatalogContentProps {
  entries: CatalogEntry[]
  selectedEntry: CatalogEntry | null
  onSelectEntry: (entry: CatalogEntry) => void
  focusedIndex: number
  searchQuery: string
}

export function CatalogContent({
  entries,
  selectedEntry,
  onSelectEntry,
  focusedIndex,
  searchQuery,
}: CatalogContentProps): React.JSX.Element {
  // If searching, show flat list
  if (searchQuery.trim()) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map((entry, index) => (
            <CatalogEntryCard
              key={entry.key}
              entry={entry}
              selected={selectedEntry?.key === entry.key}
              focused={index === focusedIndex}
              onClick={() => onSelectEntry(entry)}
            />
          ))}
        </div>
        {entries.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No results found for "{searchQuery}"
          </div>
        )}
      </div>
    )
  }

  // Group by category
  const entriesByCategory = CATALOG_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = entries.filter((e) => e.category === cat)
      return acc
    },
    {} as Record<string, CatalogEntry[]>,
  )

  let currentIndex = 0

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-6">
        {CATALOG_CATEGORIES.map((category) => {
          const categoryEntries = entriesByCategory[category]
          if (!categoryEntries || categoryEntries.length === 0) return null

          const categoryStartIndex = currentIndex
          currentIndex += categoryEntries.length

          return (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3">
                {CATALOG_CATEGORY_LABELS[category]}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryEntries.map((entry, index) => {
                  const globalIndex = categoryStartIndex + index
                  return (
                    <CatalogEntryCard
                      key={entry.key}
                      entry={entry}
                      selected={selectedEntry?.key === entry.key}
                      focused={globalIndex === focusedIndex}
                      onClick={() => onSelectEntry(entry)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {entries.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No entries in this view
        </div>
      )}
    </div>
  )
}
