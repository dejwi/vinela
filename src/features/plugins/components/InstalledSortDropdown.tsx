import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { InstalledSortOption } from '../sort-filter'

// ============================================
// Sort option labels
// ============================================

const INSTALLED_SORT_LABELS: Record<InstalledSortOption, string> = {
  'name-asc': 'Name (A–Z)',
  'recently-added': 'Recently Added',
}

// ============================================
// InstalledSortDropdown
// ============================================

export interface InstalledSortDropdownProps {
  value: InstalledSortOption
  onChange: (option: InstalledSortOption) => void
}

/**
 * Sort dropdown for the Installed tab.
 *
 * Options:
 *   - "Name (A–Z)"      → 'name-asc'
 *   - "Recently Added"  → 'recently-added'
 */
export function InstalledSortDropdown({
  value,
  onChange,
}: InstalledSortDropdownProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Sort by</span>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as InstalledSortOption)}
      >
        <SelectTrigger className="w-[160px] min-h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(
            Object.entries(INSTALLED_SORT_LABELS) as [
              InstalledSortOption,
              string,
            ][]
          ).map(([optionValue, label]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
