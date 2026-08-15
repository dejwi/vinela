import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useProjectStore } from '@/features/projects/store'
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
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { isMemoryMode } from '@/shared/lib/storage'
import type {
  ActionState,
  CreateDialogPhase,
  ProjectCreationKind,
} from '../types'
import { validateMemoryPath } from '../utils/memory-path-validation'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionState: ActionState
  setActionState: (state: ActionState) => void
  onSuccess: () => void
  projectKind: ProjectCreationKind
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: blank and example creation flows intentionally share this controlled dialog.
export function NewProjectDialog({
  open,
  onOpenChange,
  actionState,
  setActionState,
  onSuccess,
  projectKind,
}: NewProjectDialogProps) {
  const createProject = useProjectStore((state) => state.createProject)
  const createExampleProject = useProjectStore(
    (state) => state.createExampleProject,
  )
  const openProject = useProjectStore((state) => state.openProject)
  const recentProjects = useProjectStore((state) => state.recentProjects)

  const [phase, setPhase] = useState<CreateDialogPhase>({ phase: 'editing' })
  const [folderPath, setFolderPath] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [hasEditedMemoryPath, setHasEditedMemoryPath] = useState(false)

  const inMemoryMode = isMemoryMode()

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPhase({ phase: 'editing' })
      setFolderPath('')
      setName('')
      setDescription(
        projectKind === 'example'
          ? 'Example Neovim configuration created with Vinela.'
          : '',
      )
      setValidationError(null)
      setHasEditedMemoryPath(false)
    }
  }, [open, projectKind])

  // Auto-suggest memory path from name
  useEffect(() => {
    if (projectKind === 'example' && inMemoryMode && !hasEditedMemoryPath) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFolderPath(slug ? `/memory/projects/${slug}` : '')
    } else if (projectKind === 'blank' && inMemoryMode && name && !folderPath) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      if (slug) {
        setFolderPath(`/memory/projects/${slug}`)
      }
    }
  }, [name, folderPath, hasEditedMemoryPath, inMemoryMode, projectKind])

  const handleBrowse = async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog')
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Choose Project Folder',
      })
      if (selected) {
        setFolderPath(selected)
        setValidationError(null)
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error)
      toast.error('Failed to open folder browser')
    }
  }

  const validateInputs = (): boolean => {
    if (!name.trim()) {
      setValidationError('Project name is required')
      return false
    }

    if (!folderPath.trim()) {
      setValidationError('Folder path is required')
      return false
    }

    if (inMemoryMode) {
      // Get existing project paths for duplicate detection
      const existingPaths = recentProjects.map((p) => p.absolutePath)
      const validation = validateMemoryPath(folderPath, existingPaths)
      if (!validation.valid) {
        setValidationError(validation.message)
        return false
      }
    }

    setValidationError(null)
    return true
  }

  const handleSubmit = async () => {
    if (!validateInputs()) {
      return
    }

    if (projectKind === 'example') {
      setActionState('creating')
      try {
        const result = await createExampleProject(folderPath, name, description)
        if (result.success) {
          onOpenChange(false)
          onSuccess()
        } else {
          setValidationError(result.message)
        }
      } finally {
        setActionState('idle')
      }
      return
    }

    if (phase.phase === 'confirm-non-empty') {
      // User confirmed, create with force=true
      setActionState('creating')
      try {
        const result = await createProject(
          phase.pending.folderPath,
          phase.pending.name,
          phase.pending.description,
          true, // force=true
        )
        if (result.success) {
          onOpenChange(false)
          onSuccess()
        } else {
          setValidationError(result.message)
        }
      } finally {
        setActionState('idle')
      }
      return
    }

    // First attempt: force=false
    setActionState('creating')
    try {
      const result = await createProject(
        folderPath,
        name,
        description,
        false, // force=false
      )

      if (result.success) {
        onOpenChange(false)
        onSuccess()
      } else {
        // Use discriminated union for type-safe error handling
        switch (result.error) {
          case 'folder_not_empty':
            setPhase({
              phase: 'confirm-non-empty',
              pending: { folderPath, name, description },
            })
            break
          case 'already_exists':
            setValidationError(
              'A project already exists at this location. Would you like to open it?',
            )
            break
          default:
            setValidationError(result.message)
        }
      }
    } finally {
      setActionState('idle')
    }
  }

  const handleOpenExisting = async () => {
    setActionState('creating')
    try {
      const result = await openProject(folderPath)
      if (result.success) {
        onOpenChange(false)
        onSuccess()
      } else {
        setValidationError(result.message)
      }
    } finally {
      setActionState('idle')
    }
  }

  const isCreating = actionState === 'creating'
  const isAlreadyExists =
    projectKind === 'blank' && validationError?.includes('already exists')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {phase.phase === 'confirm-non-empty'
              ? 'Confirm Project Creation'
              : projectKind === 'example'
                ? 'Create Example Project'
                : 'New Project'}
          </DialogTitle>
          <DialogDescription>
            {phase.phase === 'confirm-non-empty'
              ? 'The selected folder is not empty. Creating a project here will add vinela files to this folder.'
              : projectKind === 'example'
                ? "Create a project from Vinela's example configuration"
                : 'Create a new Neovim configuration project'}
          </DialogDescription>
        </DialogHeader>

        {phase.phase === 'editing' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Neovim Config"
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-path">Folder Path *</Label>
              <div className="flex gap-2">
                <Input
                  id="folder-path"
                  value={folderPath}
                  onChange={(e) => {
                    setFolderPath(e.target.value)
                    setHasEditedMemoryPath(true)
                    setValidationError(null)
                  }}
                  placeholder={
                    inMemoryMode
                      ? '/memory/projects/my-config'
                      : 'Choose a folder...'
                  }
                  disabled={isCreating}
                  className="flex-1"
                />
                {!inMemoryMode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleBrowse()}
                    disabled={isCreating}
                  >
                    Browse
                  </Button>
                )}
              </div>
              {inMemoryMode && (
                <p className="text-xs text-muted-foreground">
                  Memory mode: paths must start with /memory/projects/
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this configuration"
                disabled={isCreating}
                rows={3}
              />
            </div>

            {validationError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{validationError}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Folder is not empty</p>
                  <p className="text-sm text-muted-foreground">
                    The folder{' '}
                    <span className="font-mono">
                      {phase.pending.folderPath}
                    </span>{' '}
                    contains existing files. Creating a project here will add
                    project files directly to this folder, including{' '}
                    <span className="font-mono">project.json</span>,{' '}
                    <span className="font-mono">graphs/</span>, and{' '}
                    <span className="font-mono">schemas/</span>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to continue?
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {phase.phase === 'editing' ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              {isAlreadyExists ? (
                <Button
                  onClick={() => void handleOpenExisting()}
                  disabled={isCreating}
                >
                  {isCreating ? 'Opening...' : 'Open Existing'}
                </Button>
              ) : (
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={isCreating}
                >
                  {isCreating
                    ? projectKind === 'example'
                      ? 'Creating Example...'
                      : 'Creating...'
                    : projectKind === 'example'
                      ? 'Create Example Project'
                      : 'Create Project'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setPhase({ phase: 'editing' })}
                disabled={isCreating}
              >
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleSubmit()}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Anyway'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
