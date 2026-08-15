import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { PluginCategory } from '@/shared/types'
import { PLUGIN_CATEGORIES, PLUGIN_CATEGORY_LABELS } from '@/shared/types'

// ============================================
// Category icons (emoji-based, lightweight)
// ============================================

const CATEGORY_ICONS: Record<PluginCategory, string> = {
  editor: '✏️',
  lsp: '🔧',
  ui: '🎨',
  navigation: '🔭',
  git: '🌿',
  debugging: '🐛',
  syntax: '🌳',
  utility: '⚡',
}

// ============================================
// Props
// ============================================

export interface CategoryFilterProps {
  /** Currently selected category, or null for "All" */
  selectedCategory: PluginCategory | null
  /** Called when a category chip is clicked */
  onSelectCategory: (category: PluginCategory | null) => void
  /** Count of plugins per category (for the current search query) */
  categoryCounts: Partial<Record<PluginCategory, number>>
  /** Total plugin count (shown on the "All" chip) */
  totalCount: number
}

// ============================================
// CategoryFilter
// ============================================

/**
 * Horizontal scrollable chip list for filtering plugins by category.
 *
 * - "All" chip is always first and shows the total count
 * - Per-category chips are shown only when count > 0
 * - Active chip has primary color background
 * - Inactive chips have muted background with hover accent
 */
export function CategoryFilter({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  totalCount,
}: CategoryFilterProps): React.JSX.Element {
  const hasActiveFilter = selectedCategory !== null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* "All" chip */}
      <CategoryChip
        label="All"
        count={totalCount}
        isActive={!hasActiveFilter}
        onClick={() => onSelectCategory(null)}
        aria-label="Show all plugins"
      />

      {/* Per-category chips — only show categories with plugins */}
      {PLUGIN_CATEGORIES.map((category) => {
        const count = categoryCounts[category] ?? 0
        if (count === 0) return null
        return (
          <CategoryChip
            key={category}
            label={PLUGIN_CATEGORY_LABELS[category]}
            icon={CATEGORY_ICONS[category]}
            count={count}
            isActive={selectedCategory === category}
            onClick={() => onSelectCategory(category)}
            aria-label={`Filter by ${PLUGIN_CATEGORY_LABELS[category]}`}
          />
        )
      })}

      {/* Clear filter button */}
      {hasActiveFilter && (
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={() => onSelectCategory(null)}
          aria-label="Clear category filter"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  )
}

// ============================================
// CategoryChip (internal)
// ============================================

interface CategoryChipProps {
  label: string
  icon?: string | undefined
  count: number
  isActive: boolean
  onClick: () => void
  'aria-label': string
}

function CategoryChip({
  label,
  icon,
  count,
  isActive,
  onClick,
  'aria-label': ariaLabel,
}: CategoryChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm cursor-pointer transition-colors select-none',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isActive}
    >
      {icon !== undefined && (
        <span aria-hidden className="text-xs">
          {icon}
        </span>
      )}
      <span>{label}</span>
      <span
        className={cn(
          'text-xs font-medium tabular-nums',
          isActive ? 'opacity-80' : 'opacity-60',
        )}
      >
        {count}
      </span>
    </button>
  )
}
