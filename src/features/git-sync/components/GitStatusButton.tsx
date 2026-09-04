import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleCheck,
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { PROJECT_FILES_CHANGED_EVENT } from '@/shared/lib/storage-api'
import { cn } from '@/shared/lib/utils'
import { useGitSyncStore } from '../store'

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI precedence is the approved Git state matrix.
export function GitStatusButton(): React.JSX.Element | null {
  const repository = useGitSyncStore((state) => state.repository)
  const operation = useGitSyncStore((state) => state.operation)
  const lastError = useGitSyncStore((state) => state.lastError)
  const projectPath = useGitSyncStore((state) => state.projectPath)
  const refresh = useGitSyncStore((state) => state.refresh)
  const initializeProject = useGitSyncStore((state) => state.initializeProject)
  const commitAll = useGitSyncStore((state) => state.commitAll)
  const synchronize = useGitSyncStore((state) => state.synchronize)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const activationRef = useRef<{ projectPath: string | null } | null>(null)

  useEffect(() => {
    const activation = { projectPath }
    activationRef.current = activation
    return () => {
      if (activationRef.current === activation) activationRef.current = null
    }
  }, [projectPath])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const onFocus = (): void => {
      void refresh()
    }
    const onChange = (event: Event): void => {
      const detail = (event as CustomEvent<{ projectPath: string }>).detail
      if (projectPath === null || detail.projectPath !== projectPath) return
      if (timeout !== null) clearTimeout(timeout)
      timeout = setTimeout(() => {
        timeout = null
        void refresh()
      }, 250)
    }
    const interval = setInterval(() => {
      void refresh()
    }, 5000)
    window.addEventListener('focus', onFocus)
    window.addEventListener(PROJECT_FILES_CHANGED_EVENT, onChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(PROJECT_FILES_CHANGED_EVENT, onChange)
      if (timeout !== null) clearTimeout(timeout)
    }
  }, [projectPath, refresh])

  if (repository.status === 'inactive') return null
  let icon = <TriangleAlert className="w-5 h-5" />
  let tooltip = 'Checking Git repository…'
  let className = ''
  let disabled = false
  let badge = 0
  let click: (() => void) | undefined
  if (operation !== null) {
    const labels = {
      fetching: 'Fetching remote changes…',
      pulling: 'Pulling remote changes…',
      committing: 'Committing all changes…',
      pushing: 'Pushing commits…',
    }
    icon = <LoaderCircle className="w-5 h-5 animate-spin" />
    tooltip = labels[operation]
    disabled = true
  } else if (repository.status === 'error') {
    tooltip = `Git error: ${repository.message}`
    className = 'bg-destructive hover:bg-destructive/90 text-white'
    click =
      projectPath === null
        ? undefined
        : () => {
            void initializeProject(projectPath)
          }
  } else if (repository.status === 'ready') {
    const snapshot = repository.snapshot
    if (snapshot.conflictedFiles > 0) {
      tooltip = `Git conflicts in ${plural(snapshot.conflictedFiles, 'file')}. Resolve them outside Vinela.`
      className = 'bg-destructive hover:bg-destructive/90 text-white'
      badge = snapshot.conflictedFiles
      disabled = true
    } else if (snapshot.changedFiles > 0) {
      icon = <GitCommitHorizontal className="w-5 h-5" />
      className = 'bg-amber-500 hover:bg-amber-600 text-white'
      badge = snapshot.changedFiles
      tooltip = `Git: ${plural(snapshot.changedFiles, 'uncommitted file')}. Click to commit all.`
      if (snapshot.ahead || snapshot.behind)
        tooltip += ` Ahead: ${snapshot.ahead}. Behind: ${snapshot.behind}.`
      click = () => setDialogOpen(true)
    } else if (snapshot.ahead > 0 && snapshot.behind > 0) {
      tooltip = `Git branch diverged: ${snapshot.ahead} ahead, ${snapshot.behind} behind. Reconcile it outside Vinela.`
      className = 'bg-destructive hover:bg-destructive/90 text-white'
      disabled = true
    } else if (snapshot.ahead > 0) {
      icon = <ArrowUpFromLine className="w-5 h-5" />
      badge = snapshot.ahead
      tooltip = `Git: ${plural(snapshot.ahead, 'unpushed commit')}. Click to sync.`
      click = () => {
        void handleSync()
      }
    } else if (snapshot.behind > 0) {
      icon = <ArrowDownToLine className="w-5 h-5" />
      badge = snapshot.behind
      tooltip = `Git: ${plural(snapshot.behind, 'remote commit')} available. Click to pull.`
      click = () => {
        void handleSync()
      }
    } else if (snapshot.upstream === null || snapshot.branch === null) {
      icon = <GitBranch className="w-5 h-5" />
      className = 'bg-secondary text-secondary-foreground'
      disabled = true
      tooltip =
        snapshot.upstream === null
          ? 'Git branch has no upstream. Configure it outside Vinela.'
          : 'Git HEAD is detached. Resolve it outside Vinela.'
    } else {
      icon = <CircleCheck className="w-5 h-5" />
      className = 'bg-green-600 hover:bg-green-700 text-white'
      tooltip = 'Git is up to date. Click to check now.'
      click = () => {
        void handleSync()
      }
    }
    if (lastError !== null) {
      icon = <TriangleAlert className="w-5 h-5" />
      className = 'bg-destructive hover:bg-destructive/90 text-white'
      tooltip += ` Last Git error: ${lastError}`
    }
  }

  async function handleSync(): Promise<void> {
    const actionProjectPath = projectPath
    const actionActivation = activationRef.current
    const result = await synchronize()
    if (!result.success)
      toast.error('Git sync failed', { description: result.error })
    if (
      result.didPull &&
      actionActivation !== null &&
      activationRef.current === actionActivation &&
      actionProjectPath !== null &&
      useGitSyncStore.getState().projectPath === actionProjectPath
    )
      window.location.reload()
  }
  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    const result = await commitAll(draft)
    if (result.success) {
      toast.success('Changes committed')
      setDraft('')
      setDialogOpen(false)
    } else toast.error('Git commit failed', { description: result.error })
  }
  const committing = operation === 'committing'
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              variant="default"
              size="icon"
              className={cn('w-10 h-10', className)}
              onClick={click}
              disabled={disabled}
              aria-label={tooltip}
            >
              {icon}
            </Button>
            {badge > 0 && operation === null && (
              <Badge
                variant="secondary"
                className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px]"
              >
                {badge}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!committing) {
            setDialogOpen(open)
            if (!open) setDraft('')
          }
        }}
      >
        <DialogContent preventOutsideClose={committing}>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Commit all changes</DialogTitle>
              <DialogDescription>
                All changed, deleted, and untracked files in this repository
                will be staged and committed.
              </DialogDescription>
            </DialogHeader>
            <label
              className="mt-4 block text-sm font-medium"
              htmlFor="git-commit-message"
            >
              Commit message (optional)
            </label>
            <Input
              id="git-commit-message"
              className="mt-2"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={200}
              placeholder="Update Vinela project (default)"
              disabled={committing}
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="secondary"
                disabled={committing}
                onClick={() => {
                  setDraft('')
                  setDialogOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={committing}>
                Commit all
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
