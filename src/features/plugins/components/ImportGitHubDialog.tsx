import {
  AlertCircle,
  CheckCircle2,
  Github,
  Loader2,
  Package,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import type { PluginSchema, SchemaImportScope } from '@/shared/types'
import { formatStars } from '../format-utils'
import { fetchGitHubRepoInfo, type GitHubRepoInfo } from '../github-api'
import {
  createSchemalessPlugin,
  fetchGitHubSchema,
  mergeApiMetadata,
  parseGitHubUrl,
} from '../github-import'
import { globalSchemaExists, projectSchemaExists } from '../storage'

export type ImportResult =
  | { type: 'schema-only'; schema: PluginSchema; scope: SchemaImportScope }
  | { type: 'install'; schema: PluginSchema; scope: SchemaImportScope }

type ImportGitHubReadyState =
  | {
      step: 'schema-found'
      url: string
      repoInfo: GitHubRepoInfo
      schema: PluginSchema
    }
  | { step: 'schema-not-found'; url: string; repoInfo: GitHubRepoInfo }
  | {
      step: 'schema-invalid'
      url: string
      repoInfo: GitHubRepoInfo
      errors: string[]
    }
type PendingGitHubImport = {
  previousState: ImportGitHubReadyState
  result: ImportResult
}
type ImportGitHubState =
  | { step: 'input' }
  | { step: 'fetching-repo'; url: string }
  | {
      step: 'repo-error'
      url: string
      reason: 'not-found' | 'rate-limited' | 'network-error'
      details?: string | undefined
    }
  | { step: 'scanning-schema'; url: string; repoInfo: GitHubRepoInfo }
  | ImportGitHubReadyState
  | { step: 'checking-existing'; pending: PendingGitHubImport }
  | { step: 'confirm-overwrite'; pending: PendingGitHubImport }
  | {
      step: 'existence-check-error'
      pending: PendingGitHubImport
      details: string
    }

export interface ImportGitHubDialogProps {
  isOpen: boolean
  projectPath: string
  onClose: () => void
  onImport: (result: ImportResult) => void
}

function RepoPreview({
  repoInfo,
}: {
  repoInfo: GitHubRepoInfo
}): React.JSX.Element {
  const stars = formatStars(repoInfo.stars)
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-base leading-tight">
          {repoInfo.name}
        </div>
        {stars !== null && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {stars}
          </div>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{repoInfo.owner}</div>
      {repoInfo.description !== null && (
        <p className="text-sm text-foreground/80 line-clamp-2">
          {repoInfo.description}
        </p>
      )}
    </div>
  )
}

function ScopeSelector({
  scope,
  disabled,
  onChange,
}: {
  scope: SchemaImportScope
  disabled: boolean
  onChange: (scope: SchemaImportScope) => void
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Checkbox
        aria-label="Make available in all projects"
        checked={scope === 'global'}
        disabled={disabled}
        onCheckedChange={(checked) =>
          onChange(checked === true ? 'global' : 'project')
        }
      />
      <span>
        Make available in all projects
        <span className="block text-xs text-muted-foreground">
          Otherwise, this schema is saved only in the current project.
        </span>
      </span>
    </div>
  )
}

async function performScan(
  url: string,
  owner: string,
  repo: string,
  onStateChange: (state: ImportGitHubState) => void,
): Promise<void> {
  onStateChange({ step: 'fetching-repo', url })
  const repoResult = await fetchGitHubRepoInfo(owner, repo)
  if (!repoResult.success) {
    onStateChange({
      step: 'repo-error',
      url,
      reason: repoResult.reason,
      details: repoResult.details,
    })
    return
  }
  const repoInfo = repoResult.info
  onStateChange({ step: 'scanning-schema', url, repoInfo })
  const schemaResult = await fetchGitHubSchema(
    owner,
    repo,
    repoInfo.defaultBranch,
  )
  if (schemaResult.success)
    onStateChange({
      step: 'schema-found',
      url,
      repoInfo,
      schema: mergeApiMetadata(schemaResult.schema, repoInfo),
    })
  else if (schemaResult.reason === 'not-found')
    onStateChange({ step: 'schema-not-found', url, repoInfo })
  else
    onStateChange({
      step: 'schema-invalid',
      url,
      repoInfo,
      errors: [schemaResult.details ?? schemaResult.reason],
    })
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Dialog state variants render distinct import steps.
export function ImportGitHubDialog({
  isOpen,
  projectPath,
  onClose,
  onImport,
}: ImportGitHubDialogProps): React.JSX.Element {
  const [state, setState] = useState<ImportGitHubState>({ step: 'input' })
  const [urlInput, setUrlInput] = useState('')
  const [scope, setScope] = useState<SchemaImportScope>('project')
  const isCheckState =
    state.step === 'checking-existing' ||
    state.step === 'confirm-overwrite' ||
    state.step === 'existence-check-error'
  const isBusy =
    state.step === 'fetching-repo' ||
    state.step === 'scanning-schema' ||
    state.step === 'checking-existing'
  const urlParseError = urlInput.length > 0 ? parseGitHubUrl(urlInput) : null

  function handleClose(): void {
    setState({ step: 'input' })
    setUrlInput('')
    setScope('project')
    onClose()
  }
  async function handleScan(): Promise<void> {
    const parsed = parseGitHubUrl(urlInput)
    if (!parsed.success) return
    await performScan(urlInput, parsed.owner, parsed.repo, setState)
  }
  async function checkExisting(
    previousState: ImportGitHubReadyState,
    schema: PluginSchema,
    alsoInstall: boolean,
  ): Promise<void> {
    const result: ImportResult = alsoInstall
      ? { type: 'install', schema, scope }
      : { type: 'schema-only', schema, scope }
    const pending = { previousState, result }
    setState({ step: 'checking-existing', pending })
    try {
      const exists =
        result.scope === 'global'
          ? await globalSchemaExists(schema.id)
          : await projectSchemaExists(projectPath, schema.id)
      setState(exists ? { step: 'confirm-overwrite', pending } : previousState)
      if (!exists) {
        onImport(result)
        handleClose()
      }
    } catch (err) {
      setState({ step: 'existence-check-error', pending, details: String(err) })
    }
  }
  function importReady(
    ready: ImportGitHubReadyState,
    alsoInstall: boolean,
  ): void {
    const schema =
      ready.step === 'schema-found'
        ? ready.schema
        : createSchemalessPlugin(ready.repoInfo)
    void checkExisting(ready, schema, alsoInstall)
  }
  const destination =
    scope === 'global' ? 'Global schemas (all projects)' : 'Current project'

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Import Plugin from GitHub
          </DialogTitle>
          <DialogDescription>
            Enter a GitHub repository URL. We&apos;ll check for a configuration
            schema automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {(state.step === 'input' ||
            state.step === 'fetching-repo' ||
            state.step === 'repo-error') && (
            <div className="space-y-2">
              <Input
                value={urlInput}
                placeholder="https://github.com/owner/repo"
                disabled={isBusy}
                aria-label="GitHub repository URL"
                onChange={(event) => {
                  setUrlInput(event.target.value)
                  if (state.step === 'repo-error') setState({ step: 'input' })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isBusy) void handleScan()
                }}
              />
              {urlParseError?.success === false && state.step === 'input' && (
                <p className="text-xs text-destructive">
                  {urlParseError.error}
                </p>
              )}
              {state.step === 'repo-error' && (
                <p className="text-sm text-destructive">
                  {state.reason === 'not-found'
                    ? 'Repository not found. Check the URL and try again.'
                    : state.reason === 'rate-limited'
                      ? 'GitHub API rate limit reached. Please wait a few minutes and try again.'
                      : `Network error: ${state.details ?? 'Could not connect to GitHub.'}`}
                </p>
              )}
            </div>
          )}
          {(state.step === 'fetching-repo' ||
            state.step === 'scanning-schema' ||
            state.step === 'checking-existing') && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {state.step === 'checking-existing'
                ? 'Checking for existing schema…'
                : state.step === 'fetching-repo'
                  ? 'Fetching repository info…'
                  : 'Scanning for schema file…'}
            </div>
          )}
          {state.step === 'schema-found' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Schema found!
              </div>
              <RepoPreview repoInfo={state.repoInfo} />
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />
                {state.schema.options.length} configuration options
              </div>
              <p className="text-xs text-muted-foreground">
                Will be saved to: {destination}
              </p>
            </div>
          )}
          {(state.step === 'schema-not-found' ||
            state.step === 'schema-invalid') && (
            <div className="space-y-3">
              <RepoPreview repoInfo={state.repoInfo} />
              <p className="text-sm text-muted-foreground">
                {state.step === 'schema-not-found'
                  ? 'No schema file found. You can still add it without configuration support.'
                  : 'Schema file found but invalid. You can still add the plugin without configuration support.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Will be saved to: {destination}
              </p>
            </div>
          )}
          {state.step === 'confirm-overwrite' && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 space-y-1">
              <div className="flex gap-2 text-sm font-medium text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Schema already exists
              </div>
              <p className="text-sm text-muted-foreground">
                {state.pending.result.scope === 'project'
                  ? "A schema with this ID already exists in this project's schemas. Importing will overwrite the existing project schema."
                  : 'A schema with this ID already exists in global schemas. Importing will overwrite the global schema used by every project without a project-local override.'}
              </p>
            </div>
          )}
          {state.step === 'existence-check-error' && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
              <p className="text-sm text-destructive">
                Could not check for an existing schema in{' '}
                {state.pending.result.scope === 'project'
                  ? "this project's schemas"
                  : 'global schemas'}
                . Import was stopped.
              </p>
              <p className="text-xs text-destructive/80">{state.details}</p>
            </div>
          )}
          <ScopeSelector
            scope={scope}
            disabled={isBusy || isCheckState}
            onChange={setScope}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isBusy}>
            Cancel
          </Button>
          {(state.step === 'input' || state.step === 'repo-error') && (
            <Button
              onClick={() => void handleScan()}
              disabled={
                isBusy ||
                urlInput.trim().length === 0 ||
                (urlParseError !== null && !urlParseError.success)
              }
            >
              Scan Repo
            </Button>
          )}
          {state.step === 'schema-found' && (
            <>
              <Button
                variant="outline"
                onClick={() => importReady(state, false)}
              >
                Import Schema Only
              </Button>
              <Button onClick={() => importReady(state, true)}>
                Import &amp; Install
              </Button>
            </>
          )}
          {(state.step === 'schema-not-found' ||
            state.step === 'schema-invalid') && (
            <>
              <Button
                variant="outline"
                onClick={() => importReady(state, false)}
              >
                Add Without Config
              </Button>
              <Button onClick={() => importReady(state, true)}>
                Add &amp; Install
              </Button>
            </>
          )}
          {state.step === 'confirm-overwrite' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setScope(state.pending.result.scope)
                  setState(state.pending.previousState)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onImport(state.pending.result)
                  handleClose()
                }}
              >
                Overwrite
              </Button>
            </>
          )}
          {state.step === 'existence-check-error' && (
            <Button
              onClick={() => {
                setScope(state.pending.result.scope)
                setState(state.pending.previousState)
              }}
            >
              Back
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
