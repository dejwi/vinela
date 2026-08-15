/**
 * CategoryItem Component
 *
 * Individual category button for the category sidebar.
 * Shows label with total count and visible count (when filtered).
 * Uses a stacked layout with inline text labels for clarity.
 */

import { cn } from '@/shared/lib/utils'

export interface CategoryItemProps {
  /** Category display label */
  label: string
  /** Total number of options in this category */
  totalCount: number
  /** Number of visible/filtered options in this category */
  visibleCount: number
  /** Whether this category is currently selected */
  isSelected: boolean
  /** Click handler */
  onClick: () => void
}

export function CategoryItem({
  label,
  totalCount,
  visibleCount,
  isSelected,
  onClick,
}: CategoryItemProps): React.JSX.Element {
  // Determine if filtering is active (visible !== total)
  const isFiltered = visibleCount !== totalCount
  const hasNoVisible = visibleCount === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex flex-col gap-0.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected &&
          'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]',
        !isSelected && 'border-l-2 border-transparent pl-[10px]',
        hasNoVisible && isFiltered && 'opacity-50',
      )}
      aria-pressed={isSelected}
    >
      <span className="font-medium truncate">{label}</span>
      <span
        className={cn(
          'text-xs',
          isSelected ? 'text-primary/70' : 'text-muted-foreground',
        )}
      >
        {totalCount} option{totalCount !== 1 ? 's' : ''}
        {isFiltered && (
          <span className={cn(hasNoVisible && 'text-muted-foreground/50')}>
            {' · '}
            {visibleCount} visible
          </span>
        )}
      </span>
    </button>
  )
}
