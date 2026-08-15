import { AlertCircle, CheckCircle2, FileJson, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/shared/components/ui/textarea'
import { validateSchema } from '@/shared/lib/schema-validation'
import { getStorageBackend, isMemoryMode } from '@/shared/lib/storage'
import type { PluginSchema, SchemaImportScope } from '@/shared/types'
import { globalSchemaExists, projectSchemaExists } from '../storage'
import type { ImportResult } from './ImportGitHubDialog'

type PendingJsonImport = {
  schema: PluginSchema
  fileName: string
  alsoInstall: boolean
  scope: SchemaImportScope
}
type ImportJsonState =
  | { step: 'pick' }
  | { step: 'paste'; text: string }
  | { step: 'validating'; fileName: string }
  | { step: 'valid'; schema: PluginSchema; fileName: string }
  | { step: 'invalid'; errors: string[]; fileName: string }
  | { step: 'checking-existing'; pending: PendingJsonImport }
  | { step: 'confirm-overwrite'; pending: PendingJsonImport }
  | {
      step: 'existence-check-error'
      pending: PendingJsonImport
      details: string
    }

export interface ImportJsonDialogProps {
  isOpen: boolean
  projectPath: string
  onClose: () => void
  onImport: (result: ImportResult) => void
}

function parseAndValidate(
  text: string,
  fileName: string,
): Extract<ImportJsonState, { step: 'valid' | 'invalid' }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return {
      step: 'invalid',
      errors: [
        `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
      fileName,
    }
  }
  const result = validateSchema(parsed)
  return result.valid
    ? { step: 'valid', schema: parsed as PluginSchema, fileName }
    : {
        step: 'invalid',
        errors: result.errors.map((error) => error.message),
        fileName,
      }
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

export function ImportJsonDialog({
  isOpen,
  projectPath,
  onClose,
  onImport,
}: ImportJsonDialogProps): React.JSX.Element {
  const memoryMode = isMemoryMode()
  const [state, setState] = useState<ImportJsonState>(
    memoryMode ? { step: 'paste', text: '' } : { step: 'pick' },
  )
  const [scope, setScope] = useState<SchemaImportScope>('project')
  const isCheckState =
    state.step === 'checking-existing' ||
    state.step === 'confirm-overwrite' ||
    state.step === 'existence-check-error'
  const isBusy =
    state.step === 'validating' || state.step === 'checking-existing'
  const destination =
    scope === 'global' ? 'Global schemas (all projects)' : 'Current project'
  function resetState(): ImportJsonState {
    return memoryMode ? { step: 'paste', text: '' } : { step: 'pick' }
  }
  function handleClose(): void {
    setState(resetState())
    setScope('project')
    onClose()
  }
  function handleValidatePaste(text: string): void {
    setState(
      text.trim().length === 0
        ? { step: 'paste', text }
        : parseAndValidate(text, 'pasted JSON'),
    )
  }
  async function handlePickFile(): Promise<void> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        filters: [{ name: 'JSON Schema', extensions: ['json'] }],
        multiple: false,
        directory: false,
      })
      if (selected === null || selected === undefined) return
      const filePath = typeof selected === 'string' ? selected : selected[0]
      if (filePath === undefined) return
      const fileName =
        filePath.split('/').pop() ?? filePath.split('\\').pop() ?? filePath
      setState({ step: 'validating', fileName })
      setState(
        parseAndValidate(
          await (await getStorageBackend()).readAbsoluteFile(filePath),
          fileName,
        ),
      )
    } catch (err) {
      setState({
        step: 'invalid',
        errors: [
          `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
        ],
        fileName: 'unknown',
      })
    }
  }
  function emit(pending: PendingJsonImport): void {
    onImport(
      pending.alsoInstall
        ? { type: 'install', schema: pending.schema, scope: pending.scope }
        : { type: 'schema-only', schema: pending.schema, scope: pending.scope },
    )
    handleClose()
  }
  async function handleImport(
    schema: PluginSchema,
    alsoInstall: boolean,
  ): Promise<void> {
    const pending: PendingJsonImport = {
      schema,
      fileName: state.step === 'valid' ? state.fileName : 'unknown',
      alsoInstall,
      scope,
    }
    setState({ step: 'checking-existing', pending })
    try {
      const exists =
        pending.scope === 'global'
          ? await globalSchemaExists(schema.id)
          : await projectSchemaExists(projectPath, schema.id)
      if (exists) setState({ step: 'confirm-overwrite', pending })
      else emit(pending)
    } catch (err) {
      setState({ step: 'existence-check-error', pending, details: String(err) })
    }
  }
  function restoreValid(pending: PendingJsonImport): void {
    setScope(pending.scope)
    setState({
      step: 'valid',
      schema: pending.schema,
      fileName: pending.fileName,
    })
  }

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
            <FileJson className="h-5 w-5" />
            Import Plugin from JSON
          </DialogTitle>
          <DialogDescription>
            {memoryMode
              ? 'Paste your plugin schema JSON below.'
              : 'Select a plugin schema JSON file from your filesystem.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!memoryMode && state.step === 'pick' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void handlePickFile()}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Choose JSON File…
            </Button>
          )}
          {state.step === 'validating' && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating {state.fileName}…
            </div>
          )}
          {memoryMode &&
            (state.step === 'paste' ||
              state.step === 'valid' ||
              state.step === 'invalid') && (
              <Textarea
                placeholder={
                  '{\n  "id": "my-plugin",\n  "pluginName": "my.nvim",\n  ...\n}'
                }
                className="font-mono text-xs min-h-[160px] resize-y"
                value={state.step === 'paste' ? state.text : ''}
                disabled={isBusy}
                aria-label="Paste schema JSON"
                onChange={(event) =>
                  setState({ step: 'paste', text: event.target.value })
                }
                onBlur={(event) => handleValidatePaste(event.target.value)}
              />
            )}
          {state.step === 'valid' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Valid schema: {state.schema.pluginName}
              </div>
              <p className="text-xs text-muted-foreground">
                Will be saved to: {destination}
              </p>
            </div>
          )}
          {state.step === 'invalid' && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <div className="flex gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                Validation errors in {state.fileName}
              </div>
              {state.errors.slice(0, 5).map((error) => (
                <p key={error} className="text-xs text-destructive/80">
                  {error}
                </p>
              ))}
            </div>
          )}
          {state.step === 'checking-existing' && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for existing schema…
            </div>
          )}
          {state.step === 'confirm-overwrite' && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 space-y-1">
              <div className="flex gap-2 text-sm font-medium text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Schema already exists
              </div>
              <p className="text-sm text-muted-foreground">
                {state.pending.scope === 'project'
                  ? "A schema with this ID already exists in this project's schemas. Importing will overwrite the existing project schema."
                  : 'A schema with this ID already exists in global schemas. Importing will overwrite the global schema used by every project without a project-local override.'}
              </p>
            </div>
          )}
          {state.step === 'existence-check-error' && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">
                Could not check for an existing schema in{' '}
                {state.pending.scope === 'project'
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
          {state.step === 'valid' && (
            <>
              <Button
                variant="outline"
                onClick={() => void handleImport(state.schema, false)}
              >
                Import Schema Only
              </Button>
              <Button onClick={() => void handleImport(state.schema, true)}>
                Import &amp; Install
              </Button>
            </>
          )}
          {state.step === 'confirm-overwrite' && (
            <>
              <Button
                variant="outline"
                onClick={() => restoreValid(state.pending)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => emit(state.pending)}>
                Overwrite
              </Button>
            </>
          )}
          {state.step === 'existence-check-error' && (
            <Button onClick={() => restoreValid(state.pending)}>Back</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
