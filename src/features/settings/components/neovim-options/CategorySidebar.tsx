/**
 * CategorySidebar Component
 *
 * Left sidebar with category list for the Neovim Options page.
 * Shows "All Categories" at top, then all 11 categories from CATEGORY_ORDER.
 * Displays total count and visible count per category.
 */

import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Separator } from '@/shared/components/ui/separator'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/shared/lib/neovim-options/catalog'
import type { NeovimOptionCategory } from '@/shared/types/neovim-options'
import { CategoryItem } from './CategoryItem'

export interface CategorySidebarProps {
  /** Currently selected category (null = all) */
  selectedCategory: NeovimOptionCategory | null
  /** Callback when a category is selected */
  onSelectCategory: (category: NeovimOptionCategory | null) => void
  /** Total count of options per category (unfiltered) */
  totalCounts: Record<NeovimOptionCategory, number>
  /** Count of visible/filtered options per category */
  visibleCounts: Record<NeovimOptionCategory, number>
}

export function CategorySidebar({
  selectedCategory,
  onSelectCategory,
  totalCounts,
  visibleCounts,
}: CategorySidebarProps): React.JSX.Element {
  // Calculate total count across all categories
  const grandTotal = Object.values(totalCounts).reduce(
    (sum, count) => sum + count,
    0,
  )

  // Calculate total visible count
  const totalVisible = Object.values(visibleCounts).reduce(
    (sum, count) => sum + count,
    0,
  )

  return (
    <aside className="w-56 shrink-0 border-r bg-card overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-1">
          {/* "All Categories" option at top */}
          <CategoryItem
            label="All Categories"
            totalCount={grandTotal}
            visibleCount={totalVisible}
            isSelected={selectedCategory === null}
            onClick={() => onSelectCategory(null)}
          />

          <Separator className="my-2" />

          {/* Individual categories */}
          {CATEGORY_ORDER.map((category) => (
            <CategoryItem
              key={category}
              label={CATEGORY_LABELS[category]}
              totalCount={totalCounts[category] ?? 0}
              visibleCount={visibleCounts[category] ?? 0}
              isSelected={selectedCategory === category}
              onClick={() => onSelectCategory(category)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
