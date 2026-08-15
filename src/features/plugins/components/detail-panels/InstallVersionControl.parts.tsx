import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

type DraftInstallVersionMode =
  | 'semver-range'
  | 'branch'
  | 'tag'
  | 'commit'
  | 'ref'

interface InstallVersionCustomFieldsProps {
  readonly mode: DraftInstallVersionMode
  readonly value: string
  readonly validationMessage: string | null
  readonly showSchemaOverrideHint: boolean
  readonly onModeChange: (mode: DraftInstallVersionMode) => void
  readonly onValueChange: (value: string) => void
}

export function InstallVersionCustomFields({
  mode,
  value,
  validationMessage,
  showSchemaOverrideHint,
  onModeChange,
  onValueChange,
}: InstallVersionCustomFieldsProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
        Changing a plugin version can make the selected schema/config
        incompatible. vinela will still generate the requested vim.pack target,
        but it will not install extra dependencies or migrate schema options
        automatically.
      </div>
      {showSchemaOverrideHint && (
        <p className="text-xs text-muted-foreground">
          This overrides the schema recommended install target.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[220px,1fr]">
        <div className="space-y-2">
          <Label htmlFor="install-version-kind">Custom target type</Label>
          <select
            id="install-version-kind"
            className="flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="install-version-kind-select"
            value={mode}
            onChange={(event) => {
              const nextMode = event.target.value
              if (
                nextMode === 'semver-range' ||
                nextMode === 'branch' ||
                nextMode === 'tag' ||
                nextMode === 'commit' ||
                nextMode === 'ref'
              ) {
                onModeChange(nextMode)
              }
            }}
          >
            <option value="semver-range">Semver range</option>
            <option value="branch">Branch</option>
            <option value="tag">Tag</option>
            <option value="commit">Commit</option>
            <option value="ref">Other ref</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="install-version-value">Version / ref</Label>
          <Input
            id="install-version-value"
            data-testid="install-version-value-input"
            value={value}
            placeholder={
              mode === 'semver-range'
                ? '1.*, >=1.2.0, ~1.4'
                : mode === 'branch'
                  ? 'main or release/1.x'
                  : mode === 'tag'
                    ? 'v1.7.0 or nightly'
                    : mode === 'commit'
                      ? 'abc1234 or full SHA'
                      : 'some-ref'
            }
            onChange={(event) => onValueChange(event.target.value)}
          />
          {validationMessage !== null && (
            <p
              className="text-xs text-destructive"
              data-testid="install-version-validation-message"
            >
              {validationMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface InstallVersionActionsProps {
  readonly canSave: boolean
  readonly canReset: boolean
  readonly isDirty: boolean
  readonly isSaving: boolean
  readonly isResetting: boolean
  readonly onSave: () => void
  readonly onReset: () => void
  readonly onDiscard: () => void
}

export function InstallVersionActions({
  canSave,
  canReset,
  isDirty,
  isSaving,
  isResetting,
  onSave,
  onReset,
  onDiscard,
}: InstallVersionActionsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={!canSave}
        data-testid="install-version-save-button"
      >
        {isSaving ? 'Saving…' : 'Save install version'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onReset}
        disabled={!canReset}
        data-testid="install-version-reset-button"
      >
        {isResetting ? 'Resetting…' : 'Reset to default'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onDiscard}
        disabled={!isDirty}
        data-testid="install-version-discard-button"
      >
        Discard changes
      </Button>
    </div>
  )
}
