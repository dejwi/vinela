/**
 * FilterChips Component
 *
 * Horizontal chip/pill buttons for quick filtering of Neovim options.
 */

import { Badge } from '@/shared/components/ui/badge'
import type { FilterType } from '@/shared/types/neovim-options'

export interface FilterChipsProps {
  activeFilters: FilterType[]
  onChange: (filters: FilterType[]) => void
  availableCounts: Partial<Record<FilterType, number>>
  disabledFilters?: FilterType[]
}

const FILTER_CONFIG: Record<
  FilterType,
  { label: string; description: string }
> = {
  recommended: {
    label: 'Recommended',
    description: 'Show only community-recommended options',
  },
  modified: {
    label: 'Modified',
    description: "Show only options you've changed from defaults",
  },
  conflicts: {
    label: 'Has Conflicts',
    description: 'Show only options also set in automation graphs',
  },
}

export function FilterChips({
  activeFilters,
  onChange,
  availableCounts,
  disabledFilters = [],
}: FilterChipsProps): React.JSX.Element {
  const toggleFilter = (filter: FilterType) => {
    if (activeFilters.includes(filter)) {
      onChange(activeFilters.filter((f) => f !== filter))
    } else {
      onChange([...activeFilters, filter])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(FILTER_CONFIG) as FilterType[]).map((filter) => {
        const isActive = activeFilters.includes(filter)
        const isDisabled = disabledFilters.includes(filter)
        const count = availableCounts[filter]
        const config = FILTER_CONFIG[filter]

        return (
          <button
            key={filter}
            type="button"
            onClick={() => !isDisabled && toggleFilter(filter)}
            disabled={isDisabled}
            title={config.description}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm
              transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
              ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
                  : isActive
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary'
                    : 'bg-muted hover:bg-muted/80 text-foreground focus:ring-ring'
              }
            `}
          >
            {config.label}
            {count !== undefined && count > 0 && (
              <Badge
                variant={isActive ? 'outline' : 'secondary'}
                className={`h-5 min-w-5 px-1 text-xs ${
                  isActive
                    ? 'border-primary-foreground text-primary-foreground'
                    : ''
                }`}
              >
                {count}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
