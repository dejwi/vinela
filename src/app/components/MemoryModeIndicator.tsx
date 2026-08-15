import { useProjectStore } from '@/features/projects/store'
import { isMemoryMode } from '@/shared/lib/storage'

export function MemoryModeIndicator(): React.ReactNode {
  const isTutorialProject = useProjectStore((s) => s.isTutorialProject)
  const isMemory = isMemoryMode()

  if (!isMemory && !isTutorialProject) return null

  return (
    <div className="fixed bottom-2 right-2 z-50 flex gap-2 pointer-events-none">
      {isTutorialProject && (
        <div className="rounded-full bg-cyan-500/90 px-2 py-1 text-xs font-medium text-black">
          Tutorial
        </div>
      )}
      {isMemory && (
        <div className="rounded-full bg-amber-500/90 px-2 py-1 text-xs font-medium text-black">
          Memory Mode
        </div>
      )}
    </div>
  )
}
