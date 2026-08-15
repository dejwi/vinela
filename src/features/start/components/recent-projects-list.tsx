import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useProjectStore } from '@/features/projects/store'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useReducedMotion } from '@/shared/hooks/use-reduced-motion'
import type { RecentProject } from '@/shared/types'
import type { ActionState, RecentProjectsLoadState } from '../types'
import { RecentProjectCard } from './recent-project-card'

interface RecentProjectsListProps {
  recents: RecentProjectsLoadState
  actionState: ActionState
  setActionState: (state: ActionState) => void
  onNavigate: () => void
}

export function RecentProjectsList({
  recents,
  actionState,
  setActionState,
  onNavigate,
}: RecentProjectsListProps) {
  const openProject = useProjectStore((state) => state.openProject)
  const removeRecentProject = useProjectStore(
    (state) => state.removeRecentProject,
  )
  const restoreRecentProject = useProjectStore(
    (state) => state.restoreRecentProject,
  )
  const prefersReducedMotion = useReducedMotion()

  const handleOpenProject = async (project: RecentProject) => {
    setActionState('opening')
    try {
      const result = await openProject(project.absolutePath)
      if (result.success) {
        onNavigate()
      } else {
        // Use discriminated union for type-safe error handling
        const isStaleEntry =
          result.error === 'not_found' || result.error === 'invalid_project'

        if (isStaleEntry) {
          await removeRecentProject(project.absolutePath)
          toast.error('Project not found', {
            description: 'This project has been removed from recent projects.',
            action: {
              label: 'Undo',
              onClick: () => void restoreRecentProject(project),
            },
          })
        } else {
          toast.error('Failed to open project', { description: result.message })
        }
      }
    } finally {
      setActionState('idle')
    }
  }

  const handleRemoveProject = async (project: RecentProject) => {
    await removeRecentProject(project.absolutePath)
    toast.success('Removed from recent projects', {
      action: {
        label: 'Undo',
        onClick: () => void restoreRecentProject(project),
      },
    })
  }

  if (recents.status === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Recent Projects</span>
        </div>
        <output
          className="space-y-2 block"
          aria-label="Loading recent projects"
        >
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </output>
      </div>
    )
  }

  const projects = recents.projects.slice(0, 5) // Cap at 5

  if (projects.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Recent Projects</span>
      </div>
      <div className="space-y-2">
        {projects.map((project, index) => (
          <div
            key={project.absolutePath}
            style={
              prefersReducedMotion
                ? undefined
                : {
                    // @ts-expect-error - CSS custom property
                    '--stagger-delay': `${index * 40}ms`,
                    animationDelay: 'var(--stagger-delay)',
                  }
            }
          >
            <RecentProjectCard
              project={project}
              actionState={actionState}
              onOpen={() => void handleOpenProject(project)}
              onRemove={() => void handleRemoveProject(project)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
