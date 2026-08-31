import { Download } from 'lucide-react'
import { useProjectStore } from '@/features/projects/store'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { APP_DOWNLOAD_URL } from '@/shared/lib/app-identity'
import { isMemoryMode } from '@/shared/lib/storage'

export function MemoryModeIndicator(): React.ReactNode {
  const isTutorialProject = useProjectStore((s) => s.isTutorialProject)
  const isMemory = isMemoryMode()

  if (!isMemory && !isTutorialProject) return null

  return (
    // Above the tutorial overlay (z-[9998]) so the download link stays
    // readable and clickable while the tutorial auto-runs on first visit.
    <div className="fixed bottom-3 right-3 z-[10000] flex items-center gap-2 pointer-events-none">
      {isTutorialProject && (
        <div className="rounded-full bg-cyan-500/90 px-3 py-1.5 text-sm font-medium text-black">
          Tutorial
        </div>
      )}
      {isMemory && (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <a
              href={APP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#55d98a] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              <Download className="size-4" />
              Get the desktop app
            </a>
          </TooltipTrigger>
          {/* Above the tutorial overlay, like the badge itself. */}
          <TooltipContent side="top" align="end" className="z-[10001] max-w-xs">
            Browser demo: projects are saved in this browser only, and deploying
            to Neovim needs the desktop app.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
