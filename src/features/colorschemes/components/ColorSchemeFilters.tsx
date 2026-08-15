import { Moon, Sun, SunMoon, Target } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

export type VariantFilter = 'all' | 'dark' | 'light'
export type SortOption = 'stars' | 'name'

interface ColorSchemeFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  variant: VariantFilter
  onVariantChange: (value: VariantFilter) => void
  sort: SortOption
  onSortChange: (value: SortOption) => void
  showInstalled: boolean
  onShowInstalledChange: (value: boolean) => void
  installedCount: number
  activeSchemeId: string | null
  onJumpToActive: () => void
}

export function ColorSchemeFilters({
  search,
  onSearchChange,
  variant,
  onVariantChange,
  sort,
  onSortChange,
  showInstalled,
  onShowInstalledChange,
  installedCount,
  activeSchemeId,
  onJumpToActive,
}: ColorSchemeFiltersProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Search color schemes..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Variant toggle */}
        <ToggleGroup
          type="single"
          value={variant}
          onValueChange={(v) => v && onVariantChange(v as VariantFilter)}
        >
          <ToggleGroupItem value="all" aria-label="All variants">
            <SunMoon className="w-4 h-4 mr-1" />
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark themes">
            <Moon className="w-4 h-4 mr-1" />
            Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="light" aria-label="Light themes">
            <Sun className="w-4 h-4 mr-1" />
            Light
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Sort options */}
        <ToggleGroup
          type="single"
          value={sort}
          onValueChange={(v) => v && onSortChange(v as SortOption)}
        >
          <ToggleGroupItem value="stars">Stars</ToggleGroupItem>
          <ToggleGroupItem value="name">Name</ToggleGroupItem>
        </ToggleGroup>

        {/* Installed filter chip */}
        <button
          type="button"
          onClick={() => onShowInstalledChange(!showInstalled)}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors',
            showInstalled
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80',
          )}
        >
          Installed
          <Badge variant="secondary" className="ml-1 text-xs">
            {installedCount}
          </Badge>
        </button>

        {/* Jump to Active button */}
        {activeSchemeId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onJumpToActive}
            className="gap-1"
          >
            <Target className="w-4 h-4" />
            Jump to Active
          </Button>
        )}
      </div>
    </div>
  )
}
