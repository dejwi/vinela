import { formatDistanceToNow } from 'date-fns'
import { Copy, FolderOpen, MoreVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { RecentProject } from '@/shared/types'
import type { ActionState } from '../types'

interface RecentProjectCardProps {
  project: RecentProject
  actionState: ActionState
  onOpen: () => void
  onRemove: () => void
}

export function RecentProjectCard({
  project,
  actionState,
  onOpen,
  onRemove,
}: RecentProjectCardProps) {
  const isDisabled = actionState !== 'idle'

  const handleCopyPath = () => {
    void navigator.clipboard.writeText(project.absolutePath)
    toast.success('Path copied to clipboard')
  }

  const relativeTime = formatDistanceToNow(project.lastOpenedAt, {
    addSuffix: true,
  })

  return (
    <div className="group relative rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:bg-accent/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-reduce:animate-none">
      <button
        type="button"
        onClick={onOpen}
        disabled={isDisabled}
        className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={`Open ${project.name}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{project.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {project.absolutePath}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{relativeTime}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isDisabled}
              aria-label="Project actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyPath}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Path
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Recent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
