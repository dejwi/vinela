import { Copy, FolderOpen, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useProjectStore } from '@/features/projects/store'
import { useTutorialStore } from '@/features/tutorial'
import { loadTutorialProgress } from '@/features/tutorial/storage'
import { Button } from '@/shared/components/ui/button'
import { GithubIcon } from '@/shared/components/ui/github-icon'
import { useScrollIndicators } from '@/shared/hooks/use-scroll-indicators'
import { APP_DOWNLOAD_URL, APP_REPO_URL } from '@/shared/lib/app-identity'
import { isMemoryMode } from '@/shared/lib/storage'
import { cn } from '@/shared/lib/utils'
import vinelaLogoUrl from '../../../../assets/branding/vinela-logo-transparent-dark.svg'
import { DevModeQuickStart } from '../components/dev-mode-quick-start'
import { NewProjectDialog } from '../components/new-project-dialog'
import { RecentProjectsList } from '../components/recent-projects-list'
import type { ActionState, ProjectCreationKind } from '../types'

export default function StartScreen() {
  const navigate = useNavigate()
  const loadRecentProjects = useProjectStore(
    (state) => state.loadRecentProjects,
  )
  const recentProjects = useProjectStore((state) => state.recentProjects)
  const isLoading = useProjectStore((state) => state.isLoading)

  const [actionState, setActionState] = useState<ActionState>('idle')
  const [projectDialogKind, setProjectDialogKind] =
    useState<ProjectCreationKind | null>(null)
  const [showTourLink, setShowTourLink] = useState(false)

  const { scrollRef, canScrollUp, canScrollDown } = useScrollIndicators()

  const inMemoryMode = isMemoryMode()

  // Load recent projects on mount
  useEffect(() => {
    void loadRecentProjects()
  }, [loadRecentProjects])

  // Check if we should show the "Take the guided tour" link
  useEffect(() => {
    async function checkTutorialStatus(): Promise<void> {
      const progress = await loadTutorialProgress()
      // Show tour link if tutorial has never been completed
      setShowTourLink(progress === null || !progress.hasCompleted)
    }
    void checkTutorialStatus()
  }, [])

  const handleOpenFolder = async () => {
    if (inMemoryMode) {
      // In memory mode, show create dialog instead
      setProjectDialogKind('blank')
      return
    }

    setActionState('opening')
    try {
      // Dynamic import to avoid loading Tauri in browser
      const { open } = await import('@tauri-apps/plugin-dialog')

      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open Project Folder',
      })

      if (selected) {
        const openProject = useProjectStore.getState().openProject
        const result = await openProject(selected)
        if (result.success) {
          navigate('/plugins')
        } else {
          toast.error('Failed to open project', { description: result.message })
        }
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error)
      toast.error('Failed to open folder browser')
    } finally {
      setActionState('idle')
    }
  }

  const isActionDisabled = actionState !== 'idle'

  return (
    <div className="flex flex-col h-full bg-background pt-8 pb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 motion-reduce:animate-none">
      <div className="w-full max-w-2xl mx-auto px-8 flex flex-col h-full">
        {/* Header - fixed */}
        <div className="flex-shrink-0 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img
              src={vinelaLogoUrl}
              alt=""
              className="size-16 shrink-0"
              aria-hidden="true"
            />
            <h1 className="text-4xl font-extrabold tracking-tight [font-family:'JetBrains_Mono',monospace]">
              <span className="text-[#55d98a]">v</span>
              <span className="text-[#f1f5f1]">inela</span>
            </h1>
          </div>
          {inMemoryMode && (
            <p className="text-xs text-muted-foreground">
              Browser demo: projects live in this browser only.{' '}
              <a
                href={APP_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Download the desktop app
              </a>{' '}
              to keep projects on disk and deploy to your Neovim config.
            </p>
          )}
        </div>

        {/* Dev Mode Quick Start - fixed */}
        {import.meta.env.DEV && (
          <div className="flex-shrink-0 mt-8">
            <DevModeQuickStart
              actionState={actionState}
              setActionState={setActionState}
              onSuccess={() => navigate('/plugins')}
            />
          </div>
        )}

        {/* Recent Projects - scrollable with indicators */}
        <div className="relative flex-1 min-h-0">
          {/* Top scroll shadow - visible when scrolled down from top */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-200',
              canScrollUp ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />

          {/* Scrollable content with padding */}
          <div ref={scrollRef} className="overflow-y-auto h-full py-8 px-1">
            <RecentProjectsList
              recents={
                isLoading
                  ? { status: 'loading' }
                  : { status: 'ready', projects: recentProjects }
              }
              actionState={actionState}
              setActionState={setActionState}
              onNavigate={() => navigate('/plugins')}
            />
          </div>

          {/* Bottom scroll shadow - visible when more content exists below */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none transition-opacity duration-200',
              canScrollDown ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />
        </div>

        {/* Actions - fixed */}
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={() => void handleOpenFolder()}
              disabled={isActionDisabled}
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {inMemoryMode ? 'Open Project' : 'Open Folder'}
            </Button>
            <Button
              size="lg"
              onClick={() => setProjectDialogKind('blank')}
              disabled={isActionDisabled}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setProjectDialogKind('example')}
              disabled={isActionDisabled}
            >
              <Copy className="w-4 h-4 mr-2" />
              Create Example Project
            </Button>
          </div>
          {showTourLink && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              onClick={() => {
                void useTutorialStore.getState().startTutorial()
              }}
              disabled={isActionDisabled}
            >
              Take the guided tour
            </button>
          )}
          <a
            href={APP_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <GithubIcon className="size-3.5" />
            {inMemoryMode
              ? 'Browser demo of vinela - open source on GitHub'
              : 'Open source on GitHub'}
          </a>
        </div>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={projectDialogKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProjectDialogKind(null)
          }
        }}
        actionState={actionState}
        setActionState={setActionState}
        onSuccess={() => navigate('/plugins')}
        projectKind={projectDialogKind ?? 'blank'}
      />
    </div>
  )
}
