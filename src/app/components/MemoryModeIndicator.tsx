import { useProjectStore } from '@/features/projects/store'
import { GithubIcon } from '@/shared/components/ui/github-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { APP_REPO_URL } from '@/shared/lib/app-identity'
import { isMemoryMode } from '@/shared/lib/storage'

export function MemoryModeIndicator(): React.ReactNode {
  const isTutorialProject = useProjectStore((s) => s.isTutorialProject)
  const isMemory = isMemoryMode()

  if (!isMemory && !isTutorialProject) return null

  return (
    // Above the tutorial overlay (z-[9998]) so the demo/repo link stays
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
              href={APP_REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Demo of vinela — open the GitHub repository"
              className="pointer-events-auto group flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:border-foreground/40"
            >
              <span className="text-muted-foreground">Demo of</span>
              <span className="flex items-center gap-1.5 font-medium text-foreground group-hover:underline underline-offset-2">
                <GithubIcon className="size-4" />
                vinela
              </span>
            </a>
          </TooltipTrigger>
          {/* Above the tutorial overlay, like the badge itself. */}
          <TooltipContent side="top" align="end" className="z-[10001] max-w-xs">
            Browser demo - projects are saved in this browser only. Open the
            GitHub repository.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
