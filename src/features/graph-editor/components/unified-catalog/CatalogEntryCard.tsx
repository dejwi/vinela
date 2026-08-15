import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import type { CatalogEntry } from '@/shared/types/catalog'

export interface CatalogEntryCardProps {
  entry: CatalogEntry
  selected: boolean
  focused: boolean
  onClick: () => void
}

export function CatalogEntryCard({
  entry,
  selected,
  focused,
  onClick,
}: CatalogEntryCardProps): React.JSX.Element {
  // Get source badge text
  const sourceBadge =
    entry.source.sourceType === 'core' ? 'core' : entry.source.pluginName

  // Get type badge
  const typeBadge =
    entry.type === 'function' ? 'fn' : entry.type === 'command' ? 'cmd' : 'keys'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        selected && 'border-primary bg-primary/5',
        focused && 'ring-2 ring-primary/20',
      )}
    >
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-1">{entry.label}</h4>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {typeBadge}
            </Badge>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {entry.shortDescription}
        </p>

        {/* Source badge */}
        <div>
          <Badge variant="secondary" className="text-xs">
            {sourceBadge}
          </Badge>
        </div>
      </div>
    </button>
  )
}
