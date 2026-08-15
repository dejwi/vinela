import { Keyboard, Plus, Search } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface EmptyStateProps {
  /** Whether there are keymaps that are being filtered out */
  hasKeymaps: boolean
  onCreateClick?: () => void
}

export function EmptyState({
  hasKeymaps,
  onCreateClick,
}: EmptyStateProps): React.JSX.Element {
  if (hasKeymaps) {
    // All filtered out
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <h3 className="font-medium text-lg">No matching shortcuts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your search or filters.
        </p>
      </div>
    )
  }

  // No keymaps at all
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Keyboard className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="font-medium text-lg">No keyboard shortcuts yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Keyboard shortcuts let you trigger actions with a key press. Create your
        first shortcut to get started.
      </p>
      {onCreateClick !== undefined && (
        <Button onClick={onCreateClick} className="mt-4">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Shortcut
        </Button>
      )}
    </div>
  )
}
