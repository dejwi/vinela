import { Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useProjectStore } from '@/features/projects/store'
import { Button } from '@/shared/components/ui/button'
import type { ActionState } from '../types'

interface DevModeQuickStartProps {
  actionState: ActionState
  setActionState: (state: ActionState) => void
  onSuccess: () => void
}

export function DevModeQuickStart({
  actionState,
  setActionState,
  onSuccess,
}: DevModeQuickStartProps) {
  const initDevMode = useProjectStore((state) => state.initDevMode)

  const handleQuickStart = async () => {
    setActionState('quickStarting')
    try {
      const success = await initDevMode()
      if (success) {
        onSuccess()
      } else {
        const error = useProjectStore.getState().error
        toast.error('Failed to start dev project', {
          description: error ?? 'Unknown error',
        })
      }
    } finally {
      setActionState('idle')
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:delay-150 motion-reduce:animate-none">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium">DEV MODE</p>
            <p className="text-xs text-muted-foreground">
              Quick start with dev project
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleQuickStart()}
          disabled={actionState !== 'idle'}
        >
          {actionState === 'quickStarting' ? 'Starting...' : 'Quick Start'}
        </Button>
      </div>
    </div>
  )
}
