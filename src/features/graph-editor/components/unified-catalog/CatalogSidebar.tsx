import * as Icons from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_ICONS,
  CATALOG_CATEGORY_LABELS,
  type CatalogCategory,
  type CatalogEntry,
  type CatalogSource,
} from '@/shared/types/catalog'
import type { CatalogView } from './UnifiedCatalogModal'

export interface CatalogSidebarProps {
  catalogView: CatalogView
  onViewChange: (view: CatalogView) => void
  selectedCategory: CatalogCategory | null
  onCategorySelect: (category: CatalogCategory) => void
  selectedSource: CatalogSource | null
  onSourceSelect: (source: CatalogSource) => void
  sources: CatalogSource[]
  catalog: CatalogEntry[]
}

export function CatalogSidebar({
  catalogView,
  onViewChange,
  selectedCategory,
  onCategorySelect,
  selectedSource,
  onSourceSelect,
  sources,
  catalog,
}: CatalogSidebarProps): React.JSX.Element {
  // Count entries by category
  const categoryCounts = CATALOG_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = catalog.filter((e) => e.category === cat).length
      return acc
    },
    {} as Record<CatalogCategory, number>,
  )

  // Count entries by source
  const sourceCounts = sources.reduce(
    (acc, source) => {
      const key = source.sourceType === 'core' ? 'core' : source.pluginId
      acc[key] = catalog.filter((e) => {
        if (source.sourceType === 'core') {
          return e.source.sourceType === 'core'
        }
        return (
          e.source.sourceType === 'plugin' &&
          e.source.pluginId === source.pluginId
        )
      }).length
      return acc
    },
    {} as Record<string, number>,
  )

  const popularCount = catalog.filter((e) => e.isPopular).length

  return (
    <div className="w-56 border-r bg-muted/30 overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Views */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Views
          </h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onViewChange('popular')}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                catalogView === 'popular'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              <div className="flex items-center justify-between">
                <span>Popular</span>
                <span className="text-xs opacity-70">{popularCount}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('all')}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                catalogView === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              <div className="flex items-center justify-between">
                <span>All</span>
                <span className="text-xs opacity-70">{catalog.length}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Categories
          </h3>
          <div className="space-y-1">
            {CATALOG_CATEGORIES.filter((cat) => categoryCounts[cat] > 0).map(
              (category) => {
                const iconName = CATALOG_CATEGORY_ICONS[category]
                const Icon =
                  (
                    Icons as unknown as Record<
                      string,
                      React.ComponentType<{ className?: string }>
                    >
                  )[iconName] ?? Icons.Circle
                const count = categoryCounts[category]

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onCategorySelect(category)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      catalogView === 'category' &&
                        selectedCategory === category
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">
                        {CATALOG_CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-xs opacity-70">{count}</span>
                    </div>
                  </button>
                )
              },
            )}
          </div>
        </div>

        {/* Sources */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Sources
          </h3>
          <div className="space-y-1">
            {sources.map((source) => {
              const key =
                source.sourceType === 'core' ? 'core' : source.pluginId
              const label =
                source.sourceType === 'core' ? 'Core' : source.pluginName
              const count = sourceCounts[key] ?? 0

              const isSelected =
                catalogView === 'source' &&
                selectedSource !== null &&
                (selectedSource.sourceType === 'core'
                  ? source.sourceType === 'core'
                  : selectedSource.sourceType === 'plugin' &&
                    source.sourceType === 'plugin' &&
                    selectedSource.pluginId === source.pluginId)

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSourceSelect(source)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{label}</span>
                    <span className="text-xs opacity-70">{count}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
